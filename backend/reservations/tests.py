from datetime import timedelta

from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from comptes.models import Utilisateur
from machines.models import Machine

from .models import Message, Reservation

Role = Utilisateur.TypeUtilisateur
Statut = Reservation.Statut


def dans(jours):
    return (timezone.localdate() + timedelta(days=jours)).isoformat()


class ReservationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        def utilisateur(numero, prenom, role):
            return Utilisateur.objects.create_user(
                username=f'+2289000000{numero}', telephone=f'+2289000000{numero}',
                first_name=prenom, last_name='Test', type_utilisateur=role, password='x',
            )

        cls.kossi = utilisateur(1, 'Kossi', Role.DETENTEUR)
        cls.ama = utilisateur(2, 'Ama', Role.DETENTEUR)
        cls.mawuli = utilisateur(3, 'Mawuli', Role.AGRICULTEUR)
        cls.afi = utilisateur(4, 'Afi', Role.AGRICULTEUR)

        def machine(proprietaire, nom, prix, unite):
            return Machine.objects.create(
                proprietaire=proprietaire, nom=nom, type_machine=Machine.TypeMachine.TRACTEUR,
                prix=prix, unite_prix=unite, zone=Machine.Zone.MARITIME, localisation='Tsévié',
            )

        cls.tracteur = machine(cls.kossi, 'Tracteur', 40000, Machine.UnitePrix.HECTARE)
        cls.motoculteur = machine(cls.kossi, 'Motoculteur', 15000, Machine.UnitePrix.JOUR)
        cls.pompe = machine(cls.ama, 'Motopompe', 5000, Machine.UnitePrix.HEURE)

    def connecter(self, utilisateur):
        token, _ = Token.objects.get_or_create(user=utilisateur)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def demander(self, machine, jours=3, quantite='2', utilisateur=None):
        self.connecter(utilisateur or self.mawuli)
        return self.client.post(
            '/api/reservations/', {'machine': machine.id, 'date_debut': dans(jours), 'quantite': quantite}
        )

    # --- Création ---

    def test_demande_calcule_le_montant_et_reste_en_attente(self):
        reponse = self.demander(self.tracteur, quantite='2.5')

        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertEqual(reponse.data['statut'], 'EN_ATTENTE')
        self.assertEqual(reponse.data['montant_estime'], 100000)  # 40 000 × 2,5 ha
        self.assertEqual(reponse.data['date_fin'], dans(3))
        self.assertEqual(reponse.data['agriculteur']['id'], self.mawuli.id)

    def test_location_a_la_journee_couvre_plusieurs_jours(self):
        reponse = self.demander(self.motoculteur, jours=3, quantite='3')

        self.assertEqual(reponse.data['date_debut'], dans(3))
        self.assertEqual(reponse.data['date_fin'], dans(5))
        self.assertEqual(reponse.data['montant_estime'], 45000)

    def test_prix_fige_au_moment_de_la_demande(self):
        reservation_id = self.demander(self.tracteur).data['id']
        Machine.objects.filter(pk=self.tracteur.pk).update(prix=99000)

        self.assertEqual(Reservation.objects.get(pk=reservation_id).montant_estime, 80000)

    def test_connexion_obligatoire(self):
        reponse = self.client.post('/api/reservations/', {'machine': self.tracteur.id, 'date_debut': dans(3), 'quantite': '1'})

        self.assertEqual(reponse.status_code, 401)

    def test_un_detenteur_ne_peut_pas_reserver(self):
        reponse = self.demander(self.pompe, utilisateur=self.kossi)

        self.assertEqual(reponse.status_code, 403)

    def test_date_passee_refusee(self):
        reponse = self.demander(self.tracteur, jours=-1)

        self.assertEqual(reponse.status_code, 400)
        self.assertIn('date_debut', reponse.data)

    def test_date_trop_lointaine_refusee(self):
        self.assertEqual(self.demander(self.tracteur, jours=200).status_code, 400)

    def test_quantite_entiere_pour_jours_et_heures(self):
        self.assertEqual(self.demander(self.motoculteur, quantite='1.5').status_code, 400)
        self.assertEqual(self.demander(self.pompe, quantite='2.5').status_code, 400)
        self.assertEqual(self.demander(self.tracteur, quantite='1.5').status_code, 201)

    def test_quantite_nulle_ou_excessive_refusee(self):
        self.assertEqual(self.demander(self.tracteur, quantite='0').status_code, 400)
        self.assertEqual(self.demander(self.motoculteur, quantite='31').status_code, 400)

    def test_machine_retiree_refusee(self):
        Machine.objects.filter(pk=self.tracteur.pk).update(disponible=False)

        self.assertEqual(self.demander(self.tracteur).status_code, 400)

    def test_doublon_en_attente_du_meme_agriculteur_refuse(self):
        self.demander(self.tracteur)

        reponse = self.demander(self.tracteur)

        self.assertEqual(reponse.status_code, 400)

    def test_plusieurs_agriculteurs_peuvent_demander_la_meme_date(self):
        self.assertEqual(self.demander(self.tracteur).status_code, 201)
        self.assertEqual(self.demander(self.tracteur, utilisateur=self.afi).status_code, 201)

    # --- Listes ---

    def test_chacun_ne_voit_que_ses_demandes(self):
        self.demander(self.tracteur)
        self.demander(self.pompe, utilisateur=self.afi)

        self.connecter(self.mawuli)
        mes = self.client.get('/api/reservations/me/').data
        self.connecter(self.kossi)
        recues_kossi = self.client.get('/api/reservations/received/').data
        self.connecter(self.ama)
        recues_ama = self.client.get('/api/reservations/received/').data

        self.assertEqual([r['machine']['nom'] for r in mes], ['Tracteur'])
        self.assertEqual([r['machine']['nom'] for r in recues_kossi], ['Tracteur'])
        self.assertEqual([r['machine']['nom'] for r in recues_ama], ['Motopompe'])

    def test_demandes_recues_filtrables_par_statut(self):
        self.demander(self.tracteur)
        self.connecter(self.kossi)

        self.assertEqual(len(self.client.get('/api/reservations/received/?statut=EN_ATTENTE').data), 1)
        self.assertEqual(len(self.client.get('/api/reservations/received/?statut=ACCEPTEE').data), 0)

    def test_roles_respectes_sur_les_listes(self):
        self.connecter(self.mawuli)
        self.assertEqual(self.client.get('/api/reservations/received/').status_code, 403)
        self.connecter(self.kossi)
        self.assertEqual(self.client.get('/api/reservations/me/').status_code, 403)

    # --- Réponse du détenteur ---

    def test_accepter_refuse_automatiquement_les_demandes_concurrentes(self):
        premiere = self.demander(self.motoculteur, jours=3, quantite='3').data['id']   # jours 3 à 5
        chevauche = self.demander(self.motoculteur, jours=5, quantite='1', utilisateur=self.afi).data['id']
        autre_date = self.demander(self.motoculteur, jours=9, quantite='1', utilisateur=self.afi).data['id']

        self.connecter(self.kossi)
        reponse = self.client.patch(f'/api/reservations/{premiere}/accept/')

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['statut'], 'ACCEPTEE')
        self.assertIsNotNone(reponse.data['date_reponse'])
        self.assertEqual(Reservation.objects.get(pk=chevauche).statut, Statut.REFUSEE)
        self.assertEqual(Reservation.objects.get(pk=autre_date).statut, Statut.EN_ATTENTE)

    def test_date_acceptee_bloquee_pour_les_nouvelles_demandes(self):
        reservation = self.demander(self.motoculteur, jours=3, quantite='3').data['id']
        self.connecter(self.kossi)
        self.client.patch(f'/api/reservations/{reservation}/accept/')

        reponse = self.demander(self.motoculteur, jours=4, quantite='1', utilisateur=self.afi)

        self.assertEqual(reponse.status_code, 400)
        self.assertIn('déjà réservée', str(reponse.data['date_debut']))

    def test_refuser(self):
        reservation = self.demander(self.tracteur).data['id']
        self.connecter(self.kossi)

        reponse = self.client.patch(f'/api/reservations/{reservation}/reject/')

        self.assertEqual(reponse.data['statut'], 'REFUSEE')

    def test_on_ne_repond_pas_deux_fois(self):
        reservation = self.demander(self.tracteur).data['id']
        self.connecter(self.kossi)
        self.client.patch(f'/api/reservations/{reservation}/reject/')

        reponse = self.client.patch(f'/api/reservations/{reservation}/accept/')

        self.assertEqual(reponse.status_code, 400)

    def test_seul_le_proprietaire_de_la_machine_peut_repondre(self):
        reservation = self.demander(self.tracteur).data['id']

        self.connecter(self.ama)  # détentrice, mais pas de cette machine
        self.assertEqual(self.client.patch(f'/api/reservations/{reservation}/accept/').status_code, 404)
        self.connecter(self.afi)  # agricultrice
        self.assertEqual(self.client.patch(f'/api/reservations/{reservation}/accept/').status_code, 403)
        self.assertEqual(Reservation.objects.get(pk=reservation).statut, Statut.EN_ATTENTE)

    # --- Annulation ---

    def test_l_agriculteur_annule_sa_demande_en_attente(self):
        reservation = self.demander(self.tracteur).data['id']

        reponse = self.client.patch(f'/api/reservations/{reservation}/cancel/')

        self.assertEqual(reponse.data['statut'], 'ANNULEE')

    def test_on_ne_peut_pas_annuler_la_demande_d_un_autre(self):
        reservation = self.demander(self.tracteur).data['id']
        self.connecter(self.afi)

        self.assertEqual(self.client.patch(f'/api/reservations/{reservation}/cancel/').status_code, 404)


class TableauDeBordTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        def utilisateur(numero, role):
            return Utilisateur.objects.create_user(
                username=f'+2289100000{numero}', telephone=f'+2289100000{numero}', type_utilisateur=role, password='x',
            )

        cls.kossi = utilisateur(1, Role.DETENTEUR)
        cls.ama = utilisateur(2, Role.DETENTEUR)
        cls.mawuli = utilisateur(3, Role.AGRICULTEUR)

        def machine(proprietaire, nom, disponible=True):
            return Machine.objects.create(
                proprietaire=proprietaire, nom=nom, type_machine=Machine.TypeMachine.TRACTEUR, prix=10000,
                unite_prix=Machine.UnitePrix.JOUR, zone=Machine.Zone.KARA, localisation='Kara', disponible=disponible,
            )

        tracteur = machine(cls.kossi, 'Tracteur')
        semoir = machine(cls.kossi, 'Semoir', disponible=False)
        pompe = machine(cls.ama, 'Pompe')

        def reserver(machine, statut, jours):
            debut = timezone.localdate() + timedelta(days=jours)
            return Reservation.objects.create(
                agriculteur=cls.mawuli, machine=machine, date_debut=debut, date_fin=debut, quantite=1,
                prix_unitaire=10000, unite_prix=Machine.UnitePrix.JOUR, montant_estime=10000, statut=statut,
            )

        reserver(tracteur, Statut.EN_ATTENTE, 2)
        reserver(semoir, Statut.EN_ATTENTE, 4)
        reserver(tracteur, Statut.REFUSEE, 6)
        cls.dans_10 = reserver(tracteur, Statut.ACCEPTEE, 10)
        cls.dans_3 = reserver(semoir, Statut.ACCEPTEE, 3)
        cls.aujourdhui = reserver(tracteur, Statut.ACCEPTEE, 0)
        reserver(tracteur, Statut.ACCEPTEE, -5)  # passée
        reserver(pompe, Statut.EN_ATTENTE, 2)  # machine d'Ama
        reserver(pompe, Statut.ACCEPTEE, 7)

    def test_compteurs_et_prochaines_reservations_du_proprietaire(self):
        self.client.force_authenticate(self.kossi)

        reponse = self.client.get('/api/dashboard/')

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['nombre_machines'], 2)
        self.assertEqual(reponse.data['nombre_machines_disponibles'], 1)
        self.assertEqual(reponse.data['demandes_en_attente'], 2)
        self.assertEqual(reponse.data['reservations_a_venir'], 3)
        self.assertEqual(
            [r['id'] for r in reponse.data['prochaines_reservations']],
            [self.aujourdhui.id, self.dans_3.id, self.dans_10.id],
        )
        self.assertEqual(reponse.data['prochaines_reservations'][1]['machine']['nom'], 'Semoir')

    def test_proprietaire_sans_machine(self):
        nouveau = Utilisateur.objects.create_user(
            username='nouveau', telephone='+22891000009', type_utilisateur=Role.DETENTEUR, password='x',
        )
        self.client.force_authenticate(nouveau)

        reponse = self.client.get('/api/dashboard/')

        self.assertEqual(reponse.data['nombre_machines'], 0)
        self.assertEqual(reponse.data['reservations_a_venir'], 0)
        self.assertEqual(reponse.data['prochaines_reservations'], [])

    def test_au_plus_cinq_prochaines_reservations(self):
        tracteur = Machine.objects.get(nom='Tracteur')
        for jours in range(20, 26):
            debut = timezone.localdate() + timedelta(days=jours)
            Reservation.objects.create(
                agriculteur=self.mawuli, machine=tracteur, date_debut=debut, date_fin=debut, quantite=1,
                prix_unitaire=10000, unite_prix=Machine.UnitePrix.JOUR, montant_estime=10000, statut=Statut.ACCEPTEE,
            )
        self.client.force_authenticate(self.kossi)

        reponse = self.client.get('/api/dashboard/')

        self.assertEqual(reponse.data['reservations_a_venir'], 9)
        self.assertEqual(len(reponse.data['prochaines_reservations']), 5)

    def test_reserve_aux_proprietaires(self):
        self.assertEqual(self.client.get('/api/dashboard/').status_code, 401)
        self.client.force_authenticate(self.mawuli)
        self.assertEqual(self.client.get('/api/dashboard/').status_code, 403)


class MessagerieTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        def utilisateur(numero, prenom, role):
            return Utilisateur.objects.create_user(
                username=f'+2289200000{numero}', telephone=f'+2289200000{numero}',
                first_name=prenom, last_name='Test', type_utilisateur=role, password='x',
            )

        cls.kossi = utilisateur(1, 'Kossi', Role.DETENTEUR)
        cls.ama = utilisateur(2, 'Ama', Role.DETENTEUR)
        cls.mawuli = utilisateur(3, 'Mawuli', Role.AGRICULTEUR)
        cls.afi = utilisateur(4, 'Afi', Role.AGRICULTEUR)
        tracteur = Machine.objects.create(
            proprietaire=cls.kossi, nom='Tracteur', type_machine=Machine.TypeMachine.TRACTEUR, prix=10000,
            unite_prix=Machine.UnitePrix.JOUR, zone=Machine.Zone.KARA, localisation='Kara',
        )

        def reserver(statut, jours):
            debut = timezone.localdate() + timedelta(days=jours)
            return Reservation.objects.create(
                agriculteur=cls.mawuli, machine=tracteur, date_debut=debut, date_fin=debut, quantite=1,
                prix_unitaire=10000, unite_prix=Machine.UnitePrix.JOUR, montant_estime=10000, statut=statut,
            )

        cls.acceptee = reserver(Statut.ACCEPTEE, 5)
        cls.en_attente = reserver(Statut.EN_ATTENTE, 8)

    def url(self, reservation=None):
        return f'/api/reservations/{(reservation or self.acceptee).id}/messages/'

    def envoyer(self, auteur, texte):
        self.client.force_authenticate(auteur)
        return self.client.post(self.url(), {'texte': texte})

    def test_conversation_entre_l_agriculteur_et_le_proprietaire(self):
        envoi = self.envoyer(self.mawuli, '  Bonjour, je serai au champ à 7 h.  ')
        self.envoyer(self.kossi, 'Entendu, le chauffeur arrive à 7 h.')

        self.assertEqual(envoi.status_code, 201, envoi.data)
        self.assertEqual(envoi.data['texte'], 'Bonjour, je serai au champ à 7 h.')
        self.assertTrue(envoi.data['de_moi'])
        reponse = self.client.get(self.url())  # connecté en Kossi
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual([m['auteur']['nom'] for m in reponse.data], ['Mawuli Test', 'Kossi Test'])
        self.assertEqual([m['de_moi'] for m in reponse.data], [False, True])

    def test_ouvrir_la_conversation_marque_comme_lus_les_messages_recus(self):
        self.envoyer(self.mawuli, 'Message 1')
        self.envoyer(self.mawuli, 'Message 2')
        self.client.force_authenticate(self.kossi)
        self.assertEqual(self.client.get('/api/messages/unread/').data['total'], 2)
        tableau = self.client.get('/api/dashboard/').data
        self.assertEqual(tableau['messages_non_lus'], 2)
        self.assertEqual(tableau['prochaines_reservations'][0]['messages_non_lus'], 2)
        recues = self.client.get('/api/reservations/received/').data
        self.assertEqual(next(r for r in recues if r['id'] == self.acceptee.id)['messages_non_lus'], 2)

        self.client.get(self.url())

        self.assertEqual(self.client.get('/api/messages/unread/').data['total'], 0)
        # L'auteur voit que Kossi a lu ses messages (accusé de lecture).
        self.client.force_authenticate(self.mawuli)
        self.assertTrue(all(m['lu'] for m in self.client.get(self.url()).data))

    def test_relire_sa_propre_conversation_ne_marque_pas_ses_messages_comme_lus(self):
        self.envoyer(self.mawuli, 'Pas encore lu')

        self.client.get(self.url())  # Mawuli relit

        self.assertFalse(self.client.get(self.url()).data[0]['lu'])

    def test_ses_propres_messages_ne_comptent_pas_comme_non_lus(self):
        self.envoyer(self.mawuli, 'Bonjour')

        self.assertEqual(self.client.get('/api/messages/unread/').data['total'], 0)
        mes_demandes = self.client.get('/api/reservations/me/').data
        self.assertEqual(next(r for r in mes_demandes if r['id'] == self.acceptee.id)['messages_non_lus'], 0)

    def test_seulement_les_nouveaux_messages(self):
        premier = self.envoyer(self.mawuli, 'Un').data['id']
        self.envoyer(self.mawuli, 'Deux')

        reponse = self.client.get(self.url(), {'apres': premier})

        self.assertEqual([m['texte'] for m in reponse.data], ['Deux'])

    def test_fermee_tant_que_la_demande_n_est_pas_acceptee(self):
        self.client.force_authenticate(self.mawuli)

        self.assertEqual(self.client.get(self.url(self.en_attente)).status_code, 403)
        self.assertEqual(self.client.post(self.url(self.en_attente), {'texte': 'Allô ?'}).status_code, 403)
        self.assertFalse(Message.objects.exists())
        ouvertes = {r['id']: r['messagerie_ouverte'] for r in self.client.get('/api/reservations/me/').data}
        self.assertEqual(ouvertes, {self.acceptee.id: True, self.en_attente.id: False})

    def test_invisible_pour_les_autres_utilisateurs(self):
        self.envoyer(self.mawuli, 'Privé')

        for intrus in (self.ama, self.afi):
            self.client.force_authenticate(intrus)
            self.assertEqual(self.client.get(self.url()).status_code, 404)
            self.assertEqual(self.client.post(self.url(), {'texte': 'Coucou'}).status_code, 404)
            self.assertEqual(self.client.get('/api/messages/unread/').data['total'], 0)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url()).status_code, 401)
        self.assertEqual(Message.objects.count(), 1)

    def test_message_vide_ou_trop_long_refuse(self):
        self.assertEqual(self.envoyer(self.mawuli, '   ').status_code, 400)
        self.assertEqual(self.envoyer(self.mawuli, 'a' * (Message.LONGUEUR_MAX + 1)).status_code, 400)
        self.assertFalse(Message.objects.exists())

    def test_auteur_et_reservation_imposes_par_le_serveur(self):
        self.client.force_authenticate(self.mawuli)

        self.client.post(self.url(), {'texte': 'Salut', 'auteur': self.kossi.id, 'reservation': self.en_attente.id})

        message = Message.objects.get()
        self.assertEqual((message.auteur, message.reservation), (self.mawuli, self.acceptee))
