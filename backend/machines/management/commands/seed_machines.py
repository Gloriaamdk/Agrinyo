from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from comptes.telephone import normaliser_telephone
from machines.models import Avis, Machine
from reservations.models import Reservation

Utilisateur = get_user_model()

# Photos libres de droits (Wikimedia Commons), voir donnees_demo/CREDITS.md.
DOSSIER_PHOTOS = Path(__file__).resolve().parents[2] / 'donnees_demo' / 'photos'

# Mot de passe commun à tous les comptes de démonstration (développement uniquement).
MOT_DE_PASSE_DEMO = 'agrilink2026'

# Numéros volontairement invalides (+228 00…) : ce sont des personnes fictives.
DETENTEURS = [
    # clé, prénom, nom, téléphone, localisation
    ('kossi.agbeko', 'Kossi', 'Agbéko', '+228 00 00 00 01', 'Tsévié'),
    ('ama.mensah', 'Ama', 'Mensah', '+228 00 00 00 02', 'Aného'),
    ('kodjo.amouzou', 'Kodjo', 'Amouzou', '+228 00 00 00 03', 'Kpalimé'),
    ('abla.dzifa', 'Abla', 'Dzifa', '+228 00 00 00 04', 'Atakpamé'),
    ('bawa.tchala', 'Bawa', 'Tchala', '+228 00 00 00 05', 'Sokodé'),
    ('essowe.pali', 'Essowè', 'Pali', '+228 00 00 00 06', 'Kara'),
    ('lamboni.nabine', 'Lamboni', 'Nabine', '+228 00 00 00 07', 'Dapaong'),
]

AGRICULTEURS = [
    ('mawuli.ahiable', 'Mawuli', 'Ahiable', '+228 00 00 01 01', 'Tsévié'),
    ('afi.kpodar', 'Afi', 'Kpodar', '+228 00 00 01 02', 'Atakpamé'),
    ('djibril.ouro', 'Djibril', 'Ouro', '+228 00 00 01 03', 'Sokodé'),
    ('akossiwa.tete', 'Akossiwa', 'Tété', '+228 00 00 01 04', 'Kara'),
    ('yendoube.sama', 'Yendoubé', 'Sama', '+228 00 00 01 05', 'Dapaong'),
]

# Quelques demandes pour que les écrans « Mes réservations » et « Demandes reçues »
# ne soient pas vides : (agriculteur, machine, dans N jours, quantité, statut).
RESERVATIONS = [
    ('mawuli.ahiable', 'Tracteur Massey Ferguson 375', 3, '2', Reservation.Statut.EN_ATTENTE),
    ('afi.kpodar', 'Tracteur Massey Ferguson 375', 3, '1.5', Reservation.Statut.EN_ATTENTE),
    ('mawuli.ahiable', 'Motoculteur Kubota RT140', 5, '2', Reservation.Statut.ACCEPTEE),
    ('djibril.ouro', 'Tracteur John Deere 5055E', 7, '3', Reservation.Statut.REFUSEE),
    ('akossiwa.tete', 'Charrue à disques 3 corps', 10, '1', Reservation.Statut.ACCEPTEE),
]

T, Z, U = Machine.TypeMachine, Machine.Zone, Machine.UnitePrix

