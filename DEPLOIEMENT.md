# Mise en production d'AgriLink (Docker)

Deux conteneurs : **backend** (API Django, port 8000) et **frontend** (site React, port 3000).
La base PostgreSQL est **externe** (hébergeur ou serveur à part) et le **HTTPS** est assuré par le proxy
ou l'hébergeur placé devant les conteneurs.

## 1. Prérequis

- Un serveur avec Docker et Docker Compose v2 (`docker compose version`).
- Une base PostgreSQL 14 ou plus, vide, avec un utilisateur qui en est propriétaire.
- Deux noms de domaine pointant vers le serveur, par exemple `app.exemple.tg` (site) et `api.exemple.tg` (API),
  et un proxy HTTPS (Caddy, Traefik, nginx, ou celui de l'hébergeur).

## 2. Configuration

### `backend/.env.production` (secret, jamais commité)

Le fichier existe déjà, avec une clé secrète générée. Remplacer :

| Variable | Valeur |
|---|---|
| `DJANGO_ALLOWED_HOSTS` | domaine de l'API, ex. `api.agrilink.tg` |
| `DATABASE_URL` **ou** `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | accès à la base ; `DB_SSLMODE=require` pour une base hébergée |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | adresse du site, ex. `https://app.agrilink.tg` |
| `DJANGO_COOKIES_SAMESITE` | `Lax` si site et API partagent un domaine (`app.` / `api.`), `None` sinon |
| `SMS_BACKEND`, `TWILIO_*` | `twilio` et les identifiants Twilio pour envoyer de vrais SMS |

Pas de guillemets autour des valeurs : Docker les garderait tels quels.
Sur un nouveau serveur, partir de `backend/.env.example` et générer une clé :
`python -c "import secrets; print(secrets.token_urlsafe(50))"`.

### `frontend/.env.production` (public)

`VITE_API_URL=https://api.agrilink.tg` : adresse de l'API, figée dans le site **à la construction**.
Après un changement, reconstruire l'image du frontend.
Vide si le site et l'API sont servis sur le même domaine (le proxy envoie alors `/api`, `/admin`, `/static`
et `/media` au backend).

## 3. Premier déploiement

```bash
docker compose build
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py createsuperuser   # compte d'administration (/admin)
docker compose up -d
docker compose ps        # backend : « healthy » au bout de ~30 s
```

Proxy HTTPS : `api.agrilink.tg` → `127.0.0.1:8000`, `app.agrilink.tg` → `127.0.0.1:3000`.
Le proxy doit transmettre l'en-tête `X-Forwarded-Proto` (fait par défaut par Caddy, Traefik et les hébergeurs).

## 4. Vérifications

```bash
curl https://api.agrilink.tg/api/sante/                                  # {"statut": "ok"}
docker compose run --rm backend python manage.py check --deploy          # avertissements de sécurité
docker compose logs -f backend                                           # requêtes et erreurs
```

Puis, dans le navigateur : créer un compte, publier une machine avec photo, faire une réservation.

## 5. Mises à jour

```bash
git pull
docker compose build
docker compose run --rm backend python manage.py migrate
docker compose up -d
```

Les migrations ne se lancent **jamais** toutes seules : les exécuter à chaque mise à jour du backend.

## 6. Sauvegardes

- **Base** : sauvegarde de l'hébergeur, ou `pg_dump` régulier.
- **Photos** (volume `agrinyo-media`) :
  `docker run --rm -v agrinyo_agrinyo-media:/media -v "$PWD":/sauvegarde alpine tar czf /sauvegarde/media.tgz -C /media .`
  (le nom exact du volume est donné par `docker volume ls`).

## 7. Après validation

- Passer `DJANGO_HSTS_SECONDS` de `3600` à `31536000` (un an) dans `backend/.env.production`,
  puis `docker compose up -d`.
- Ajuster `WEB_CONCURRENCY` (processus gunicorn) : environ 2 × nombre de cœurs + 1.
