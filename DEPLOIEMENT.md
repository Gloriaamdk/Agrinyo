# Mise en production d'AgriLink (Coolify)

Coolify héberge trois ressources dans un même projet :

| Ressource | Source | Rôle |
|---|---|---|
| **PostgreSQL** | base Coolify | données |
| **agrilink-api** | dépôt GitHub, `backend/Dockerfile` | API Django (port 8000), migrations au démarrage |
| **agrilink-site** | dépôt GitHub, `frontend/Dockerfile` | site React (port 3000) |

Coolify fournit le HTTPS et les domaines, et reconstruit à chaque push sur `master`.
GitHub Actions (`.github/workflows/ci.yml`) lance seulement les tests, sur les pull requests et sur `master`.

L'adresse de l'API est **figée dans le site à la construction** (`VITE_API_URL`) : l'API se crée en premier.

## 1. Base de données

**Projects → (ton projet) → + New → Database → PostgreSQL**, puis **Start**.
Copier l'adresse **Postgres URL (internal)** (`postgres://…@…:5432/…`). Ne pas la rendre publique.

## 2. API (`agrilink-api`)

**+ New → Private Repository (with GitHub App)** : installer l'app GitHub de Coolify sur le dépôt `Agrinyo`
(le redéploiement automatique à chaque push en dépend ; « Public Repository » ne le fait pas).

| Champ | Valeur |
|---|---|
| Branch | `master` |
| Build Pack | `Dockerfile` |
| Base Directory | `/backend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `8000` |
| Domains | garder l'adresse générée, **en remplaçant `http://` par `https://`** |
| Watch Paths (facultatif) | `backend/**` : ne reconstruit pas l'API quand seul le site change |

**Persistent Storage → + Add** : volume, destination `/app/media` (photos envoyées ; à sauvegarder).

**Environment Variables → Developer view**, coller puis remplir (`<…>` à remplacer) :

```env
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<celle de backend/.env.production, ou une nouvelle longue chaîne aléatoire>
DJANGO_ALLOWED_HOSTS=<domaine de l'API sans https://, ex. abc123.1.2.3.4.sslip.io>
DATABASE_URL=<Postgres URL (internal) de l'étape 1>
DJANGO_CSRF_TRUSTED_ORIGINS=<adresse du site, à remplir à l'étape 3>
DJANGO_COOKIES_SAMESITE=Lax
DJANGO_HTTPS=True
DJANGO_HSTS_SECONDS=3600
DJANGO_NUM_PROXIES=1
DJANGO_SERVIR_MEDIA=True
WEB_CONCURRENCY=3
OTP_CANAL=email
EMAIL_BACKEND=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=<adresse Gmail>
EMAIL_HOST_PASSWORD=<mot de passe d'application Gmail>
DEFAULT_FROM_EMAIL=AgriLink <adresse Gmail>
```

Pas de guillemets autour des valeurs. **Deploy**, puis vérifier dans le navigateur :
`https://<domaine de l'API>/api/sante/` → `{"statut": "ok"}`.

## 3. Site (`agrilink-site`)

**+ New → Private Repository (with GitHub App)**, même dépôt :

| Champ | Valeur |
|---|---|
| Branch | `master` |
| Build Pack | `Dockerfile` |
| Base Directory | `/frontend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Domains | adresse générée, **`https://`** |
| Watch Paths (facultatif) | `frontend/**` |

**Environment Variables** : une seule, cochée **Build Variable** (selon la version : « Available at Buildtime ») :

```env
VITE_API_URL=https://<domaine de l'API>
```

Sans `/` final. Sans cette case cochée, l'image refuse de se construire (adresse d'exemple).

**Deploy**. Puis, dans **agrilink-api** : `DJANGO_CSRF_TRUSTED_ORIGINS=https://<domaine du site>`, et **Redeploy**
(sinon la connexion et toutes les écritures sont refusées).

## 4. Premier lancement