MACHINES = [
    {
        'proprietaire': 'kossi.agbeko', 'nom': 'Tracteur Massey Ferguson 375', 'type_machine': T.TRACTEUR,
        'description': 'Tracteur 75 ch avec charrue à disques, idéal pour le labour avant les semis.',
        'prix': 40000, 'unite_prix': U.HECTARE, 'zone': Z.MARITIME, 'localisation': 'Tsévié',
        'photo': 'tracteur-massey-ferguson.jpg', 'credit_photo': 'Tahiru Rajab, CC BY-SA 4.0',
        'avis': [('mawuli.ahiable', 5, 'Labour bien fait et chauffeur ponctuel.'),
                 ('afi.kpodar', 4, 'Bon tracteur, un peu de retard le premier jour.')],
    },
    {
        'proprietaire': 'ama.mensah', 'nom': 'Motoculteur Kubota RT140', 'type_machine': T.MOTOCULTEUR,
        'description': 'Motoculteur maniable pour les petites parcelles et le maraîchage.',
        'prix': 15000, 'unite_prix': U.JOUR, 'zone': Z.MARITIME, 'localisation': 'Aného',
        'photo': 'motoculteur.jpg', 'credit_photo': 'Pawyilee, Licence Art Libre',
        'avis': [('mawuli.ahiable', 4, 'Pratique pour mon jardin de légumes.')],
    },
    {
        'proprietaire': 'kodjo.amouzou', 'nom': 'Moissonneuse-batteuse à riz', 'type_machine': T.MOISSONNEUSE,
        'description': 'Récolte et battage du riz en un seul passage. Opérateur inclus.',
        'prix': 60000, 'unite_prix': U.HECTARE, 'zone': Z.PLATEAUX, 'localisation': 'Kpalimé',
        'photo': 'moissonneuse-riz.jpg', 'credit_photo': 'katorisi, CC BY 3.0',
        'avis': [('afi.kpodar', 5, 'Récolte finie en une journée, très efficace.'),
                 ('djibril.ouro', 5, 'Je recommande.'),
                 ('mawuli.ahiable', 4, '')],
    },
    {
        'proprietaire': 'abla.dzifa', 'nom': 'Décortiqueuse à riz', 'type_machine': T.DECORTIQUEUSE,
        'description': 'Décortiqueuse mobile, environ 300 kg de paddy par heure.',
        'prix': 5000, 'unite_prix': U.HEURE, 'zone': Z.PLATEAUX, 'localisation': 'Atakpamé',
        'photo': 'decortiqueuse-riz.jpg', 'credit_photo': 'Department of Foreign Affairs and Trade, CC BY 2.0',
        'avis': [('afi.kpodar', 3, 'Fonctionne bien mais beaucoup de brisures.')],
    },
    {
        'proprietaire': 'bawa.tchala', 'nom': 'Tracteur John Deere 5055E', 'type_machine': T.TRACTEUR,
        'description': 'Tracteur 55 ch avec herse et remorque disponibles.',
        'prix': 35000, 'unite_prix': U.HECTARE, 'zone': Z.CENTRALE, 'localisation': 'Sokodé',
        'photo': 'tracteur-john-deere.jpg', 'credit_photo': 'Wleiter, CC BY-SA 4.0',
        'avis': [('djibril.ouro', 5, 'Très bon état, propriétaire sérieux.'),
                 ('akossiwa.tete', 4, 'Bon service.')],
    },
    {
        'proprietaire': 'bawa.tchala', 'nom': 'Batteuse à maïs et sorgho', 'type_machine': T.BATTEUSE,
        'description': 'Égrène le maïs et le sorgho rapidement, fonctionne au gasoil.',
        'prix': 20000, 'unite_prix': U.JOUR, 'zone': Z.CENTRALE, 'localisation': 'Sotouboua',
        'photo': 'batteuse-mais.jpg', 'credit_photo': 'Jozef020, CC BY-SA 4.0',
        'avis': [],
    },
    {
        'proprietaire': 'essowe.pali', 'nom': 'Charrue à disques 3 corps', 'type_machine': T.CHARRUE,
        'description': 'Charrue attelée pour labour profond, se monte sur tracteur 50 ch et plus.',
        'prix': 10000, 'unite_prix': U.JOUR, 'zone': Z.KARA, 'localisation': 'Kara',
        'photo': 'charrue-disques.jpg', 'credit_photo': 'Jugraj Singh Sehri, CC BY-SA 4.0',
        'avis': [('akossiwa.tete', 4, 'Solide, labour régulier.'),
                 ('djibril.ouro', 5, '')],
    },
    {
        'proprietaire': 'essowe.pali', 'nom': 'Semoir mécanique 4 rangs', 'type_machine': T.SEMOIR,
        'description': 'Semoir attelé pour maïs, soja et arachide.',
        'prix': 12000, 'unite_prix': U.HECTARE, 'zone': Z.KARA, 'localisation': 'Bafilo',
        'photo': 'semoir.jpg', 'credit_photo': 'Melensdad, CC BY 2.5',
        'avis': [('akossiwa.tete', 5, 'Semis bien alignés, gain de temps énorme.')],
    },
    {
        'proprietaire': 'lamboni.nabine', 'nom': "Motopompe d'irrigation Honda", 'type_machine': T.MOTOPOMPE,
        'description': 'Motopompe 3 pouces pour l\'irrigation en saison sèche.',
        'prix': 8000, 'unite_prix': U.JOUR, 'zone': Z.SAVANES, 'localisation': 'Dapaong',
        'photo': 'motopompe.jpg', 'credit_photo': 'Michael Trolove, CC BY-SA 2.0',
        'avis': [('yendoube.sama', 4, 'Indispensable pour mon oignon en saison sèche.')],
    },
    {
        'proprietaire': 'lamboni.nabine', 'nom': 'Tracteur Mahindra 575', 'type_machine': T.TRACTEUR,
        'description': 'Tracteur 45 ch robuste, adapté aux sols des Savanes.',
        'prix': 30000, 'unite_prix': U.HECTARE, 'zone': Z.SAVANES, 'localisation': 'Mango',
        'photo': 'tracteur-mahindra.jpg', 'credit_photo': 'Chandapiwa Malema, CC0',
        'avis': [('yendoube.sama', 5, 'Prix correct et travail propre.'),
                 ('akossiwa.tete', 3, 'Arrivé en retard.')],
    },
]


