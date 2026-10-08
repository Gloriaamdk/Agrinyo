from django.db import DatabaseError, connection
from django.http import JsonResponse


def sante(request):
    """
    GET /api/sante/ : l'API répond et joint la base. Utilisé par le HEALTHCHECK Docker et les hébergeurs.
    503 si PostgreSQL est injoignable.
    """
    try:
        with connection.cursor() as curseur:
            curseur.execute('SELECT 1')
    except DatabaseError:
        return JsonResponse({'statut': 'erreur', 'base': 'injoignable'}, status=503)
    return JsonResponse({'statut': 'ok'})
