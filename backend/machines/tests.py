import io
import os
import shutil
import tempfile
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from reservations.models import Reservation

from .models import Machine

MEDIA_TEMPORAIRE = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA_TEMPORAIRE, DEBUG=True)
class MachineApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_machines', stdout=StringIO())

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_TEMPORAIRE, ignore_errors=True)

    def test_chaque_machine_a_une_photo_creditee(self):
        reponse = self.client.get('/api/machines/')

        for machine in reponse.data:
            self.assertTrue(machine['photo'].startswith('/media/machines/'), machine['nom'])
            self.assertTrue(machine['credit_photo'], machine['nom'])

    def test_relancer_le_seed_ne_cree_pas_de_doublons(self):
        call_command('seed_machines', stdout=StringIO())

        self.assertEqual(Machine.objects.count(), 10)

    def test_liste_renvoie_les_10_machines_avec_proprietaire(self):
        reponse = self.client.get('/api/machines/')

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(len(reponse.data), 10)
        machine = next(m for m in reponse.data if m['nom'] == 'Tracteur Massey Ferguson 375')
        self.assertEqual(machine['proprietaire']['nom'], 'Kossi Agbéko')
        self.assertEqual(machine['type_machine_libelle'], 'Tracteur')
        self.assertEqual(machine['prix'], 40000)

    def test_notes_et_avis_masques_en_v1(self):
        liste = self.client.get('/api/machines/')
        machine = Machine.objects.get(nom='Moissonneuse-batteuse à riz')  # a des avis dans le seed
        detail = self.client.get(f'/api/machines/{machine.id}/')

        for champ in ('note_moyenne', 'nombre_avis', 'avis'):
            self.assertNotIn(champ, liste.data[0], champ)
            self.assertNotIn(champ, detail.data, champ)

    def test_filtre_par_zone(self):
        reponse = self.client.get('/api/machines/', {'zone': 'SAVANES'})

        self.assertEqual({m['zone'] for m in reponse.data}, {'SAVANES'})
        self.assertEqual(len(reponse.data), 2)

    def test_filtre_par_zone_et_type(self):
        reponse = self.client.get('/api/machines/', {'zone': 'CENTRALE', 'type': 'TRACTEUR'})

        self.assertEqual([m['nom'] for m in reponse.data], ['Tracteur John Deere 5055E'])

    def test_filtre_disponible(self):
        Machine.objects.filter(nom='Tracteur Mahindra 575').update(disponible=False)

        reponse = self.client.get('/api/machines/', {'disponible': 'true'})

        self.assertEqual(len(reponse.data), 9)

    def test_filtres_disponibles(self):
        reponse = self.client.get('/api/machines/filtres/')

        self.assertEqual(len(reponse.data['zones']), 5)
        self.assertIn({'valeur': 'TRACTEUR', 'libelle': 'Tracteur'}, reponse.data['types'])
        self.assertIn({'valeur': 'CHARRUE', 'libelle': 'Charrue'}, reponse.data['types'])
        # Aucun pulvérisateur dans les données : le type n'est pas proposé.
        self.assertNotIn('PULVERISATEUR', [t['valeur'] for t in reponse.data['types']])
        # Le formulaire d'ajout, lui, propose tous les types et toutes les unités.
        self.assertIn('PULVERISATEUR', [t['valeur'] for t in reponse.data['tous_les_types']])
        self.assertEqual([u['valeur'] for u in reponse.data['unites']], ['JOUR', 'HEURE', 'HECTARE'])

    def test_recherche_par_nom_ville_ou_proprietaire(self):
        par_nom = self.client.get('/api/machines/', {'q': 'john deere'})
        par_ville = self.client.get('/api/machines/', {'q': 'dapaong'})
        par_proprietaire = self.client.get('/api/machines/', {'q': 'tchala'})

        self.assertEqual([m['nom'] for m in par_nom.data], ['Tracteur John Deere 5055E'])
        self.assertEqual([m['nom'] for m in par_ville.data], ["Motopompe d'irrigation Honda"])
        self.assertEqual(len(par_proprietaire.data), 2)

    def test_le_telephone_du_proprietaire_reste_prive(self):
        reponse = self.client.get('/api/machines/')

        self.assertNotIn('telephone', reponse.data[0]['proprietaire'])

    def test_detail_liste_les_periodes_deja_acceptees(self):
        charrue = Machine.objects.get(nom='Charrue à disques 3 corps')

        reponse = self.client.get(f'/api/machines/{charrue.id}/')

        self.assertEqual(len(reponse.data['periodes_reservees']), 1)

    def test_un_visiteur_non_connecte_ne_peut_rien_publier(self):
        reponse = self.client.post('/api/machines/', {'nom': 'Pirate'})

        self.assertEqual(reponse.status_code, 401)


NOUVELLE_MACHINE = {
    'nom': 'Tracteur John Deere 5050',
    'type_machine': 'TRACTEUR',
    'description': 'Avec remorque.',
    'prix': 45000,
    'unite_prix': 'HECTARE',
    'zone': 'PLATEAUX',
    'localisation': 'Atakpamé',
}


