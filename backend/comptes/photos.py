import io
import uuid

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

TAILLE_MAX_OCTETS = 5 * 1024 * 1024
# Photo de profil : petite vignette. Photo de machine : affichée en grand dans la fiche.
COTE_PROFIL_PX = 512
COTE_MACHINE_PX = 1280


def preparer_photo(fichier, cote_max=COTE_PROFIL_PX):
    """
    Vérifie une photo envoyée et la ramène à `cote_max` px de côté au plus, en JPEG.
    Les métadonnées (position GPS de l'appareil photo…) disparaissent au passage.
    """
    if fichier.size > TAILLE_MAX_OCTETS:
        raise serializers.ValidationError('Photo trop lourde : 5 Mo au maximum.')
    try:
        image = Image.open(fichier)
        image = ImageOps.exif_transpose(image)  # remet droites les photos prises en portrait
        image.thumbnail((cote_max, cote_max))
        image = image.convert('RGB')
    except (UnidentifiedImageError, OSError) as erreur:
        raise serializers.ValidationError("Ce fichier n'est pas une image lisible (JPEG, PNG ou WebP).") from erreur
    sortie = io.BytesIO()
    image.save(sortie, format='JPEG', quality=85)
    return ContentFile(sortie.getvalue(), name=f'{uuid.uuid4().hex}.jpg')
