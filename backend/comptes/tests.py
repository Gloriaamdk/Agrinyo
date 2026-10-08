import io
import os
import re
import tempfile
from datetime import timedelta

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from . import sms
from .models import CodeReinitialisation, Utilisateur
from .telephone import normaliser_telephone

INSCRIPTION = {
    'username': 'mawuli.a',
    'email': 'Mawuli@Exemple.tg',
    'first_name': 'Mawuli',
    'last_name': 'Ahiable',
    'telephone': '90 12 34 56',
    'mot_de_passe': 'champ-de-mais-2026',
    'type_utilisateur': 'AGRICULTEUR',
    'localisation': 'Tsévié',
}


class NormalisationTelephoneTests(SimpleTestCase):
    def test_formats_acceptes(self):
        for saisie in ['90 12 34 56', '90123456', '+228 90 12 34 56', '00228 90-12-34-56']:
            self.assertEqual(normaliser_telephone(saisie), '+22890123456', saisie)

    def test_numero_local_commencant_par_00(self):
        # Numéros des comptes de démonstration : ce « 00 » n'est pas un préfixe international.
        self.assertEqual(normaliser_telephone('00 00 01 01'), '+22800000101')

    def test_formats_refuses(self):
        for saisie in ['', '1234', '+33 6 12 34 56 78', '901234567']:
            with self.assertRaises(ValidationError, msg=saisie):
                normaliser_telephone(saisie)