class Command(BaseCommand):
    help = 'Crée (ou met à jour) 10 machines fictives avec leurs propriétaires, photos et avis.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Données de démonstration (mot de passe connu) : refusé hors développement.')

        utilisateurs = {}
        for cle, prenom, nom, telephone, localisation in DETENTEURS:
            utilisateurs[cle] = self._utilisateur(
                cle, prenom, nom, telephone, localisation, Utilisateur.TypeUtilisateur.DETENTEUR
            )
        for cle, prenom, nom, telephone, localisation in AGRICULTEURS:
            utilisateurs[cle] = self._utilisateur(
                cle, prenom, nom, telephone, localisation, Utilisateur.TypeUtilisateur.AGRICULTEUR
            )

        for donnees in MACHINES:
            donnees = dict(donnees)
            avis = donnees.pop('avis')
            photo = donnees.pop('photo')
            proprietaire = utilisateurs[donnees.pop('proprietaire')]
            machine, _ = Machine.objects.update_or_create(
                proprietaire=proprietaire, nom=donnees.pop('nom'), defaults=donnees
            )
            if not machine.photo:
                with open(DOSSIER_PHOTOS / photo, 'rb') as fichier:
                    machine.photo.save(photo, File(fichier), save=True)
            for auteur, note, commentaire in avis:
                Avis.objects.update_or_create(
                    machine=machine, auteur=utilisateurs[auteur],
                    defaults={'note': note, 'commentaire': commentaire},
                )

        self._reservations(utilisateurs)
        self.stdout.write(self.style.SUCCESS(
            f'{len(MACHINES)} machines fictives prêtes. Mot de passe des comptes de démo : {MOT_DE_PASSE_DEMO}'
        ))

    def _utilisateur(self, cle, prenom, nom, telephone, localisation, type_utilisateur):
        telephone = normaliser_telephone(telephone)
        # La clé (ex. « kossi.agbeko ») sert de nom d'utilisateur : connexion par nom ou par numéro.
        utilisateur, cree = Utilisateur.objects.update_or_create(
            telephone=telephone,
            defaults={
                'username': cle, 'first_name': prenom, 'last_name': nom, 'localisation': localisation,
                'type_utilisateur': type_utilisateur, 'telephone': telephone,
            },
        )
        if cree:
            utilisateur.set_password(MOT_DE_PASSE_DEMO)
            utilisateur.save(update_fields=['password'])
        return utilisateur

    def _reservations(self, utilisateurs):
        # Une seule fois : les dates sont relatives au jour du premier lancement.
        if Reservation.objects.exists():
            return
        aujourdhui = timezone.localdate()
        for cle, nom_machine, dans_jours, quantite, statut in RESERVATIONS:
            machine = Machine.objects.get(nom=nom_machine)
            quantite = Decimal(quantite)
            date_debut = aujourdhui + timedelta(days=dans_jours)
            Reservation.objects.create(
                agriculteur=utilisateurs[cle],
                machine=machine,
                date_debut=date_debut,
                date_fin=Reservation.calculer_date_fin(date_debut, machine.unite_prix, quantite),
                quantite=quantite,
                prix_unitaire=machine.prix,
                unite_prix=machine.unite_prix,
                montant_estime=Reservation.calculer_montant(machine.prix, quantite),
                statut=statut,
                date_reponse=None if statut == Reservation.Statut.EN_ATTENTE else timezone.now(),
            )
