AGRILINK

PRD 2 — Backend Django

Version MVP — Octobre 2026

1. Objectif

Développer le backend d’AgriLink avec Django et Django REST Framework afin de gérer l’authentification, les utilisateurs, les machines, les réservations, les permissions et la communication avec l’application Flutter.

2. Architecture

Flutter  ⇄  API REST  ⇄  Django / Django REST Framework  ⇄  PostgreSQL

3. Modèles de données

Modèle
	

Champs principaux

Utilisateur
	

id, nom, prénom, téléphone, mot_de_passe, type_utilisateur, localisation, date_creation

Machine
	

id, proprietaire_id, nom, type_machine, description, photo, prix, localisation, disponible, date_creation

Réservation
	

id, agriculteur_id, machine_id, date_reservation, statut, date_creation

Types d’utilisateur : AGRICULTEUR, DETENTEUR. Statuts de réservation : EN_ATTENTE, ACCEPTEE, REFUSEE, ANNULEE.

4. Relations

Un détenteur peut posséder plusieurs machines.

Une machine appartient à un seul détenteur.

Un agriculteur peut effectuer plusieurs demandes de réservation.

Chaque réservation concerne une machine et un agriculteur.

5. API principales

Fonction
	

Méthode et endpoint

Inscription
	

POST /api/register/

Connexion
	

POST /api/login/

Profil
	

GET /api/profile/

Liste des machines
	

GET /api/machines/

Détail machine
	

GET /api/machines/{id}/

Ajouter machine
	

POST /api/machines/

Modifier machine
	

PUT /api/machines/{id}/

Supprimer machine
	

DELETE /api/machines/{id}/

Créer réservation
	

POST /api/reservations/

Mes réservations
	

GET /api/reservations/me/

Demandes reçues
	

GET /api/reservations/received/

Accepter
	

PATCH /api/reservations/{id}/accept/

Refuser
	

PATCH /api/reservations/{id}/reject/

6. Recherche et filtrage

Filtrer les machines par type.

Filtrer les machines par localisation ou zone.

Retourner uniquement les machines disponibles lorsque nécessaire.

7. Permissions et règles métier

Agriculteur
	

Détenteur

Voir les machines
	

Ajouter ses machines

Consulter une machine
	

Modifier ou supprimer ses propres machines

Créer une demande
	

Voir les demandes liées à ses machines

Voir ses demandes et leur statut
	

Accepter ou refuser une demande

Un utilisateur ne doit pas pouvoir modifier les machines, réservations ou données privées appartenant à un autre utilisateur sans autorisation.

8. Critères d’acceptation

Flutter peut inscrire et connecter un utilisateur.

L’API distingue correctement les rôles AGRICULTEUR et DETENTEUR.

Les machines peuvent être créées, lues, modifiées et supprimées selon les permissions.

Une réservation est reliée au bon agriculteur, à la bonne machine et au bon détenteur.

Le détenteur peut accepter ou refuser une demande.

Le nouveau statut est disponible pour l’agriculteur.

Les endpoints retournent des réponses et erreurs cohérentes pour Flutter.