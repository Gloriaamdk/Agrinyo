from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import Throttled

from .codes import DELAI_RENVOI, generer_code
from .envoi_code import envoyer_code, texte_email
from .models import CodeChangementTelephone


def demander_changement(utilisateur, nouveau_telephone):
    """
    Envoie un code de confirmation (numéro déjà normalisé et vérifié libre) : par SMS au nouveau numéro,
    ou par e-mail à l'adresse du compte (OTP_CANAL).
    Un seul envoi par minute et par compte, quel que soit le numéro demandé : on ne peut pas
    se servir de ce formulaire pour envoyer des messages à la chaîne.
    Lève ErreurEnvoiCode si l'envoi échoue.
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
        envoyer_code(
            utilisateur,
            telephone=nouveau_telephone,
            sujet=f'AgriLink : votre code {code}',
            texte_email=texte_email(utilisateur, (
                f'Votre code pour utiliser le numéro {nouveau_telephone} sur votre compte : {code}\n'
                f'Il expire dans {minutes} minutes.\n\n'
                "Si vous n'avez rien demandé, ignorez ce message : votre numéro ne change pas."
            )),
            texte_sms=f'AgriLink : code {code} pour utiliser ce numéro sur votre compte. Il expire dans {minutes} minutes.',
        )
    except Exception:
        nouveau.delete()
        raise
