from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from machines.models import Machine
from machines.serializers import MachineSerializer

from .models import Offre, Proposition

HORIZON_JOURS = 180


class _AgriculteurSerializer(serializers.Serializer):
    # Prénom seulement : l'offre est visible par tous les propriétaires.
    prenom = serializers.CharField(source='first_name')


class OffreSerializer(serializers.ModelSerializer):
    """Offre vue par un propriétaire (liste des offres ouvertes)."""

    agriculteur = _AgriculteurSerializer(read_only=True)
    type_machine_libelle = serializers.CharField(source='get_type_machine_display', read_only=True)
    zone_libelle = serializers.CharField(source='get_zone_display', read_only=True)
    unite_budget_libelle = serializers.CharField(source='get_unite_budget_display', read_only=True)
    statut_libelle = serializers.CharField(source='get_statut_display', read_only=True)
    # Annoté par OffreViewSet.get_queryset.
    nombre_propositions = serializers.IntegerField(read_only=True)
    mes_machines_proposees = serializers.SerializerMethodField()

    class Meta:
        model = Offre
        fields = [
            'id', 'agriculteur', 'type_machine', 'type_machine_libelle', 'description', 'zone', 'zone_libelle',
            'localisation', 'date_souhaitee', 'budget', 'unite_budget', 'unite_budget_libelle',
            'statut', 'statut_libelle', 'date_creation', 'nombre_propositions', 'mes_machines_proposees',
        ]

    def get_mes_machines_proposees(self, offre):
        """Machines du propriétaire connecté déjà proposées pour cette offre."""
        utilisateur = self.context['request'].user
        return [p.machine_id for p in offre.propositions.all() if p.machine.proprietaire_id == utilisateur.id]


class PropositionSerializer(serializers.ModelSerializer):
    machine = MachineSerializer(read_only=True)
    nouvelle = serializers.SerializerMethodField()

    class Meta:
        model = Proposition
        fields = ['id', 'machine', 'message', 'date_creation', 'nouvelle']

    def get_nouvelle(self, proposition):
        return proposition.vue_le is None


class MonOffreSerializer(OffreSerializer):
    """Offre vue par l'agriculteur qui l'a lancée, avec les machines proposées."""

    propositions = PropositionSerializer(many=True, read_only=True)

    class Meta(OffreSerializer.Meta):
        fields = [f for f in OffreSerializer.Meta.fields if f != 'mes_machines_proposees'] + ['propositions']


class CreationOffreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offre
        fields = ['type_machine', 'description', 'zone', 'localisation', 'date_souhaitee', 'budget', 'unite_budget']
        extra_kwargs = {
            'description': {'allow_blank': False, 'max_length': Offre.LONGUEUR_MAX},
            'localisation': {'allow_blank': False},
            'budget': {'min_value': 1},
        }

    def validate_description(self, valeur):
        valeur = valeur.strip()
        if not valeur:
            raise serializers.ValidationError('Décrivez votre besoin en quelques mots.')
        return valeur

    def validate_localisation(self, valeur):
        return valeur.strip()

    def validate_date_souhaitee(self, date):
        if date is None:
            return date
        aujourdhui = timezone.localdate()
        if date < aujourdhui:
            raise serializers.ValidationError('Choisissez une date à partir d’aujourd’hui.')
        if date > aujourdhui + timedelta(days=HORIZON_JOURS):
            raise serializers.ValidationError('Choisissez une date dans les 6 prochains mois.')
        return date

    def validate(self, donnees):
        agriculteur = self.context['request'].user
        if agriculteur.offres.filter(statut=Offre.Statut.OUVERTE).count() >= Offre.OUVERTES_MAX:
            raise serializers.ValidationError(
                f'Vous avez déjà {Offre.OUVERTES_MAX} offres ouvertes. Fermez-en une avant d’en lancer une autre.'
            )
        return donnees


class CreationPropositionSerializer(serializers.Serializer):
    machine = serializers.PrimaryKeyRelatedField(queryset=Machine.objects.all())
    message = serializers.CharField(max_length=Proposition.LONGUEUR_MAX, required=False, allow_blank=True)

    def validate_machine(self, machine):
        if machine.proprietaire_id != self.context['request'].user.id:
            raise serializers.ValidationError('Choisissez une de vos machines.')
        if not machine.disponible:
            raise serializers.ValidationError('Rendez d’abord cette machine disponible : l’agriculteur pourra la réserver.')
        return machine

    def validate(self, donnees):
        offre = self.context['offre']
        if offre.statut != Offre.Statut.OUVERTE:
            raise serializers.ValidationError('Cette offre est fermée.')
        if offre.propositions.filter(machine=donnees['machine']).exists():
            raise serializers.ValidationError({'machine': 'Vous avez déjà proposé cette machine pour cette offre.'})
        return donnees

    def create(self, donnees):
        return Proposition.objects.create(
            offre=self.context['offre'], machine=donnees['machine'], message=donnees.get('message', '').strip()
        )
