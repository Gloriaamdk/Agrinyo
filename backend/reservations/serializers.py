from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from machines.models import Machine

from .models import Message, Reservation

HORIZON_JOURS = 180
QUANTITE_MAX = {
    Machine.UnitePrix.JOUR: Decimal(30),
    Machine.UnitePrix.HEURE: Decimal(24),
    Machine.UnitePrix.HECTARE: Decimal(200),
}

_date_lisible = '%d/%m/%Y'


class _PersonneSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField(source='nom_complet')


class _MachineResumeSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()
    type_machine_libelle = serializers.CharField(source='get_type_machine_display')
    zone_libelle = serializers.CharField(source='get_zone_display')
    proprietaire = _PersonneSerializer()

    class Meta:
        model = Machine
        fields = [
            'id', 'nom', 'photo', 'type_machine', 'type_machine_libelle', 'localisation', 'zone_libelle', 'proprietaire',
        ]

    def get_photo(self, machine):
        return machine.photo.url if machine.photo else None


class ReservationSerializer(serializers.ModelSerializer):
    machine = _MachineResumeSerializer()
    agriculteur = _PersonneSerializer()
    statut_libelle = serializers.CharField(source='get_statut_display')
    unite_prix_libelle = serializers.CharField(source='get_unite_prix_display')
    messagerie_ouverte = serializers.SerializerMethodField()
    messages_non_lus = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            'id', 'machine', 'agriculteur', 'date_debut', 'date_fin', 'quantite',
            'prix_unitaire', 'unite_prix', 'unite_prix_libelle', 'montant_estime',
            'statut', 'statut_libelle', 'date_creation', 'date_reponse',
            'messagerie_ouverte', 'messages_non_lus',
        ]

    def get_messagerie_ouverte(self, reservation):
        return reservation.statut == Reservation.Statut.ACCEPTEE

    def get_messages_non_lus(self, reservation):
        # Annoté par ReservationViewSet (listes) ; 0 ailleurs, ex. juste après une acceptation.
        return getattr(reservation, 'messages_non_lus', 0)


class MessageSerializer(serializers.ModelSerializer):
    auteur = _PersonneSerializer(read_only=True)
    de_moi = serializers.SerializerMethodField()
    lu = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'auteur', 'de_moi', 'texte', 'date_envoi', 'lu']
        read_only_fields = ['date_envoi']
        extra_kwargs = {'texte': {'max_length': Message.LONGUEUR_MAX}}

    def get_de_moi(self, message):
        return message.auteur_id == self.context['request'].user.id

    def get_lu(self, message):
        return message.lu_le is not None


class CreationReservationSerializer(serializers.Serializer):
    machine = serializers.PrimaryKeyRelatedField(queryset=Machine.objects.select_related('proprietaire'))
    date_debut = serializers.DateField()
    quantite = serializers.DecimalField(max_digits=6, decimal_places=1, min_value=Decimal('0.5'))

    def validate_date_debut(self, date_debut):
        aujourdhui = timezone.localdate()
        if date_debut < aujourdhui:
            raise serializers.ValidationError('Choisissez une date à partir d’aujourd’hui.')
        if date_debut > aujourdhui + timedelta(days=HORIZON_JOURS):
            raise serializers.ValidationError('On ne peut pas réserver plus de 6 mois à l’avance.')
        return date_debut

    def validate(self, donnees):
        machine = donnees['machine']
        quantite = donnees['quantite']
        agriculteur = self.context['request'].user

        if not machine.disponible:
            raise serializers.ValidationError({'machine': 'Cette machine n’est plus proposée à la location.'})
        if machine.proprietaire_id == agriculteur.id:
            raise serializers.ValidationError({'machine': 'Vous ne pouvez pas réserver votre propre machine.'})

        if machine.unite_prix != Machine.UnitePrix.HECTARE and quantite != quantite.to_integral_value():
            raise serializers.ValidationError({'quantite': 'Indiquez un nombre entier.'})
        maximum = QUANTITE_MAX[machine.unite_prix]
        if quantite > maximum:
            raise serializers.ValidationError(
                {'quantite': f'Maximum {maximum} {machine.get_unite_prix_display()}s par demande.'}
            )

        date_fin = Reservation.calculer_date_fin(donnees['date_debut'], machine.unite_prix, quantite)
        chevauchements = Reservation.chevauchements(machine, donnees['date_debut'], date_fin)

        acceptee = chevauchements.filter(statut=Reservation.Statut.ACCEPTEE).order_by('date_debut').first()
        if acceptee:
            periode = acceptee.date_debut.strftime(_date_lisible)
            if acceptee.date_fin != acceptee.date_debut:
                periode = f'du {periode} au {acceptee.date_fin.strftime(_date_lisible)}'
            else:
                periode = f'le {periode}'
            raise serializers.ValidationError(
                {'date_debut': f'La machine est déjà réservée {periode}. Choisissez une autre date.'}
            )
        if chevauchements.filter(agriculteur=agriculteur, statut=Reservation.Statut.EN_ATTENTE).exists():
            raise serializers.ValidationError(
                {'date_debut': 'Vous avez déjà une demande en attente pour cette machine à ces dates.'}
            )

        donnees['date_fin'] = date_fin
        return donnees

    def create(self, donnees):
        machine = donnees['machine']
        return Reservation.objects.create(
            agriculteur=self.context['request'].user,
            machine=machine,
            date_debut=donnees['date_debut'],
            date_fin=donnees['date_fin'],
            quantite=donnees['quantite'],
            prix_unitaire=machine.prix,
            unite_prix=machine.unite_prix,
            montant_estime=Reservation.calculer_montant(machine.prix, donnees['quantite']),
        )
