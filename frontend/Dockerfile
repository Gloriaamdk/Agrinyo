# Site React construit, servi tel quel sur le port 3000. Mise en production : voir DEPLOIEMENT.md.
#   docker build -t agrinyo-frontend frontend
#   docker run -d -p 3000:3000 agrinyo-frontend
# Adresse de l'API : VITE_API_URL dans frontend/.env.production, lue à la construction (figée dans le site).
# Un --build-arg VITE_API_URL=… la remplace. Vide : l'API est sur le même domaine que le site.

# --- Construction ---
FROM node:24-alpine AS construction
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=
# Argument vide : on le retire pour que Vite lise .env.production au lieu d'une valeur vide.
# Adresse d'exemple : construction refusée, sinon le site part en ligne sans pouvoir joindre l'API.
RUN if [ -z "$VITE_API_URL" ]; then unset VITE_API_URL; fi \
    && npm run build \
    && if grep -rqE 'exemple\.tg|A_REMPLIR' dist/assets; then \
         echo "VITE_API_URL vaut encore l'adresse d'exemple : la définir (Coolify : variable de construction)." >&2; exit 1; \
       fi

# --- Service ---
FROM node:24-alpine
WORKDIR /app
RUN npm install -g serve@14.2.4
COPY --from=construction /app/dist ./dist
# Cache long des fichiers à empreinte (assets/) et en-têtes de sécurité.
COPY serve.json /app/serve.json
USER node
EXPOSE 3000
# --single : les routes du site (/machines, /mes-machines…) renvoient index.html.
CMD ["serve", "--single", "--no-clipboard", "--config", "/app/serve.json", "--listen", "tcp://0.0.0.0:3000", "dist"]
