from rest_framework.permissions import BasePermission


class EstAgriculteur(BasePermission):
    message = 'Seul un compte agriculteur peut faire une demande de réservation.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.est_agriculteur


class EstDetenteur(BasePermission):
    message = 'Cette page est réservée aux propriétaires de machines.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.est_detenteur
