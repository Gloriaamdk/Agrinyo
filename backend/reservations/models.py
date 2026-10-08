from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from machines.models import Machine


class Reservation(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = 'EN_ATTENTE', 'En attente'
        ACCEPTEE = 'ACCEPTEE', 'Acceptée'
        REFUSEE = 'REFUSEE', 'Refusée'
        ANNULEE = 'ANNULEE', 'Annulée'

    agriculteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reservations'
    )
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name='reservations')
    date_debut = models.DateField('date de début')
    # Calculée : date_debut + (jours - 1) pour une location à la journée, sinon le même jour.
    date_fin = models.DateField('date de fin')
    quantite = models.DecimalField(
        max_digits=6, decimal_places=1, validators=[MinValueValidator(Decimal('0.5'))]
    )
    # Prix figés au moment de la demande : un changement de tarif ne modifie pas une demande en cours.
    prix_unitaire = models.PositiveIntegerField('prix unitaire (FCFA)')
    unite_prix = models.CharField(max_length=10, choices=Machine.UnitePrix.choices)
    montant_estime = models.PositiveIntegerField('montant estimé (FCFA)')
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_reponse = models.DateTimeField('date de réponse', null=True, blank=True)

    class Meta:
        ordering = ['-date_creation']
        indexes = [models.Index(fields=['machine', 'statut', 'date_debut'])]

    def __str__(self):
        return f'{self.machine} — {self.agriculteur} — {self.date_debut}'

    @staticmethod
    def calculer_date_fin(date_debut, unite_prix, quantite):
        if unite_prix == Machine.UnitePrix.JOUR:
            return date_debut + timedelta(days=int(quantite) - 1)
        return date_debut

    @staticmethod
    def calculer_montant(prix_unitaire, quantite):
        return int((Decimal(prix_unitaire) * Decimal(quantite)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

    @classmethod
    def chevauchements(cls, machine, date_debut, date_fin):
        """Réservations de la machine dont la période touche [date_debut, date_fin]."""
        return cls.objects.filter(machine=machine, date_debut__lte=date_fin, date_fin__gte=date_debut)


class Message(models.Model):
    """
    Messagerie entre l'agriculteur et le propriétaire de la machine, une conversation par réservation.
    Ouverte seulement une fois la demande acceptée : les numéros de téléphone restent privés.
    """

    LONGUEUR_MAX = 1000

    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name='messages')
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages_envoyes')
    texte = models.TextField(max_length=LONGUEUR_MAX)
    date_envoi = models.DateTimeField("date d'envoi", auto_now_add=True)
    # Rempli quand le destinataire ouvre la conversation.
    lu_le = models.DateTimeField('lu le', null=True, blank=True)

    class Meta:
        ordering = ['date_envoi', 'id']
        indexes = [models.Index(fields=['reservation', 'lu_le'])]

    def __str__(self):
        return f'{self.auteur} — {self.texte[:40]}'
