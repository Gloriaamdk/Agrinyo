from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import Throttled

from .codes import DELAI_RENVOI, generer_code
from .models import CodeChangementTelephone
from .sms import envoyer_sms


def demander_changement(utilisateur, nouveau_telephone):
    """
    Envoie un code au nouveau numéro (déjà normalisé et vérifié libre).
    Un seul SMS par minute et par compte, quel que soit le numéro demandé : on ne peut pas
    se servir de ce formulaire pour envoyer des SMS à la chaîne.
    Lève ErreurEnvoiSms si le fournisseur refuse l'envoi.
    """
    with transaction.atomic():
        precedent = CodeChangementTelephone.objects.select_for_update().filter(utilisateur=utilisateur).first()
        if precedent:
            attente = (precedent.cree_le + DELAI_RENVOI - timezone.now()).total_seconds()
            if attente > 0:
                raise Throttled(wait=attente)
            precedent.delete()
        code, code_hache = generer_code()
        nouveau = CodeChangementTelephone.objects.create(
            utilisateur=utilisateur, nouveau_telephone=nouveau_telephone, code_hache=code_hache
        )
    minutes = int(CodeChangementTelephone.DUREE_VALIDITE.total_seconds() // 60)
    try:
        envoyer_sms(
            nouveau_telephone,
            f'AgriLink : code {code} pour utiliser ce numéro sur votre compte. Il expire dans {minutes} minutes.',
        )
    except Exception:
        nouveau.delete()
        raise
