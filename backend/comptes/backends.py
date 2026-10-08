from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.core.exceptions import ValidationError

from .telephone import normaliser_telephone

Utilisateur = get_user_model()


def trouver_utilisateur(identifiant):
    """
    Retrouve un compte à partir de ce que la personne a saisi :
    une adresse e-mail, un numéro togolais (sous n'importe quelle forme) ou un nom d'utilisateur.
    """
    identifiant = (identifiant or '').strip()
    if not identifiant:
        return None
    if '@' in identifiant:
        return Utilisateur.objects.filter(email__iexact=identifiant).first()
    try:
        telephone = normaliser_telephone(identifiant)
    except ValidationError:
        pass
    else:
        # Un nom d'utilisateur contient toujours une lettre : il ne peut pas ressembler à un numéro.
        return Utilisateur.objects.filter(telephone=telephone).first()
    return Utilisateur.objects.filter(username__iexact=identifiant).first()


class IdentifiantBackend(ModelBackend):
    """Connexion par nom d'utilisateur, e-mail ou numéro de téléphone (API et admin)."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(Utilisateur.USERNAME_FIELD)
        if username is None or password is None:
            return None
        utilisateur = trouver_utilisateur(username)
        if utilisateur is None:
            # Même durée de calcul qu'un vrai compte : on ne révèle pas qu'il n'existe pas.
            Utilisateur().set_password(password)
            return None
        if utilisateur.check_password(password) and self.user_can_authenticate(utilisateur):
            return utilisateur
        return None