class AuthentificationTests(APITestCase):
    def setUp(self):
        cache.clear()  # remet à zéro les compteurs de limitation

    def test_inscription_renvoie_un_jeton_et_normalise_le_numero(self):
        reponse = self.client.post('/api/register/', INSCRIPTION)

        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertTrue(reponse.data['token'])
        self.assertEqual(reponse.data['utilisateur']['telephone'], '+22890123456')
        self.assertEqual(reponse.data['utilisateur']['type_utilisateur'], 'AGRICULTEUR')
        self.assertNotIn('mot_de_passe', reponse.data['utilisateur'])

    def test_inscription_refuse_un_numero_deja_utilise_quel_que_soit_son_format(self):
        self.client.post('/api/register/', INSCRIPTION)

        reponse = self.client.post('/api/register/', {**INSCRIPTION, 'telephone': '+228 90123456'})

        self.assertEqual(reponse.status_code, 400)
        self.assertIn('telephone', reponse.data)

    def test_inscription_refuse_un_mot_de_passe_trop_simple(self):
        reponse = self.client.post('/api/register/', {**INSCRIPTION, 'mot_de_passe': '1234'})

        self.assertEqual(reponse.status_code, 400)
        self.assertIn('mot_de_passe', reponse.data)

    def test_inscription_exige_le_role(self):
        donnees = {k: v for k, v in INSCRIPTION.items() if k != 'type_utilisateur'}

        reponse = self.client.post('/api/register/', donnees)

        self.assertEqual(reponse.status_code, 400)
        self.assertIn('type_utilisateur', reponse.data)

    def test_connexion_avec_le_numero_saisi_autrement(self):
        self.client.post('/api/register/', INSCRIPTION)

        reponse = self.client.post('/api/login/', {'identifiant': '+22890123456', 'mot_de_passe': INSCRIPTION['mot_de_passe']})

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['utilisateur']['first_name'], 'Mawuli')

    def test_connexion_refusee_avec_un_message_neutre(self):
        self.client.post('/api/register/', INSCRIPTION)

        mauvais_mdp = self.client.post('/api/login/', {'identifiant': '90123456', 'mot_de_passe': 'faux'})
        inconnu = self.client.post('/api/login/', {'identifiant': '91000000', 'mot_de_passe': 'faux'})

        self.assertEqual(mauvais_mdp.status_code, 400)
        # Même message : on ne révèle pas si le numéro a un compte.
        self.assertEqual(mauvais_mdp.data, inconnu.data)

    def test_connexion_avec_le_nom_d_utilisateur_ou_l_email_sans_tenir_compte_des_majuscules(self):
        self.client.post('/api/register/', INSCRIPTION)

        for identifiant in ['mawuli.a', 'MAWULI.A', 'mawuli@exemple.tg', ' Mawuli@EXEMPLE.tg ']:
            reponse = self.client.post('/api/login/', {'identifiant': identifiant, 'mot_de_passe': INSCRIPTION['mot_de_passe']})
            self.assertEqual(reponse.status_code, 200, identifiant)

    def test_identifiant_inconnu_meme_message_que_mauvais_mot_de_passe(self):
        self.client.post('/api/register/', INSCRIPTION)

        mauvais_mdp = self.client.post('/api/login/', {'identifiant': 'mawuli.a', 'mot_de_passe': 'faux'})
        inconnu = self.client.post('/api/login/', {'identifiant': 'personne@exemple.tg', 'mot_de_passe': 'faux'})

        self.assertEqual(mauvais_mdp.data, inconnu.data)

    def test_inscription_enregistre_l_email_en_minuscules_et_le_rend_facultatif(self):
        avec = self.client.post('/api/register/', INSCRIPTION)
        sans = self.client.post('/api/register/', {
            **INSCRIPTION, 'username': 'afi_k', 'email': '', 'telephone': '91000000',
        })
        sans_bis = self.client.post('/api/register/', {
            **INSCRIPTION, 'username': 'djibril', 'email': '', 'telephone': '92000000',
        })

        self.assertEqual(avec.data['utilisateur']['email'], 'mawuli@exemple.tg')
        self.assertEqual(sans.status_code, 201, sans.data)
        self.assertEqual(sans_bis.status_code, 201, sans_bis.data)
        self.assertIsNone(sans.data['utilisateur']['email'])

    def test_inscription_refuse_un_nom_ou_un_email_deja_pris_quelle_que_soit_la_casse(self):
        self.client.post('/api/register/', INSCRIPTION)

        nom_pris = self.client.post('/api/register/', {
            **INSCRIPTION, 'username': 'Mawuli.A', 'email': '', 'telephone': '91000000',
        })
        email_pris = self.client.post('/api/register/', {
            **INSCRIPTION, 'username': 'autre', 'email': 'MAWULI@exemple.tg', 'telephone': '91000000',
        })

        self.assertIn('username', nom_pris.data)
        self.assertIn('email', email_pris.data)

    def test_inscription_refuse_un_nom_d_utilisateur_invalide(self):
        # Un nom fait uniquement de chiffres se confondrait avec un numéro de téléphone.
        for nom in ['90123456', 'ab', 'avec espace', 'nom@site', 'é' * 5]:
            reponse = self.client.post('/api/register/', {**INSCRIPTION, 'username': nom})
            self.assertIn('username', reponse.data, nom)

    def test_profil_et_deconnexion(self):
        jeton = self.client.post('/api/register/', INSCRIPTION).data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {jeton}')

        self.assertEqual(self.client.get('/api/profile/').data['nom_complet'], 'Mawuli Ahiable')
        self.assertEqual(self.client.post('/api/logout/').status_code, 204)
        self.assertEqual(self.client.get('/api/profile/').status_code, 401)

    def test_site_web_recoit_un_cookie_httponly_et_aucun_jeton(self):
        web = APIClient(enforce_csrf_checks=True, HTTP_X_AGRILINK_CLIENT='web')
        Utilisateur.objects.create_user(username='kossi', telephone='+22890123456', password='x')

        reponse = web.post('/api/login/', {'identifiant': 'kossi', 'mot_de_passe': 'x'}, format='json')

        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertNotIn('token', reponse.data)
        self.assertFalse(Token.objects.exists())
        self.assertTrue(reponse.cookies['sessionid']['httponly'])
        self.assertEqual(web.get('/api/profile/').data['username'], 'kossi')

        # Sans en-tête CSRF, une écriture est refusée ; avec, elle passe.
        self.assertEqual(web.post('/api/logout/').status_code, 403)
        csrf = web.cookies['csrftoken'].value
        self.assertEqual(web.post('/api/logout/', HTTP_X_CSRFTOKEN=csrf).status_code, 204)
        self.assertEqual(web.get('/api/profile/').status_code, 401)

    def test_site_web_sans_se_souvenir_de_moi_ferme_la_session_avec_le_navigateur(self):
        web = APIClient(HTTP_X_AGRILINK_CLIENT='web')
        Utilisateur.objects.create_user(username='kossi', telephone='+22890123456', password='x')

        reponse = web.post('/api/login/', {'identifiant': 'kossi', 'mot_de_passe': 'x', 'se_souvenir': False}, format='json')

        self.assertEqual(reponse.cookies['sessionid']['max-age'], '')

    def test_profil_exige_une_connexion(self):
        self.assertEqual(self.client.get('/api/profile/').status_code, 401)

    def test_trop_d_essais_de_connexion_sont_freines(self):
        Utilisateur.objects.create_user(username='+22890123456', telephone='+22890123456', password='x')

        codes = [
            self.client.post('/api/login/', {'identifiant': '90123456', 'mot_de_passe': 'faux'}).status_code
            for _ in range(11)
        ]

        self.assertEqual(codes[-1], 429)


