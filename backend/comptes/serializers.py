import re

from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .backends import trouver_utilisateur
from .codes import MESSAGE_CODE_REFUSE, verifier_code
from .models import CodeChangementTelephone, CodeReinitialisation, Utilisateur
from .photos import preparer_photo
from .telephone import normaliser_telephone

# Au moins une lettre : un nom d'utilisateur ne doit jamais pouvoir passer pour un numéro.
FORMAT_NOM_UTILISATEUR = re.compile(r'^(?=.*[A-Za-z])[A-Za-z0-9._]{3,30}$')


def _valider_telephone(valeur):
    try:
        return normaliser_telephone(valeur)
    except DjangoValidationError as erreur:
        raise serializers.ValidationError(erreur.messages) from erreur


def _valider_nom_utilisateur(valeur, utilisateur=None):
    """Format et unicité sans tenir compte des majuscules ; `utilisateur` = le compte qui peut le garder."""
    valeur = valeur.strip()
    if not FORMAT_NOM_UTILISATEUR.match(valeur):
        raise serializers.ValidationError(
            '3 à 30 caractères : lettres sans accent, chiffres, point ou tiret bas, avec au moins une lettre.'
        )
    autres = Utilisateur.objects.exclude(pk=utilisateur.pk) if utilisateur else Utilisateur.objects.all()
    if autres.filter(username__iexact=valeur).exists():
        raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
    return valeur


def _valider_email(valeur, utilisateur=None):
    if not valeur:
        return None
    valeur = valeur.strip().lower()
    autres = Utilisateur.objects.exclude(pk=utilisateur.pk) if utilisateur else Utilisateur.objects.all()
    if autres.filter(email__iexact=valeur).exists():
        raise serializers.ValidationError('Un compte existe déjà avec cette adresse.')
    return valeur


def _valider_mot_de_passe(champ, mot_de_passe, utilisateur):
    try:
        password_validation.validate_password(mot_de_passe, utilisateur)
    except DjangoValidationError as erreur:
        raise serializers.ValidationError({champ: erreur.messages}) from erreur


class UtilisateurSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)
    type_utilisateur_libelle = serializers.CharField(source='get_type_utilisateur_display', read_only=True)
    # Chemin relatif (/media/…), comme les photos de machines : marche derrière le proxy.
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'nom_complet', 'telephone',
            'type_utilisateur', 'type_utilisateur_libelle', 'localisation', 'photo',
        ]

    def get_photo(self, utilisateur):
        return utilisateur.photo.url if utilisateur.photo else None


class InscriptionSerializer(serializers.ModelSerializer):
    mot_de_passe = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = Utilisateur
        fields = [
            'username', 'email', 'first_name', 'last_name', 'telephone', 'mot_de_passe',
            'type_utilisateur', 'localisation',
        ]
        extra_kwargs = {
            # Unicité vérifiée sans tenir compte des majuscules dans validate_username / validate_email.
            'username': {'validators': []},
            'email': {'required': False, 'allow_null': True, 'allow_blank': True, 'validators': []},
            'first_name': {'required': True, 'allow_blank': False},
            'last_name': {'required': True, 'allow_blank': False},
            # Unicité vérifiée après normalisation dans validate_telephone.
            'telephone': {'required': True, 'allow_null': False, 'validators': []},
            'type_utilisateur': {'required': True},
        }

    def validate_username(self, valeur):
        return _valider_nom_utilisateur(valeur)

    def validate_email(self, valeur):
        return _valider_email(valeur)

    def validate_telephone(self, valeur):
        telephone = _valider_telephone(valeur)
        if Utilisateur.objects.filter(telephone=telephone).exists():
            raise serializers.ValidationError('Un compte existe déjà avec ce numéro. Connectez-vous.')
        return telephone

    def validate(self, donnees):
        utilisateur = Utilisateur(
            username=donnees['username'],
            email=donnees.get('email'),
            first_name=donnees['first_name'],
            last_name=donnees['last_name'],
        )
        _valider_mot_de_passe('mot_de_passe', donnees['mot_de_passe'], utilisateur)
        return donnees

    def create(self, donnees):
        mot_de_passe = donnees.pop('mot_de_passe')
        return Utilisateur.objects.create_user(password=mot_de_passe, **donnees)


class ConnexionSerializer(serializers.Serializer):
    # Nom d'utilisateur, e-mail ou numéro de téléphone.
    identifiant = serializers.CharField()
    mot_de_passe = serializers.CharField(style={'input_type': 'password'}, trim_whitespace=False)

    def validate(self, donnees):
        utilisateur = authenticate(
            self.context.get('request'), username=donnees['identifiant'], password=donnees['mot_de_passe']
        )
        if utilisateur is None:
            # Même message dans tous les cas : on ne révèle pas si le compte existe.
            raise serializers.ValidationError('Identifiant ou mot de passe incorrect.')
        donnees['utilisateur'] = utilisateur
        return donnees


class MotDePasseOublieSerializer(serializers.Serializer):
    # Nom d'utilisateur, e-mail ou numéro : le code part toujours par SMS au numéro du compte.
    identifiant = serializers.CharField()


