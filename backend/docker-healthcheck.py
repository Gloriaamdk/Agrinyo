"""Sonde Docker (HEALTHCHECK) : interroge /api/sante/ à l'intérieur du conteneur. Code 0 = en bonne santé."""
import os
import sys
import urllib.request

# Django refuse un Host absent de DJANGO_ALLOWED_HOSTS : on présente le premier autorisé.
hote = (os.environ.get('DJANGO_ALLOWED_HOSTS') or 'localhost').split(',')[0].strip().lstrip('.')
if hote in ('', '*'):
    hote = 'localhost'

requete = urllib.request.Request('http://127.0.0.1:8000/api/sante/', headers={'Host': hote})
try:
    with urllib.request.urlopen(requete, timeout=4) as reponse:
        sys.exit(0 if reponse.status == 200 else 1)
except Exception as erreur:  # noqa: BLE001 — toute erreur rend le conteneur « unhealthy »
    print(f'sonde : {erreur}', file=sys.stderr)
    sys.exit(1)
