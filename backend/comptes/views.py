from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .changement_telephone import demander_changement
from .reinitialisation import demander_code
from .serializers import (
    ChangementMotDePasseSerializer, ConfirmationChangementTelephoneSerializer, ConnexionSerializer,
    DemandeChangementTelephoneSerializer, InscriptionSerializer, ModificationProfilSerializer,
    MotDePasseOublieSerializer, ReinitialisationSerializer, UtilisateurSerializer,
)
from .envoi_code import EMAIL, ErreurEnvoiCode, canal, destinataire_masque


def _client_web(request):
    """Le site React s'annonce par cet en-tête ; l'app Flutter n'en envoie pas."""
    return request.headers.get('X-Agrilink-Client') == 'web'


def _reponse_session(request, utilisateur, statut=status.HTTP_200_OK, persistant=True):
    """
    Web : session Django dans un cookie HttpOnly, aucun jeton dans la réponse (le JavaScript n'y a pas accès).
    Mobile : jeton à envoyer dans l'en-tête « Authorization: Token … ».
    persistant : faux = session fermée avec le navigateur (pas de « Se souvenir de moi »).
    """
    profil = UtilisateurSerializer(utilisateur).data
    if not _client_web(request):
        token, _ = Token.objects.get_or_create(user=utilisateur)
        return Response({'token': token.key, 'utilisateur': profil}, status=statut)
    login(request, utilisateur)
    request.session.set_expiry(None if persistant else 0)
    return Response({'utilisateur': profil}, status=statut)


class InscriptionView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'inscription'

    def post(self, request):
        serializer = InscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return _reponse_session(request, serializer.save(), status.HTTP_201_CREATED)


class ConnexionView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'connexion'

    def post(self, request):
        serializer = ConnexionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        se_souvenir = request.data.get('se_souvenir', True) not in (False, 'false', '0')
        return _reponse_session(request, serializer.validated_data['utilisateur'], persistant=se_souvenir)


class DeconnexionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class JetonCsrfView(APIView):
    """
    GET /api/csrf/ : jeton CSRF pour l'en-tête X-CSRFToken des écritures du site.
    Le site le lit d'habitude dans le cookie « csrftoken » ; quand l'API est sur un autre domaine,
    ce cookie n'est pas lisible par son JavaScript et il le demande ici.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'csrf': get_token(request)})


class ProfilView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    # Le site lit ce cookie pour l'en-tête X-CSRFToken de ses requêtes POST/PATCH.
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response(UtilisateurSerializer(request.user).data)

    def patch(self, request):
        # JSON pour les informations, multipart quand une photo est envoyée.
        serializer = ModificationProfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UtilisateurSerializer(request.user).data)


class ChangementMotDePasseView(APIView):
    """Mot de passe actuel + nouveau. Les autres appareils sont déconnectés ; celui-ci reste connecté."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'changement_mot_de_passe'

    def post(self, request):
        serializer = ChangementMotDePasseSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        # Garde le choix « Se souvenir de moi » de la session en cours.
        persistant = not (_client_web(request) and request.session.get_expire_at_browser_close())
        return _reponse_session(request, serializer.save(), persistant=persistant)


class MotDePasseOublieView(APIView):
    """Étape 1 : envoie un code (e-mail ou SMS). Même réponse que le compte existe ou non."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'mot_de_passe_oublie'

    def post(self, request):
        serializer = MotDePasseOublieSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            demander_code(serializer.validated_data['identifiant'])
        except ErreurEnvoiCode:
            return Response(
                {'detail': "Le code n'a pas pu être envoyé. Réessayez dans un instant."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if canal() == EMAIL:
            detail = 'Si un compte avec une adresse e-mail correspond, un code vient de partir par e-mail.'
        else:
            detail = 'Si un compte correspond, un code vient de partir par SMS.'
        return Response({'detail': detail, 'canal': canal()})


class ReinitialisationView(APIView):
    """Étape 2 : code reçu + nouveau mot de passe. Connecte directement la personne."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'reinitialisation'

    def post(self, request):
        serializer = ReinitialisationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Pas de « Se souvenir de moi » sur cet écran : la session dure le temps du navigateur.
        return _reponse_session(request, serializer.save(), persistant=False)


class ChangementTelephoneView(APIView):
    """Étape 1 : envoie un code au nouveau numéro. Le numéro du compte ne change pas encore."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'changement_telephone'

    def post(self, request):
        serializer = DemandeChangementTelephoneSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        telephone = serializer.validated_data['telephone']
        try:
            demander_changement(request.user, telephone)
        except ErreurEnvoiCode:
            return Response(
                {'detail': "Le code n'a pas pu être envoyé. Réessayez dans un instant."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        envoye_a = destinataire_masque(request.user, telephone)
        moyen = 'par e-mail à' if canal() == EMAIL else 'par SMS au'
        return Response({
            'detail': f'Un code vient de partir {moyen} {envoye_a}.',
            'telephone': telephone,
            'canal': canal(),
            'destinataire': envoye_a,
        })


class ConfirmationTelephoneView(APIView):
    """Étape 2 : le code reçu sur le nouveau numéro. Renvoie le profil à jour."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'reinitialisation'

    def post(self, request):
        serializer = ConfirmationChangementTelephoneSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        return Response(UtilisateurSerializer(serializer.save()).data)
