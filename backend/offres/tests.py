from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from comptes.models import Utilisateur
from machines.models import Machine

from .models import Offre, Proposition

Role = Utilisateur.TypeUtilisateur


def dans(jours):
    return (timezone.localdate() + timedelta(days=jours)).isoformat()


OFFRE = {
    'type_machine': 'BATTEUSE',
    'description': 'Batteuse à maïs pour 3 hectares après la récolte.',
    'zone': 'KARA',
    'localisation': 'Kara',
}


class OffreTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        def utilisateur(numero, prenom, role):
            return Utilisateur.objects.create_user(
                username=f'+2289100000{numero}', telephone=f'+2289100000{numero}',
                first_name=prenom, last_name='Test', type_utilisateur=role, password='x',
            )

        cls.afi = utilisateur(1, 'Afi', Role.AGRICULTEUR)
        cls.yao = utilisateur(2, 'Yao', Role.AGRICULTEUR)
        cls.kossi = utilisateur(3, 'Kossi', Role.DETENTEUR)
        cls.ama = utilisateur(4, 'Ama', Role.DETENTEUR)
        cls.batteuse = Machine.objects.create(
            proprietaire=cls.kossi, nom='Batteuse', type_machine=Machine.TypeMachine.BATTEUSE,
            prix=8000, zone=Machine.Zone.KARA, localisation='Kara',
        )

    def setUp(self):
        cache.clear()  # compteurs de limitation

    def lancer(self, **champs):
        self.client.force_authenticate(self.afi)
        return self.client.post('/api/offres/', {**OFFRE, **champs}, format='json')

    def test_parcours_complet(self):
        # L'agriculteur lance l'offre.
        reponse = self.lancer(date_souhaitee=dans(10), budget=10000, unite_budget='HECTARE')
        self.assertEqual(reponse.status_code, 201, reponse.data)
        offre_id = reponse.data['id']

        # Le propriétaire la voit, sans le nom de famille de l'agriculteur.
        self.client.force_authenticate(self.kossi)
        liste = self.client.get('/api/offres/', {'zone': 'KARA'}).data
        self.assertEqual([o['id'] for o in liste], [offre_id])
        self.assertEqual(liste[0]['agriculteur'], {'prenom': 'Afi'})

        # Il propose sa machine, une seule fois.
        proposer = lambda: self.client.post(
            f'/api/offres/{offre_id}/propose/', {'machine': self.batteuse.id, 'message': 'Libre ce mois-ci.'}
        )
        self.assertEqual(proposer().status_code, 201)
        self.assertIn('machine', proposer().data)
        self.assertEqual(self.client.get(f'/api/offres/{offre_id}/').data['mes_machines_proposees'], [self.batteuse.id])

        # L'agriculteur voit la proposition comme nouvelle tant qu'il ne l'a pas marquée vue.
        self.client.force_authenticate(self.afi)
        self.assertEqual(self.client.get('/api/offres/unseen/').data['total'], 1)
        for _ in range(2):  # une lecture ne change rien
            proposition = self.client.get('/api/offres/mine/').data[0]['propositions'][0]
            self.assertEqual((proposition['machine']['id'], proposition['nouvelle']), (self.batteuse.id, True))
        self.assertEqual(self.client.post('/api/offres/seen/').status_code, 204)
        self.assertFalse(self.client.get('/api/offres/mine/').data[0]['propositions'][0]['nouvelle'])
        self.assertEqual(self.client.get('/api/offres/unseen/').data['total'], 0)

        # Il ferme l'offre : elle disparaît pour les propriétaires.
        self.assertEqual(self.client.patch(f'/api/offres/{offre_id}/close/').data['statut'], 'FERMEE')
        self.client.force_authenticate(self.kossi)
        self.assertEqual(self.client.get('/api/offres/').data, [])
        self.assertEqual(proposer().status_code, 404)

    def test_roles(self):
        offre_id = self.lancer().data['id']
        self.client.force_authenticate(self.kossi)
        self.assertEqual(self.client.post('/api/offres/', OFFRE, format='json').status_code, 403)
        self.client.force_authenticate(self.afi)
        self.assertEqual(self.client.get('/api/offres/').status_code, 403)
        # Un autre agriculteur ne peut pas fermer l'offre.
        self.client.force_authenticate(self.yao)
        self.assertEqual(self.client.patch(f'/api/offres/{offre_id}/close/').status_code, 404)
        self.assertEqual(self.client.get('/api/offres/mine/').data, [])

    def test_proposition_refusee_pour_une_machine_d_un_autre_ou_indisponible(self):
        offre_id = self.lancer().data['id']
        self.client.force_authenticate(self.ama)
        reponse = self.client.post(f'/api/offres/{offre_id}/propose/', {'machine': self.batteuse.id})
        self.assertIn('machine', reponse.data)

        Machine.objects.filter(pk=self.batteuse.pk).update(disponible=False)
        self.client.force_authenticate(self.kossi)
        reponse = self.client.post(f'/api/offres/{offre_id}/propose/', {'machine': self.batteuse.id})
        self.assertIn('disponible', reponse.data['machine'][0])
        self.assertFalse(Proposition.objects.exists())

    def test_validation(self):
        reponse = self.lancer(description='  ', localisation='', date_souhaitee=dans(-1), budget=0)
        self.assertEqual(set(reponse.data), {'description', 'localisation', 'date_souhaitee', 'budget'})
        self.assertEqual(self.lancer(type_machine='FUSEE').status_code, 400)

    def test_cinq_offres_ouvertes_au_plus(self):
        for _ in range(Offre.OUVERTES_MAX):
            self.assertEqual(self.lancer().status_code, 201)
        reponse = self.lancer()
        self.assertEqual(reponse.status_code, 400)
        self.assertIn('Fermez-en une', reponse.data['non_field_errors'][0])
