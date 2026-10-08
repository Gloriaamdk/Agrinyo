from django.db import transaction
from django.utils import timezone

from .backends import trouver_utilisateur
from .codes import DELAI_RENVOI, generer_code
from .models import CodeReinitialisation
from .sms import envoyer_sms


def demander_code(identifiant):
    """
    Envoie un code par SMS au compte correspondant, s'il existe.
    Ne dit rien quand il n'existe pas : la réponse de l'API doit rester la même.
    Lève ErreurEnvoiSms si le fournisseur refuse l'envoi.
    """
    utilisateur = trouver_utilisateur(identifiant)
    if utilisateur is None or not utilisateur.is_active or not utilisateur.telephone:
        return
    with transaction.atomic():
        precedent = CodeReinitialisation.objects.select_for_update().filter(utilisateur=utilisateur).first()
        if precedent and timezone.now() < precedent.cree_le + DELAI_RENVOI:
            return
        if precedent:
            precedent.delete()
        code, code_hache = generer_code()
        nouveau = CodeReinitialisation.objects.create(utilisateur=utilisateur, code_hache=code_hache)
    minutes = int(CodeReinitialisation.DUREE_VALIDITE.total_seconds() // 60)
    try:
        envoyer_sms(
            utilisateur.telephone,
            f'AgriLink : votre code est {code}. Il expire dans {minutes} minutes. Ne le communiquez à personne.',
        )
    except Exception:
        # Code jamais reçu, quelle que soit la panne : on permet de redemander tout de suite.
        nouveau.delete()
        raise