class ReinitialisationSerializer(serializers.Serializer):
    identifiant = serializers.CharField()
    code = serializers.CharField()
    mot_de_passe = serializers.CharField(style={'input_type': 'password'}, trim_whitespace=False)

    def validate(self, donnees):
        utilisateur = trouver_utilisateur(donnees['identifiant'])
        code = CodeReinitialisation.objects.filter(utilisateur=utilisateur).first() if utilisateur else None
        if not verifier_code(code, donnees['code']):
            raise serializers.ValidationError({'code': MESSAGE_CODE_REFUSE})
        # Le code reste valable si le mot de passe est refusé : la personne n'a qu'à en choisir un autre.
        _valider_mot_de_passe('mot_de_passe', donnees['mot_de_passe'], utilisateur)
        donnees['utilisateur'] = utilisateur
        return donnees

    def save(self):
        utilisateur = self.validated_data['utilisateur']
        utilisateur.set_password(self.validated_data['mot_de_passe'])
        utilisateur.save(update_fields=['password'])
        CodeReinitialisation.objects.filter(utilisateur=utilisateur).delete()
        # Déconnecte les autres appareils : utile si quelqu'un d'autre connaissait l'ancien mot de passe.
        Token.objects.filter(user=utilisateur).delete()
        return utilisateur


class ModificationProfilSerializer(serializers.ModelSerializer):
    """PATCH /api/profile/ : informations, nom d'utilisateur et photo (le téléphone ne change pas ici)."""

    photo = serializers.FileField(required=False, write_only=True)
    supprimer_photo = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = Utilisateur
        fields = ['username', 'email', 'first_name', 'last_name', 'localisation', 'photo', 'supprimer_photo']
        extra_kwargs = {
            'username': {'validators': []},
            'email': {'allow_null': True, 'allow_blank': True, 'validators': []},
            'first_name': {'allow_blank': False},
            'last_name': {'allow_blank': False},
        }

    def validate_username(self, valeur):
        return _valider_nom_utilisateur(valeur, self.instance)

    def validate_email(self, valeur):
        return _valider_email(valeur, self.instance)

    def validate_photo(self, fichier):
        return preparer_photo(fichier)

    def update(self, utilisateur, donnees):
        nouvelle_photo = donnees.pop('photo', None)
        supprimer = donnees.pop('supprimer_photo', False)
        if (nouvelle_photo or supprimer) and utilisateur.photo:
            utilisateur.photo.delete(save=False)
        if nouvelle_photo:
            utilisateur.photo.save(nouvelle_photo.name, nouvelle_photo, save=False)
        return super().update(utilisateur, donnees)


class ChangementMotDePasseSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(style={'input_type': 'password'}, trim_whitespace=False)
    nouveau_mot_de_passe = serializers.CharField(style={'input_type': 'password'}, trim_whitespace=False)

    def validate(self, donnees):
        utilisateur = self.context['request'].user
        if not utilisateur.check_password(donnees['ancien_mot_de_passe']):
            raise serializers.ValidationError({'ancien_mot_de_passe': 'Mot de passe actuel incorrect.'})
        _valider_mot_de_passe('nouveau_mot_de_passe', donnees['nouveau_mot_de_passe'], utilisateur)
        return donnees

    def save(self):
        utilisateur = self.context['request'].user
        utilisateur.set_password(self.validated_data['nouveau_mot_de_passe'])
        utilisateur.save(update_fields=['password'])
        # Déconnecte tous les appareils ; la vue rend un nouveau jeton à celui-ci.
        Token.objects.filter(user=utilisateur).delete()
        return utilisateur


class DemandeChangementTelephoneSerializer(serializers.Serializer):
    telephone = serializers.CharField()

    def validate_telephone(self, valeur):
        telephone = _valider_telephone(valeur)
        utilisateur = self.context['request'].user
        if telephone == utilisateur.telephone:
            raise serializers.ValidationError("C'est déjà le numéro de votre compte.")
        if Utilisateur.objects.exclude(pk=utilisateur.pk).filter(telephone=telephone).exists():
            raise serializers.ValidationError('Ce numéro est déjà utilisé par un autre compte.')
        return telephone


class ConfirmationChangementTelephoneSerializer(serializers.Serializer):
    code = serializers.CharField()

    def validate(self, donnees):
        utilisateur = self.context['request'].user
        code = CodeChangementTelephone.objects.filter(utilisateur=utilisateur).first()
        if not verifier_code(code, donnees['code']):
            raise serializers.ValidationError({'code': MESSAGE_CODE_REFUSE})
        # Le numéro a pu être pris par un autre compte pendant les 10 minutes de validité.
        if Utilisateur.objects.exclude(pk=utilisateur.pk).filter(telephone=code.nouveau_telephone).exists():
            raise serializers.ValidationError({'code': 'Ce numéro vient d’être utilisé par un autre compte.'})
        donnees['code_sms'] = code
        return donnees

    def save(self):
        utilisateur = self.context['request'].user
        utilisateur.telephone = self.validated_data['code_sms'].nouveau_telephone
        utilisateur.save(update_fields=['telephone'])
        self.validated_data['code_sms'].delete()
        return utilisateur
