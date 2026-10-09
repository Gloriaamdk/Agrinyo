from django.db import transaction
from django.utils import timezone

from .backends import trouver_utilisateur
from .codes import DELAI_RENVOI, generer_code
from .envoi_code import destinataire, envoyer_code, texte_email
from .models import CodeReinitialisation


def demander_code(identifiant):
    """
    Envoie un code au compte correspondant (e-mail ou SMS selon OTP_CANAL), s'il existe et a une adresse
    pour ce canal. Ne dit rien sinon : la réponse de l'API doit rester la même.
    Lève ErreurEnvoiCode si l'envoi échoue.
    """
    utilisateur = trouver_utilisateur(identifiant)
    if utilisateur is None or not utilisateur.is_active or not destinataire(utilisateur):
        return
    with transaction.atomic():
        precedent = CodeReinitialisation.objects.select_for_update().filter(utilisateur=utilisateur).first()
        if precedent and timezone.now() < precedent.cree_le + DELAI_RENVOI:
            return
        if precedent:
            precedent.delete()
        code, code_hache = generer_code()
        nouveau = CodeReinitialisation.objects.create(utilisateur=utilisateur, code_hache=code_hache)
    minutes = int(CodeReinitialisation.DUREE_VALIDITE.total_seconds() // 60)
    try:
        envoyer_code(
            utilisateur,
            sujet=f'AgriLink : votre code {code}',
            texte_email=texte_email(utilisateur, (
                f'Votre code pour choisir un nouveau mot de passe : {code}\n'
                f'Il expire dans {minutes} minutes. Ne le communiquez à personne.\n\n'
                "Si vous n'avez rien demandé, ignorez ce message : votre mot de passe ne change pas."
            )),
            texte_sms=f'AgriLink : votre code est {code}. Il expire dans {minutes} minutes. Ne le communiquez à personne.',
        )
    except Exception:
        # Code jamais reçu, quelle que soit la panne : on permet de redemander tout de suite.
        nouveau.delete()
        raise
