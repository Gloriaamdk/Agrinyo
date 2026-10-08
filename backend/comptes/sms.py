"""
Envoi de SMS, choisi par le réglage SMS_BACKEND :

- « console » (développement) : le message est écrit dans le terminal de runserver ;
- « memoire » (tests) : le message est ajouté à `boite_envoi` ;
- « twilio » : envoi réel, avec TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM.
"""

import base64
import json
import logging
import sys
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

journal = logging.getLogger(__name__)

# Messages envoyés avec le backend « memoire » : (numéro, texte).
boite_envoi = []


class ErreurEnvoiSms(Exception):
    pass


def envoyer_sms(numero, texte):
    backend = getattr(settings, 'SMS_BACKEND', 'console')
    if backend == 'memoire':
        boite_envoi.append((numero, texte))
    elif backend == 'console':
        _afficher_console(f'\n[SMS -> {numero}] {texte}\n')
    elif backend == 'twilio':
        _envoyer_twilio(numero, texte)
    else:
        raise ErreurEnvoiSms(f'SMS_BACKEND inconnu : {backend!r}')


def _afficher_console(ligne):
    # Les terminaux Windows (cp1252, cp850…) ne connaissent pas tous les caractères : on remplace plutôt que planter.
    encodage = getattr(sys.stdout, 'encoding', None) or 'utf-8'
    print(ligne.encode(encodage, errors='replace').decode(encodage), flush=True)


def _envoyer_twilio(numero, texte):
    sid = settings.TWILIO_ACCOUNT_SID
    identifiants = base64.b64encode(f'{sid}:{settings.TWILIO_AUTH_TOKEN}'.encode()).decode()
    requete = urllib.request.Request(
        f'https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json',
        data=urllib.parse.urlencode({'To': numero, 'From': settings.TWILIO_FROM, 'Body': texte}).encode(),
        headers={'Authorization': f'Basic {identifiants}'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(requete, timeout=10) as reponse:
            json.load(reponse)
    except (urllib.error.URLError, TimeoutError, ValueError) as erreur:
        journal.exception('Échec de l’envoi du SMS à %s', numero)
        raise ErreurEnvoiSms(str(erreur)) from erreur
