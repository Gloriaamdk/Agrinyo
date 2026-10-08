from django.urls import path

from .views import (
    ChangementMotDePasseView, ChangementTelephoneView, ConfirmationTelephoneView, ConnexionView, DeconnexionView, JetonCsrfView,
    InscriptionView, MotDePasseOublieView, ProfilView, ReinitialisationView,
)

urlpatterns = [
    path('csrf/', JetonCsrfView.as_view(), name='jeton-csrf'),
    path('register/', InscriptionView.as_view(), name='inscription'),
    path('login/', ConnexionView.as_view(), name='connexion'),
    path('logout/', DeconnexionView.as_view(), name='deconnexion'),
    path('profile/', ProfilView.as_view(), name='profil'),
    path('profile/phone/', ChangementTelephoneView.as_view(), name='changement-telephone'),
    path('profile/phone/confirm/', ConfirmationTelephoneView.as_view(), name='confirmation-telephone'),
    path('password/forgot/', MotDePasseOublieView.as_view(), name='mot-de-passe-oublie'),
    path('password/reset/', ReinitialisationView.as_view(), name='reinitialisation'),
    path('password/change/', ChangementMotDePasseView.as_view(), name='changement-mot-de-passe'),
]
