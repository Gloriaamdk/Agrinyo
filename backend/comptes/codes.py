import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db.models import F

# Pas de nouveau SMS avant ce délai : évite les envois en rafale (et la facture qui va avec).
DELAI_RENVOI = timedelta(seconds=60)

MESSAGE_CODE_REFUSE = 'Code incorrect ou expiré. Vérifiez le SMS ou demandez un nouveau code.'


def generer_code():
    """Renvoie (code en clair à envoyer, code haché à enregistrer)."""
    code = f'{secrets.randbelow(1_000_000):06d}'
    return code, make_password(code)


def verifier_code(code_sms, saisie):
    """
    Vrai si `saisie` correspond au code encore valable `code_sms` (un CodeSms ou None).
    Un essai faux est compté ; au 5e, le code ne marche plus.
    """
    if code_sms is None or code_sms.expire:
        return False
    if check_password(saisie.replace(' ', ''), code_sms.code_hache):
        return True
    type(code_sms).objects.filter(pk=code_sms.pk).update(essais=F('essais') + 1)
    return False
