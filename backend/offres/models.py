from django.conf import settings
from django.db import models

from machines.models import Machine


class Offre(models.Model):
    """
    Un agriculteur cherche une machine qui n'est pas (encore) sur la plateforme.
    Les propriétaires répondent en proposant une de leurs machines, existante ou ajoutée pour l'occasion.
    """

    class Statut(models.TextChoices):
        OUVERTE = 'OUVERTE', 'Ouverte'
        FERMEE = 'FERMEE', 'Fermée'

    LONGUEUR_MAX = 1000
    # Au-delà, l'agriculteur ferme d'abord une offre : la liste des propriétaires reste lisible.
    OUVERTES_MAX = 5

    agriculteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='offres')
    type_machine = models.CharField('type de machine', max_length=20, choices=Machine.TypeMachine.choices)
    description = models.TextField('besoin', max_length=LONGUEUR_MAX)
    zone = models.CharField(max_length=20, choices=Machine.Zone.choices)
    localisation = models.CharField('ville / localité', max_length=100)
    date_souhaitee = models.DateField('date souhaitée', null=True, blank=True)
    budget = models.PositiveIntegerField('budget (FCFA)', null=True, blank=True)
    unite_budget = models.CharField(
        'unité du budget', max_length=10, choices=Machine.UnitePrix.choices, default=Machine.UnitePrix.JOUR
    )
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERTE)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_creation']
        indexes = [models.Index(fields=['statut', 'zone', 'type_machine'])]

    def __str__(self):
        return f'{self.get_type_machine_display()} — {self.localisation} ({self.agriculteur})'


class Proposition(models.Model):
    """Réponse d'un propriétaire : une de ses machines pour cette offre."""

    LONGUEUR_MAX = 500

    offre = models.ForeignKey(Offre, on_delete=models.CASCADE, related_name='propositions')
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name='propositions')
    message = models.TextField(max_length=LONGUEUR_MAX, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    # Rempli quand l'agriculteur affiche ses offres : sert à la pastille « nouvelles propositions ».
    vue_le = models.DateTimeField('vue le', null=True, blank=True)

    class Meta:
        ordering = ['date_creation', 'id']
        constraints = [
            models.UniqueConstraint(fields=['offre', 'machine'], name='une_proposition_par_machine_et_offre'),
        ]

    def __str__(self):
        return f'{self.machine} → {self.offre}'
