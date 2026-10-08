from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Utilisateur(AbstractUser):
    """
    On se connecte avec son nom d'utilisateur, son e-mail ou son numéro de
    téléphone : voir comptes.backends.IdentifiantBackend.
    Les comptes créés avant les noms d'utilisateur ont pour `username` leur
    numéro normalisé (+228XXXXXXXX).
    """

    class TypeUtilisateur(models.TextChoices):
        AGRICULTEUR = 'AGRICULTEUR', 'Agriculteur'
        DETENTEUR = 'DETENTEUR', 'Propriétaire de machine'

    # Facultatif : NULL plutôt que '' pour que plusieurs comptes puissent s'en passer.
    email = models.EmailField('adresse e-mail', unique=True, null=True, blank=True)
    telephone = models.CharField('téléphone', max_length=20, unique=True, null=True, blank=True)
    type_utilisateur = models.CharField(
        "type d'utilisateur",
        max_length=20,
        choices=TypeUtilisateur.choices,
        default=TypeUtilisateur.AGRICULTEUR,
    )
    localisation = models.CharField(max_length=100, blank=True)
    # Réduite à 512 px à l'envoi (comptes.photos) : léger à charger sur un réseau mobile.
    photo = models.ImageField('photo de profil', upload_to='profils/', blank=True)

    class Meta:
        verbose_name = 'utilisateur'

    def save(self, *args, **kwargs):
        # L'admin envoie '' pour un e-mail vide ; les e-mails se comparent en minuscules.
        self.email = self.email.strip().lower() if self.email else None
        super().save(*args, **kwargs)

    @property
    def nom_complet(self):
        return self.get_full_name() or self.username

    @property
    def est_agriculteur(self):
        return self.type_utilisateur == self.TypeUtilisateur.AGRICULTEUR

    @property
    def est_detenteur(self):
        return self.type_utilisateur == self.TypeUtilisateur.DETENTEUR


class CodeSms(models.Model):
    """Code à 6 chiffres envoyé par SMS : valable 10 minutes et 5 essais (voir comptes.codes)."""

    DUREE_VALIDITE = timedelta(minutes=10)
    ESSAIS_MAX = 5

    # Haché comme un mot de passe : une fuite de la base ne donne pas les codes.
    code_hache = models.CharField(max_length=128)
    cree_le = models.DateTimeField(auto_now_add=True)
    essais = models.PositiveSmallIntegerField(default=0)

    class Meta:
        abstract = True

    @property
    def expire(self):
        return timezone.now() > self.cree_le + self.DUREE_VALIDITE or self.essais >= self.ESSAIS_MAX


class CodeReinitialisation(CodeSms):
    """Code pour choisir un nouveau mot de passe (un seul actif par compte)."""

    utilisateur = models.OneToOneField(Utilisateur, on_delete=models.CASCADE, related_name='code_reinitialisation')

    class Meta:
        verbose_name = 'code de réinitialisation'


class CodeChangementTelephone(CodeSms):
    """Code envoyé au NOUVEAU numéro : le numéro du compte ne change qu'une fois ce code saisi."""

    utilisateur = models.OneToOneField(
        Utilisateur, on_delete=models.CASCADE, related_name='code_changement_telephone'
    )
    nouveau_telephone = models.CharField(max_length=20)

    class Meta:
        verbose_name = 'code de changement de téléphone'