1. **agrilink-api → Terminal** : `python manage.py createsuperuser` (compte d'administration, une fois).
2. Même terminal : `python manage.py tester_email ton.adresse@gmail.com` (envoi des codes).
3. Ouvrir le site : créer un compte, publier une machine avec photo, faire une réservation.

## 5. Passer à ton propre domaine

DNS : deux enregistrements `A` vers l'IP du serveur Coolify, par exemple `app.agrilink.tg` et `api.agrilink.tg`. Puis :

1. **agrilink-api** : Domains `https://api.agrilink.tg` ; `DJANGO_ALLOWED_HOSTS=api.agrilink.tg` ;
   `DJANGO_CSRF_TRUSTED_ORIGINS=https://app.agrilink.tg` ; Redeploy.
2. **agrilink-site** : Domains `https://app.agrilink.tg` ; `VITE_API_URL=https://api.agrilink.tg` ; Redeploy
   (reconstruction obligatoire : l'adresse est figée dans le site).

`DJANGO_COOKIES_SAMESITE=Lax` convient tant que site et API partagent un domaine (`app.` / `api.`) ;
`None` s'ils sont sur deux domaines sans rapport.

## 6. Gmail (envoi des codes par e-mail)

1. Utiliser de préférence un compte Gmail dédié (ex. `agrilink.togo@gmail.com`) plutôt qu'un compte personnel.
2. Activer la **validation en deux étapes** : <https://myaccount.google.com/security>.
3. Créer un **mot de passe d'application** nommé « AgriLink » : <https://myaccount.google.com/apppasswords>.
   Google affiche 16 lettres ; les espaces sont retirés automatiquement.
4. Le mettre dans `EMAIL_HOST_PASSWORD` (agrilink-api), l'adresse dans `EMAIL_HOST_USER` et `DEFAULT_FROM_EMAIL`.

Limite : environ 500 e-mails par jour. Au-delà, passer à Google Workspace, à un service d'envoi (Brevo…)
ou au SMS (`OTP_CANAL=sms`). Si le mot de passe d'application est révoqué, l'envoi des codes échoue (503).

## 7. Au quotidien

- **Mettre à jour** : fusionner dans `master`. Coolify reconstruit ; l'API applique les migrations avant de servir.
  Coolify n'attend pas la CI : fusionner seulement une pull request dont les tests passent.
- **Revenir en arrière** : **Deployments** de la ressource → un déploiement précédent → **Redeploy**.
  Attention aux migrations déjà appliquées.
- **Journaux** : onglet **Logs** de la ressource.
- **Changer un réglage** : Environment Variables, puis **Redeploy** (et pour le site, toujours reconstruire).

## 8. Sauvegardes

- **Base** : PostgreSQL → **Backups** → planifier (ex. chaque nuit), idéalement vers un stockage S3.
- **Photos** : volume `/app/media` de agrilink-api (**Persistent Storage** affiche son nom sur le serveur).

## 9. Après validation

- Passer `DJANGO_HSTS_SECONDS` de `3600` à `31536000` (un an), puis Redeploy.
- Ajuster `WEB_CONCURRENCY` (processus gunicorn) : environ 2 × nombre de cœurs + 1.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Construction du site : « VITE_API_URL vaut encore l'adresse d'exemple » | variable absente ou case Build Variable non cochée |
| API : `Bad Request (400)` | domaine de l'API absent de `DJANGO_ALLOWED_HOSTS` |
| Site : connexion refusée, « CSRF » | domaine du site absent de `DJANGO_CSRF_TRUSTED_ORIGINS`, ou domaines en `http://` |
| Site : « impossible de joindre le serveur » | `VITE_API_URL` faux (site à reconstruire), ou API arrêtée |
| API « unhealthy », journaux : base injoignable | `DATABASE_URL` : prendre l'adresse **internal** de PostgreSQL |
| Certificat HTTPS absent sur l'adresse sslip.io | limite Let's Encrypt : attendre, ou passer à ton domaine |

## Annexe : sans Coolify

À la racine du dépôt, sur un serveur avec Docker et un proxy HTTPS (`docker-compose.yml`,
réglages dans `backend/.env.production`, adresse de l'API dans `frontend/.env.production`) :

```bash
docker compose build
docker compose up -d
```
