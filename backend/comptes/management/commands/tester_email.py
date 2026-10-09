from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Envoie un e-mail de test avec la configuration actuelle (EMAIL_BACKEND, EMAIL_HOST…)."

    def add_arguments(self, parser):
        parser.add_argument('adresse', help='Adresse du destinataire')

    def handle(self, *args, adresse, **options):
        self.stdout.write(f'Envoi depuis « {settings.DEFAULT_FROM_EMAIL} » à {adresse}…')
        try:
            send_mail(
                'AgriLink : e-mail de test',
                "Bonjour,\n\nCet e-mail confirme que l'envoi des codes AgriLink fonctionne.\n\nL'équipe AgriLink\n",
                None,
                [adresse],
            )
        except Exception as erreur:  # noqa: BLE001 — afficher la cause exacte (SMTP, réseau, identifiants)
            raise CommandError(f'Échec : {type(erreur).__name__} : {erreur}') from erreur
        self.stdout.write(self.style.SUCCESS('E-mail envoyé.'))
