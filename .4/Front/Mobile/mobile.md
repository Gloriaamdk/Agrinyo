GRILINK

PRD 3 — Application mobile AgriLink

Version MVP — Octobre 2026

1. Problème, en une phrase

Les agriculteurs rencontrent des difficultés pour identifier rapidement des machines agricoles disponibles près de leurs exploitations, tandis que certains détenteurs de machines disposent d’équipements pouvant être mis à disposition mais manquent d’un moyen simple de trouver des utilisateurs.

2. Utilisateurs principaux

Utilisateur
	

Besoin principal

Agriculteur
	

Trouver une machine agricole disponible et envoyer une demande pour une date donnée.

Détenteur de machines
	

Publier ses machines et gérer les demandes reçues.

3. Fonctionnalité principale — Agriculteur

En tant qu’agriculteur disposant d’un smartphone, je veux trouver une machine agricole disponible dans ma zone et envoyer une demande pour une date donnée afin de réaliser mes travaux agricoles plus facilement.

Critères d’acceptation

Je vois les machines disponibles dans ma zone.

Je peux sélectionner un type de machine.

Je peux consulter les informations d’une machine.

Je peux choisir une date.

Je peux envoyer une demande.

Je peux voir si ma demande est en attente, acceptée ou refusée.

4. Fonctionnalité principale — Détenteur

En tant que détenteur de machines agricoles, je veux publier mes machines et recevoir les demandes des agriculteurs afin de mettre mes équipements à disposition lorsqu’ils sont disponibles.

Critères d’acceptation

Je peux ajouter une machine.

Je peux renseigner son type, son prix, sa localisation et sa disponibilité.

Je peux consulter mes machines.

Je vois les demandes reçues.

Je peux accepter ou refuser une demande.

5. Parcours principal

Le détenteur publie une machine et indique sa disponibilité.

L’agriculteur recherche une machine dans sa zone.

L’agriculteur consulte la machine et choisit une date.

L’agriculteur envoie une demande.

Le détenteur reçoit la demande et l’accepte ou la refuse.

L’agriculteur consulte le statut de sa demande.

6. Écrans clés du MVP

Agriculteur
	

Détenteur

Connexion / inscription
	

Connexion / inscription

Accueil
	

Tableau de bord

Liste des machines
	

Mes machines

Détail / réservation
	

Ajouter / modifier une machine

Mes réservations
	

Demandes reçues

Profil
	

Profil

7. Données principales

Le MVP repose sur trois ensembles de données principaux : UTILISATEUR, MACHINE et RÉSERVATION.

8. Hors périmètre — V1

Paiement en ligne

Messagerie instantanée

Appel vidéo

Notes et avis

Intelligence artificielle

Fonctionnalités vocales

Suivi GPS en temps réel

Enchères

Assurance

Gestion complexe des coopératives

9. Stack technique

Composant
	

Technologie

Application mobile / frontend
	

Flutter

Backend / API
	

Django + Django REST Framework

Base de données
	

PostgreSQL

10. Définition du MVP

Trouver une machine → choisir une date → envoyer une demande → le détenteur accepte ou refuse → l’agriculteur reçoit la réponse.