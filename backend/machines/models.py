from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Machine(models.Model):
    class TypeMachine(models.TextChoices):
        TRACTEUR = 'TRACTEUR', 'Tracteur'
        MOTOCULTEUR = 'MOTOCULTEUR', 'Motoculteur'
        MOISSONNEUSE = 'MOISSONNEUSE', 'Moissonneuse'
        BATTEUSE = 'BATTEUSE', 'Batteuse'
        DECORTIQUEUSE = 'DECORTIQUEUSE', 'Décortiqueuse'
        PULVERISATEUR = 'PULVERISATEUR', 'Pulvérisateur'
        SEMOIR = 'SEMOIR', 'Semoir'
        CHARRUE = 'CHARRUE', 'Charrue'
        MOTOPOMPE = 'MOTOPOMPE', 'Motopompe'

    class Zone(models.TextChoices):
        # Les cinq régions administratives du Togo, du sud au nord.
        MARITIME = 'MARITIME', 'Maritime'
        PLATEAUX = 'PLATEAUX', 'Plateaux'
        CENTRALE = 'CENTRALE', 'Centrale'
        KARA = 'KARA', 'Kara'
        SAVANES = 'SAVANES', 'Savanes'

    class UnitePrix(models.TextChoices):
        JOUR = 'JOUR', 'jour'
        HEURE = 'HEURE', 'heure'
        HECTARE = 'HECTARE', 'hectare'

    proprietaire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='machines',
        verbose_name='propriétaire',
    )
    nom = models.CharField(max_length=120)
    type_machine = models.CharField('type de machine', max_length=20, choices=TypeMachine.choices)
    description = models.TextField(blank=True)
    photo = models.ImageField(upload_to='machines/', blank=True)
    credit_photo = models.CharField('crédit photo', max_length=200, blank=True)
    prix = models.PositiveIntegerField('prix (FCFA)')
    unite_prix = models.CharField('unité de prix', max_length=10, choices=UnitePrix.choices, default=UnitePrix.JOUR)
    zone = models.CharField(max_length=20, choices=Zone.choices)
    localisation = models.CharField('ville / localité', max_length=100)
    disponible = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_creation']

    def __str__(self):
        return self.nom


class Avis(models.Model):
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name='avis')
    auteur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='avis')
    note = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    commentaire = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'avis'
        ordering = ['-date_creation']
        constraints = [
            models.UniqueConstraint(fields=['machine', 'auteur'], name='un_avis_par_auteur_et_machine'),
        ]

    def __str__(self):
        return f'{self.machine} — {self.note}/5'
