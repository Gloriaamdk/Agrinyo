AGRILINK

PRD 1 — Frontend Flutter

1. Objectif

Développer avec Flutter une interface mobile simple et visuelle permettant aux agriculteurs de trouver et demander une machine agricole, et aux détenteurs de machines de publier leurs équipements et de gérer les demandes reçues.

2. Utilisateurs

Agriculteur

En tant qu’agriculteur, je veux voir les machines disponibles autour de moi et demander une réservation pour une date donnée.

Détenteur de machine

En tant que détenteur, je veux publier mes machines, recevoir les demandes des agriculteurs et les accepter ou les refuser.

3. Parcours Agriculteur

Écran
	

Contenu principal
	

Action

Accueil
	

Localisation, recherche, catégories, recommandations, machines disponibles
	

Choisir une catégorie ou une machine

Liste des machines
	

Photo, type, localisation, prix, disponibilité
	

Ouvrir une machine

Détail / réservation
	

Photo, informations, prix, disponibilité, date
	

Envoyer une demande

Mes réservations
	

Demandes et statuts
	

Suivre la réponse

4. Parcours Détenteur

Écran
	

Contenu principal
	

Action

Tableau de bord
	

Mes machines, demandes en attente, réservations acceptées
	

Accéder à la gestion

Mes machines
	

Liste des équipements et leur statut
	

Ajouter ou modifier une machine

Ajouter une machine
	

Photo, type, nom, prix, localisation, disponibilité
	

Publier la machine

Demandes reçues
	

Agriculteur, machine, date, zone
	

Accepter ou refuser

5. Navigation

La navigation dépend du rôle de l’utilisateur.

Rôle
	

Navigation principale

Agriculteur
	

Accueil | Machines | Réservations | Profil

Dénteur
	

Accueil | Mes machines | Demandes | Profil

6. Règles d’interface

Interface simple, visuelle et lisible.

Utiliser des images et icônes pour faciliter la compréhension.

Limiter le texte inutile et privilégier de gros boutons d’action.

Afficher clairement le prix, la localisation, la disponibilité et le statut d’une demande.

Conserver une identité visuelle cohérente avec les maquettes AgriLink : vert, blanc et interface épurée.

7. Critères d’acceptation

L’utilisateur peut se connecter et l’interface affichée correspond à son rôle.

L’agriculteur peut consulter les machines, choisir une date et envoyer une demande.

Le détenteur peut ajouter et consulter ses machines.

Le détenteur peut consulter les demandes reçues et les accepter ou les refuser.

L’agriculteur voit le statut actualisé de sa demande.

Les écrans Flutter communiquent correctement avec l’API Django.