@override_settings(SMS_BACKEND='memoire')
class MotDePasseOublieTests(APITestCase):
    NOUVEAU = 'nouvelle-recolte-2027'

    def setUp(self):
        cache.clear()
        sms.boite_envoi.clear()
        self.client.post('/api/register/', INSCRIPTION)

    def demander(self, identifiant='mawuli.a'):
        return self.client.post('/api/password/forgot/', {'identifiant': identifiant})

    def code_recu(self):
        numero, texte = sms.boite_envoi[-1]
        return numero, re.search(r'\b(\d{6})\b', texte).group(1)

    def reinitialiser(self, code, mot_de_passe=NOUVEAU, identifiant='mawuli.a'):
        return self.client.post(
            '/api/password/reset/', {'identifiant': identifiant, 'code': code, 'mot_de_passe': mot_de_passe}
        )

    def test_parcours_complet_par_sms(self):
        ancien_jeton = Token.objects.get(user__username='mawuli.a').key

        self.assertEqual(self.demander('90 12 34 56').status_code, 200)
        numero, code = self.code_recu()
        reponse = self.reinitialiser(code)

        self.assertEqual(numero, '+22890123456')
        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertTrue(reponse.data['token'])
        # Les autres appareils sont déconnectés et l'ancien mot de passe ne marche plus.
        self.assertFalse(Token.objects.filter(key=ancien_jeton).exists())
        connexion = lambda mdp: self.client.post('/api/login/', {'identifiant': 'mawuli.a', 'mot_de_passe': mdp})
        self.assertEqual(connexion(self.NOUVEAU).status_code, 200)
        self.assertEqual(connexion(INSCRIPTION['mot_de_passe']).status_code, 400)
        # Le code ne sert qu'une fois.
        self.assertEqual(self.reinitialiser(code, 'encore-un-autre-2028').status_code, 400)

    def test_meme_reponse_pour_un_compte_inconnu_et_aucun_sms(self):
        connu = self.demander()
        inconnu = self.demander('personne@exemple.tg')

        self.assertEqual((connu.status_code, connu.data), (inconnu.status_code, inconnu.data))
        self.assertEqual(len(sms.boite_envoi), 1)

    def test_pas_de_second_sms_avant_une_minute(self):
        self.demander()
        self.demander()
        self.assertEqual(len(sms.boite_envoi), 1)

        CodeReinitialisation.objects.update(cree_le=timezone.now() - timedelta(seconds=61))
        self.demander()
        self.assertEqual(len(sms.boite_envoi), 2)

    def test_code_expire_apres_dix_minutes(self):
        self.demander()
        _, code = self.code_recu()
        CodeReinitialisation.objects.update(cree_le=timezone.now() - timedelta(minutes=11))

        reponse = self.reinitialiser(code)

        self.assertEqual(reponse.status_code, 400)
        self.assertIn('code', reponse.data)

    def test_code_bloque_apres_cinq_essais_faux(self):
        self.demander()
        _, code = self.code_recu()
        faux = '000000' if code != '000000' else '111111'

        for _ in range(5):
            self.assertEqual(self.reinitialiser(faux).status_code, 400)

        self.assertEqual(self.reinitialiser(code).status_code, 400)

    def test_mot_de_passe_refuse_garde_le_code_valable(self):
        self.demander()
        _, code = self.code_recu()

        refuse = self.reinitialiser(code, mot_de_passe='1234')
        accepte = self.reinitialiser(code)

        self.assertIn('mot_de_passe', refuse.data)
        self.assertEqual(accepte.status_code, 200)

    @override_settings(SMS_BACKEND='inconnu')
    def test_echec_d_envoi_signale_et_permet_de_redemander(self):
        reponse = self.demander()

        self.assertEqual(reponse.status_code, 503)
        self.assertFalse(CodeReinitialisation.objects.exists())


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ModificationProfilTests(APITestCase):
    def setUp(self):
        cache.clear()
        jeton = self.client.post('/api/register/', INSCRIPTION).data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {jeton}')
        self.autre = Utilisateur.objects.create_user(
            username='afi_k', email='afi@exemple.tg', telephone='+22891000000', password='x'
        )

    def image(self, taille=(1200, 800), nom='photo.png'):
        tampon = io.BytesIO()
        Image.new('RGB', taille, 'green').save(tampon, format='PNG')
        return SimpleUploadedFile(nom, tampon.getvalue(), content_type='image/png')

    def test_modifier_informations_et_nom_d_utilisateur(self):
        reponse = self.client.patch(
            '/api/profile/', {'username': 'Mawuli_A', 'first_name': 'Mawulé', 'localisation': 'Kpalimé'}, format='json'
        )

        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data['username'], 'Mawuli_A')
        self.assertEqual(reponse.data['first_name'], 'Mawulé')
        # Le nouveau nom sert aussitôt à se connecter.
        connexion = self.client.post('/api/login/', {'identifiant': 'mawuli_a', 'mot_de_passe': INSCRIPTION['mot_de_passe']})
        self.assertEqual(connexion.status_code, 200)

    def test_garder_son_propre_nom_ou_email_est_permis(self):
        reponse = self.client.patch(
            '/api/profile/', {'username': 'MAWULI.A', 'email': 'mawuli@exemple.tg'}, format='json'
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)

    def test_nom_ou_email_d_un_autre_compte_refuse(self):
        nom = self.client.patch('/api/profile/', {'username': 'AFI_K'}, format='json')
        email = self.client.patch('/api/profile/', {'email': 'Afi@exemple.tg'}, format='json')

        self.assertIn('username', nom.data)
        self.assertIn('email', email.data)

    def test_le_telephone_ne_change_pas_par_le_profil(self):
        self.client.patch('/api/profile/', {'telephone': '92000000'}, format='json')
        self.assertEqual(self.client.get('/api/profile/').data['telephone'], '+22890123456')

    def test_photo_reduite_puis_supprimee(self):
        envoi = self.client.patch('/api/profile/', {'photo': self.image()}, format='multipart')

        self.assertEqual(envoi.status_code, 200, envoi.data)
        self.assertTrue(envoi.data['photo'].startswith('/media/profils/'))
        utilisateur = Utilisateur.objects.get(username='mawuli.a')
        with Image.open(utilisateur.photo.path) as image:
            self.assertEqual(max(image.size), 512)
        chemin = utilisateur.photo.path

        suppression = self.client.patch('/api/profile/', {'supprimer_photo': True}, format='json')

        self.assertIsNone(suppression.data['photo'])
        self.assertFalse(os.path.exists(chemin))

    def test_fichier_qui_n_est_pas_une_image_refuse(self):
        faux = SimpleUploadedFile('photo.png', b'pas une image', content_type='image/png')
        reponse = self.client.patch('/api/profile/', {'photo': faux}, format='multipart')
        self.assertIn('photo', reponse.data)

    def test_changer_de_mot_de_passe(self):
        mauvais = self.client.post(
            '/api/password/change/', {'ancien_mot_de_passe': 'faux', 'nouveau_mot_de_passe': 'nouvelle-recolte-2027'}
        )
        bon = self.client.post('/api/password/change/', {
            'ancien_mot_de_passe': INSCRIPTION['mot_de_passe'], 'nouveau_mot_de_passe': 'nouvelle-recolte-2027',
        })

        self.assertIn('ancien_mot_de_passe', mauvais.data)
        self.assertEqual(bon.status_code, 200, bon.data)
        # L'ancien jeton ne marche plus, le nouveau oui.
        self.assertEqual(self.client.get('/api/profile/').status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {bon.data['token']}")
        self.assertEqual(self.client.get('/api/profile/').status_code, 200)

    def test_nouveau_mot_de_passe_trop_simple_refuse(self):
        reponse = self.client.post(
            '/api/password/change/', {'ancien_mot_de_passe': INSCRIPTION['mot_de_passe'], 'nouveau_mot_de_passe': '1234'}
        )
        self.assertIn('nouveau_mot_de_passe', reponse.data)


@override_settings(SMS_BACKEND='memoire')
class ChangementTelephoneTests(APITestCase):
    def setUp(self):
        cache.clear()
        sms.boite_envoi.clear()
        jeton = self.client.post('/api/register/', INSCRIPTION).data['token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {jeton}')

    def demander(self, telephone='93 00 00 00'):
        return self.client.post('/api/profile/phone/', {'telephone': telephone})

    def confirmer(self, code):
        return self.client.post('/api/profile/phone/confirm/', {'code': code})

    def code_recu(self):
        numero, texte = sms.boite_envoi[-1]
        return numero, re.search(r'\b(\d{6})\b', texte).group(1)

    def test_code_envoye_au_nouveau_numero_puis_numero_change(self):
        demande = self.demander()
        numero, code = self.code_recu()

        # Rien ne change tant que le code n'est pas saisi.
        self.assertEqual(self.client.get('/api/profile/').data['telephone'], '+22890123456')
        reponse = self.confirmer(code)

        self.assertEqual(demande.status_code, 200, demande.data)
        self.assertEqual(numero, '+22893000000')
        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data['telephone'], '+22893000000')
        # Le nouveau numéro sert aussitôt à se connecter, l'ancien plus.
        connexion = lambda tel: self.client.post('/api/login/', {'identifiant': tel, 'mot_de_passe': INSCRIPTION['mot_de_passe']})
        self.assertEqual(connexion('93000000').status_code, 200)
        self.assertEqual(connexion('90123456').status_code, 400)

    def test_numero_actuel_ou_pris_par_un_autre_refuse(self):
        Utilisateur.objects.create_user(username='afi_k', telephone='+22891000000', password='x')

        actuel = self.demander('90 12 34 56')
        pris = self.demander('91000000')

        self.assertIn('telephone', actuel.data)
        self.assertIn('telephone', pris.data)
        self.assertEqual(sms.boite_envoi, [])

    def test_un_seul_sms_par_minute_meme_vers_un_autre_numero(self):
        self.demander('93000000')
        second = self.demander('94000000')

        self.assertEqual(second.status_code, 429)
        self.assertEqual(len(sms.boite_envoi), 1)

    def test_code_faux_bloque_apres_cinq_essais(self):
        self.demander()
        _, code = self.code_recu()
        faux = '000000' if code != '000000' else '111111'

        for _ in range(5):
            self.assertEqual(self.confirmer(faux).status_code, 400)

        self.assertEqual(self.confirmer(code).status_code, 400)
        self.assertEqual(self.client.get('/api/profile/').data['telephone'], '+22890123456')

    def test_numero_pris_entre_temps_refuse(self):
        self.demander()
        _, code = self.code_recu()
        Utilisateur.objects.create_user(username='rapide', telephone='+22893000000', password='x')

        reponse = self.confirmer(code)

        self.assertIn('code', reponse.data)
        self.assertEqual(self.client.get('/api/profile/').data['telephone'], '+22890123456')

    def test_exige_une_connexion(self):
        self.client.credentials()
        self.assertEqual(self.demander().status_code, 401)


class JetonCsrfTests(APITestCase):
    """Site sur un autre domaine que l'API : le jeton CSRF n'est pas lisible dans le cookie, il le demande."""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def test_le_jeton_donne_par_l_api_permet_une_ecriture(self):
        utilisateur = Utilisateur.objects.create_user(
            username='kossi', telephone='+22890000001', password='Tracteur-2026!',
            first_name='Kossi', last_name='A', type_utilisateur='DETENTEUR',
        )
        self.client.force_login(utilisateur)
        jeton = self.client.get('/api/csrf/').data['csrf']

        sans_jeton = self.client.patch('/api/profile/', {'localisation': 'Kara'}, format='json')
        avec_jeton = self.client.patch(
            '/api/profile/', {'localisation': 'Kara'}, format='json', HTTP_X_CSRFTOKEN=jeton,
        )

        self.assertEqual(sans_jeton.status_code, 403)
        self.assertEqual(avec_jeton.status_code, 200, avec_jeton.data)


class SanteTests(APITestCase):
    def test_l_api_et_la_base_repondent(self):
        reponse = self.client.get('/api/sante/')

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json(), {'statut': 'ok'})
