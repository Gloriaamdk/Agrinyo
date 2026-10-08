import re

from django.core.exceptions import ValidationError

INDICATIF_TOGO = '228'


def normaliser_telephone(saisie):
    """
    Ramène un numéro togolais au format international « +228XXXXXXXX ».

    Accepte « 90 12 34 56 », « 90123456 », « +228 90 12 34 56 » ou « 00228 90123456 ».
    """
    chiffres = re.sub(r'\D', '', saisie or '')
    # « 00 » = préfixe international (00228…), mais pas pour un numéro local à 8 chiffres.
    if chiffres.startswith('00') and len(chiffres) > 8:
        chiffres = chiffres[2:]
    if len(chiffres) == 8:
        chiffres = INDICATIF_TOGO + chiffres
    if not (len(chiffres) == 11 and chiffres.startswith(INDICATIF_TOGO)):
        raise ValidationError('Entrez un numéro togolais à 8 chiffres, par exemple 90 12 34 56.')
    return '+' + chiffres