@override_settings(MEDIA_ROOT=MEDIA_TEMPORAIRE)
class MachineEcritureTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        Utilisateur = get_user_model()
        cls.proprietaire = Utilisateur.objects.create_user(
            username='kossi', telephone='+22890000001', password='x', type_utilisateur='DETENTEUR'
        )
        cls.autre_proprietaire = Utilisateur.objects.create_user(
            username='ama', telephone='+22890000002', password='x', type_utilisateur='DETENTEUR'
        )
        cls.agriculteur = Utilisateur.objects.create_user(
            username='mawuli', telephone='+22890000101', password='x', type_utilisateur='AGRICULTEUR'
        )

    def setUp(self):
        self.client.force_authenticate(self.proprietaire)

    def machine(self, proprietaire=None, **champs):
        donnees = {**NOUVELLE_MACHINE, **champs}
        return Machine.objects.create(proprietaire=proprietaire or self.proprietaire, **donnees)

    def image(self, taille=(3000, 2000)):
        tampon = io.BytesIO()
        Image.new('RGB', taille, 'green').save(tampon, format='JPEG')
        return SimpleUploadedFile('tracteur.jpg', tampon.getvalue(), content_type='image/jpeg')

    def reserver(self, machine, statut, dans_jours):
        debut = timezone.localdate() + timedelta(days=dans_jours)
        return Reservation.objects.create(
            agriculteur=self.agriculteur, machine=machine, date_debut=debut, date_fin=debut,
            quantite=1, prix_unitaire=machine.prix, unite_prix=machine.unite_prix,
            montant_estime=machine.prix, statut=statut,
        )

    # --- Création ---

    def test_le_proprietaire_publie_une_machine(self):
        reponse = self.client.post('/api/machines/', NOUVELLE_MACHINE)

        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertEqual(reponse.data['proprietaire']['id'], self.proprietaire.id)
        self.assertEqual(reponse.data['zone_libelle'], 'Plateaux')
        self.assertTrue(reponse.data['disponible'])

    def test_le_proprietaire_envoye_par_le_client_est_ignore(self):
        reponse = self.client.post('/api/machines/', {**NOUVELLE_MACHINE, 'proprietaire': self.autre_proprietaire.id})

        self.assertEqual(Machine.objects.get(pk=reponse.data['id']).proprietaire, self.proprietaire)

    def test_publication_avec_photo_reduite(self):
        reponse = self.client.post('/api/machines/', {**NOUVELLE_MACHINE, 'photo': self.image()}, format='multipart')

        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertTrue(reponse.data['photo'].startswith('/media/machines/'))
        # En multipart, « disponible » absent ne doit pas valoir « non ».
        self.assertTrue(reponse.data['disponible'])
        with Image.open(Machine.objects.get(pk=reponse.data['id']).photo.path) as image:
            self.assertEqual(max(image.size), 1280)

    def test_champs_obligatoires_et_valeurs_refusees(self):
        reponse = self.client.post('/api/machines/', {
            **NOUVELLE_MACHINE, 'nom': '  ', 'prix': 0, 'zone': 'PARIS', 'type_machine': 'FUSEE', 'localisation': '',
        })

        self.assertEqual(reponse.status_code, 400)
        for champ in ('nom', 'prix', 'zone', 'type_machine', 'localisation'):
            self.assertIn(champ, reponse.data, champ)

    def test_un_agriculteur_ne_peut_pas_publier(self):
        self.client.force_authenticate(self.agriculteur)

        reponse = self.client.post('/api/machines/', NOUVELLE_MACHINE)

        self.assertEqual(reponse.status_code, 403)
        self.assertFalse(Machine.objects.exists())

    # --- Modification ---

    def test_modifier_prix_et_disponibilite(self):
        machine = self.machine()

        reponse = self.client.patch(f'/api/machines/{machine.id}/', {'prix': 50000, 'disponible': False})

        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data['prix'], 50000)
        self.assertFalse(reponse.data['disponible'])

    def test_modification_complete_par_put(self):
        machine = self.machine()

        reponse = self.client.put(
            f'/api/machines/{machine.id}/', {**NOUVELLE_MACHINE, 'nom': 'Tracteur JD', 'zone': 'KARA'}
        )

        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data['nom'], 'Tracteur JD')
        self.assertEqual(reponse.data['zone'], 'KARA')

    def test_changer_puis_retirer_la_photo(self):
        machine = self.machine(credit_photo='Wikimedia')
        self.client.patch(f'/api/machines/{machine.id}/', {'photo': self.image((800, 600))}, format='multipart')
        machine.refresh_from_db()
        chemin = machine.photo.path

        reponse = self.client.patch(f'/api/machines/{machine.id}/', {'supprimer_photo': True})

        self.assertIsNone(reponse.data['photo'])
        self.assertEqual(reponse.data['credit_photo'], '')
        self.assertFalse(os.path.exists(chemin))

    def test_on_ne_touche_pas_a_la_machine_d_un_autre(self):
        machine = self.machine(proprietaire=self.autre_proprietaire)

        modification = self.client.patch(f'/api/machines/{machine.id}/', {'prix': 1})
        suppression = self.client.delete(f'/api/machines/{machine.id}/')

        self.assertEqual(modification.status_code, 404)
        self.assertEqual(suppression.status_code, 404)
        machine.refresh_from_db()
        self.assertEqual(machine.prix, NOUVELLE_MACHINE['prix'])

    def test_un_agriculteur_ne_peut_pas_modifier(self):
        machine = self.machine()
        self.client.force_authenticate(self.agriculteur)

        self.assertEqual(self.client.patch(f'/api/machines/{machine.id}/', {'prix': 1}).status_code, 403)
        self.assertEqual(self.client.put(f'/api/machines/{machine.id}/', NOUVELLE_MACHINE).status_code, 403)

    def test_un_nouveau_prix_ne_change_pas_une_demande_en_cours(self):
        machine = self.machine()
        demande = self.reserver(machine, Reservation.Statut.EN_ATTENTE, 3)

        self.client.patch(f'/api/machines/{machine.id}/', {'prix': 90000})

        demande.refresh_from_db()
        self.assertEqual(demande.prix_unitaire, NOUVELLE_MACHINE['prix'])

    # --- Suppression ---

    def test_supprimer_une_machine(self):
        machine = self.machine()
        self.reserver(machine, Reservation.Statut.ACCEPTEE, -10)  # réservation passée : sans effet

        reponse = self.client.delete(f'/api/machines/{machine.id}/')

        self.assertEqual(reponse.status_code, 204)
        self.assertFalse(Machine.objects.filter(pk=machine.id).exists())

    def test_suppression_refusee_avec_une_reservation_acceptee_a_venir(self):
        machine = self.machine()
        reservation = self.reserver(machine, Reservation.Statut.ACCEPTEE, 5)

        reponse = self.client.delete(f'/api/machines/{machine.id}/')

        self.assertEqual(reponse.status_code, 409)
        # Gardée, mais retirée de la location ; la réservation acceptée tient toujours.
        machine.refresh_from_db()
        self.assertFalse(machine.disponible)
        self.assertFalse(reponse.data['machine']['disponible'])
        reservation.refresh_from_db()
        self.assertEqual(reservation.statut, Reservation.Statut.ACCEPTEE)

    def test_une_demande_en_attente_n_empeche_pas_la_suppression(self):
        machine = self.machine()
        self.reserver(machine, Reservation.Statut.EN_ATTENTE, 5)

        self.assertEqual(self.client.delete(f'/api/machines/{machine.id}/').status_code, 204)
        self.assertFalse(Machine.objects.filter(pk=machine.id).exists())

    def test_un_agriculteur_ne_peut_pas_supprimer(self):
        machine = self.machine()
        self.client.force_authenticate(self.agriculteur)

        self.assertEqual(self.client.delete(f'/api/machines/{machine.id}/').status_code, 403)
        self.assertTrue(Machine.objects.filter(pk=machine.id).exists())

    def test_un_autre_proprietaire_ne_peut_pas_tout_remplacer(self):
        machine = self.machine(proprietaire=self.autre_proprietaire)

        reponse = self.client.put(f'/api/machines/{machine.id}/', {**NOUVELLE_MACHINE, 'nom': 'Volée'})

        self.assertEqual(reponse.status_code, 404)
        machine.refresh_from_db()
        self.assertEqual(machine.nom, NOUVELLE_MACHINE['nom'])

    # --- Formulaire ---

    def test_options_du_formulaire(self):
        self.client.force_authenticate(None)

        reponse = self.client.get('/api/machines/options/')

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(len(reponse.data['types']), len(Machine.TypeMachine.choices))
        self.assertIn({'valeur': 'MOTOPOMPE', 'libelle': 'Motopompe'}, reponse.data['types'])
        self.assertEqual([z['valeur'] for z in reponse.data['zones']],
                         ['MARITIME', 'PLATEAUX', 'CENTRALE', 'KARA', 'SAVANES'])
        self.assertEqual([u['valeur'] for u in reponse.data['unites_prix']], ['JOUR', 'HEURE', 'HECTARE'])

    # --- Mes machines ---

    def test_mes_machines_disponibles_ou_non_avec_demandes_en_attente(self):
        active = self.machine(nom='Active')
        self.machine(nom='En panne', disponible=False)
        self.machine(proprietaire=self.autre_proprietaire, nom='Pas à moi')
        self.reserver(active, Reservation.Statut.EN_ATTENTE, 2)
        self.reserver(active, Reservation.Statut.EN_ATTENTE, 4)
        self.reserver(active, Reservation.Statut.REFUSEE, 6)

        reponse = self.client.get('/api/machines/mine/')

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(sorted(m['nom'] for m in reponse.data), ['Active', 'En panne'])
        self.assertEqual(next(m for m in reponse.data if m['nom'] == 'Active')['demandes_en_attente'], 2)

    def test_mes_machines_reserve_aux_proprietaires(self):
        self.client.force_authenticate(self.agriculteur)
        self.assertEqual(self.client.get('/api/machines/mine/').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/machines/mine/').status_code, 401)
