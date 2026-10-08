from django.utils import timezone
from rest_framework import serializers

from comptes.photos import COTE_MACHINE_PX, preparer_photo
from reservations.models import Reservation

from .models import Machine


class ProprietaireSerializer(serializers.Serializer):
    # Pas de téléphone : aucun numéro n'est montré aux autres utilisateurs, même après une réservation acceptée.
    id = serializers.IntegerField()
    nom = serializers.CharField(source='nom_complet')
    photo = serializers.SerializerMethodField()

    def get_photo(self, proprietaire):
        return proprietaire.photo.url if proprietaire.photo else None


class MachineSerializer(serializers.ModelSerializer):
    proprietaire = ProprietaireSerializer(read_only=True)
    # Chemin relatif (/media/…) : l'URL absolue pointerait vers l'hôte interne
    # derrière le proxy et ne marcherait pas depuis un téléphone.
    photo = serializers.SerializerMethodField()
    type_machine_libelle = serializers.CharField(source='get_type_machine_display', read_only=True)
    zone_libelle = serializers.CharField(source='get_zone_display', read_only=True)
    unite_prix_libelle = serializers.CharField(source='get_unite_prix_display', read_only=True)

    class Meta:
        model = Machine
        fields = [
            'id', 'nom', 'type_machine', 'type_machine_libelle', 'description', 'photo', 'credit_photo',
            'prix', 'unite_prix', 'unite_prix_libelle', 'zone', 'zone_libelle', 'localisation',
            # Notes et avis : hors périmètre V1, ni lus ni écrits par l'API (modèle Avis gardé pour la V2).
            'disponible', 'proprietaire', 'date_creation',
        ]

    def get_photo(self, machine):
        return machine.photo.url if machine.photo else None


class MachineDetailSerializer(MachineSerializer):
    periodes_reservees = serializers.SerializerMethodField()

    class Meta(MachineSerializer.Meta):
        fields = MachineSerializer.Meta.fields + ['periodes_reservees']

    def get_periodes_reservees(self, machine):
        """Périodes déjà acceptées à venir, pour griser ces dates dans le formulaire."""
        periodes = machine.reservations.filter(
            statut=Reservation.Statut.ACCEPTEE, date_fin__gte=timezone.localdate()
        ).order_by('date_debut').values('date_debut', 'date_fin')
        return [{'debut': p['date_debut'], 'fin': p['date_fin']} for p in periodes]


class BooleenAbsentParDefaut(serializers.BooleanField):
    """
    En multipart, DRF lit un booléen absent comme une case HTML décochée (False).
    Ici, absent = valeur par défaut : une machine envoyée avec sa photo reste disponible.
    """

    default_empty_html = serializers.empty


class MachineEcritureSerializer(serializers.ModelSerializer):
    """
    Création et modification par le propriétaire (JSON, ou multipart avec une photo).
    La réponse reprend MachineSerializer (voir MachineViewSet).
    """

    disponible = BooleenAbsentParDefaut(required=False, default=True)
    photo = serializers.FileField(required=False, write_only=True)
    supprimer_photo = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = Machine
        fields = [
            'nom', 'type_machine', 'description', 'photo', 'supprimer_photo',
            'prix', 'unite_prix', 'zone', 'localisation', 'disponible',
        ]
        extra_kwargs = {
            'nom': {'allow_blank': False},
            'localisation': {'allow_blank': False},
            'prix': {'min_value': 1},
        }

    def validate_nom(self, valeur):
        return valeur.strip()

    def validate_localisation(self, valeur):
        return valeur.strip()

    def validate_photo(self, fichier):
        return preparer_photo(fichier, COTE_MACHINE_PX)

    def _ranger_photo(self, machine, nouvelle_photo, supprimer):
        if (nouvelle_photo or supprimer) and machine.photo:
            machine.photo.delete(save=False)
            # Le crédit décrivait l'ancienne photo (photos de démonstration).
            machine.credit_photo = ''
        if nouvelle_photo:
            machine.photo.save(nouvelle_photo.name, nouvelle_photo, save=False)

    def create(self, donnees):
        nouvelle_photo = donnees.pop('photo', None)
        donnees.pop('supprimer_photo', None)
        machine = Machine(**donnees)
        self._ranger_photo(machine, nouvelle_photo, False)
        machine.save()
        return machine

    def update(self, machine, donnees):
        self._ranger_photo(machine, donnees.pop('photo', None), donnees.pop('supprimer_photo', False))
        return super().update(machine, donnees)


class MaMachineSerializer(MachineSerializer):
    """Liste « Mes machines » : en plus, le nombre de demandes à traiter."""

    demandes_en_attente = serializers.IntegerField(read_only=True)

    class Meta(MachineSerializer.Meta):
        fields = MachineSerializer.Meta.fields + ['demandes_en_attente']
