from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from comptes.sms import ErreurEnvoiSms, envoyer_sms, masquer
from comptes.telephone import normaliser_telephone


class Command(BaseCommand):
    help = 'Envoie un SMS de test avec la configuration actuelle (SMS_BACKEND, TWILIO_*).'

    def add_arguments(self, parser):
        parser.add_argument('numero', help='Numéro du destinataire, ex. 90123456 ou +22890123456')

    def handle(self, *args, numero, **options):
        try:
            numero = normaliser_telephone(numero)
        except Exception as erreur:  # noqa: BLE001 — message de validation lisible
            raise CommandError(f'Numéro invalide : {erreur}') from erreur
        self.stdout.write(f'Envoi par « {settings.SMS_BACKEND} » au {masquer(numero)}…')
        try:
            envoyer_sms(numero, 'AgriLink : SMS de test. La configuration fonctionne.')
        except ErreurEnvoiSms as erreur:
            raise CommandError(f'Échec : {erreur}') from erreur
        self.stdout.write(self.style.SUCCESS('SMS envoyé.'))
