# API Django (gunicorn). PostgreSQL est externe : l'image ne crée pas de base et ne lance pas les migrations.
# Mise en production : voir DEPLOIEMENT.md à la racine du projet.
#   docker build -t agrinyo-backend backend
#   docker run --rm --env-file backend/.env.production agrinyo-backend python manage.py migrate
#   docker run -d -p 8000:8000 --env-file backend/.env.production -v agrinyo-media:/app/media agrinyo-backend
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Aucun serveur web devant : Django sert aussi les photos envoyées.
    DJANGO_SERVIR_MEDIA=True \
    # Lus par gunicorn ; remplaçables dans le .env (WEB_CONCURRENCY, GUNICORN_CMD_ARGS).
    WEB_CONCURRENCY=3 \
    GUNICORN_CMD_ARGS="--timeout 60 --graceful-timeout 30"

WORKDIR /app
RUN useradd --create-home --uid 1000 agrinyo

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY --chown=agrinyo:agrinyo . .
# Fichiers statiques de l'admin, servis par WhiteNoise. Clé jetable, limitée à cette commande :
# la vraie clé arrive à l'exécution (DJANGO_SECRET_KEY). media/ reçoit les photos (volume conseillé).
RUN DJANGO_DEBUG=False DJANGO_SECRET_KEY=construction-seulement python manage.py collectstatic --noinput \
    && mkdir -p media && chown agrinyo:agrinyo media

USER agrinyo
EXPOSE 8000
# Santé : l'API répond et joint PostgreSQL (docker ps affiche healthy / unhealthy).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["python", "docker-healthcheck.py"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
