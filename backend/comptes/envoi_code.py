"""
Envoi des codes à usage unique (mot de passe oublié, changement de numéro), par le canal du réglage OTP_CANAL :

- « email » : à l'adresse e-mail du compte, par le serveur SMTP de MAILERS (console en développement) ;
- « sms » : par SMS (voir comptes/sms.py et SMS_BACKEND).

Le code lui-même ne dépend pas du canal : voir comptes/codes.py.
"""

import logging
import smtplib

from django.conf import settings
from django.core.mail import send_mail

from .sms import ErreurEnvoiSms, envoyer_sms, masquer

journal = logging.getLogger(__name__)

EMAIL = 'email'
SMS = 'sms'


class ErreurEnvoiCode(Exception):
    """Le code n'a pas pu partir (serveur SMTP ou fournisseur SMS en panne, configuration incomplète)."""


def canal():
    return settings.OTP_CANAL


def masquer_email(adresse):
    """kossi.agbeko@gmail.com -> k***o@gmail.com"""
    nom, _, domaine = adresse.partition('@')
    nom = f'{nom[0]}***{nom[-1]}' if len(nom) > 2 else f'{nom[:1]}***'
    return f'{nom}@{domaine}'


def destinataire(utilisateur, telephone=None):
    """Adresse ou numéro qui recevra le code ; None si le compte n'en a pas pour le canal choisi."""
    if canal() == SMS:
        return telephone or utilisateur.telephone
    return utilisateur.email


def destinataire_masque(utilisateur, telephone=None):
    adresse = destinataire(utilisateur, telephone)
    if not adresse:
        return None
    return masquer(adresse) if canal() == SMS else masquer_email(adresse)


def envoyer_code(utilisateur, *, sujet, texte_email, texte_sms, telephone=None):
    """
    Envoie le code par le canal choisi. `telephone` : numéro à utiliser par SMS (sinon celui du compte).
    Lève ErreurEnvoiCode si l'envoi échoue.
    """
    adresse = destinataire(utilisateur, telephone)
    if canal() == SMS:
        try:
            envoyer_sms(adresse, texte_sms)
        except ErreurEnvoiSms as erreur:
            raise ErreurEnvoiCode(str(erreur)) from erreur
        return
    try:
        send_mail(sujet, texte_email, None, [adresse])
    except (smtplib.SMTPException, OSError) as erreur:
        journal.error('E-mail non envoyé à %s : %s', masquer_email(adresse), erreur)
        raise ErreurEnvoiCode(str(erreur)) from erreur


def texte_email(utilisateur, corps):
    """Message complet : salutation, corps, signature."""
    salutation = f'Bonjour {utilisateur.first_name},' if utilisateur.first_name else 'Bonjour,'
    return f"{salutation}\n\n{corps}\n\nL'équipe AgriLink\n"
