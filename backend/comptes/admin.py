from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Utilisateur


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    list_display = ('username', 'first_name', 'last_name', 'type_utilisateur', 'telephone', 'email', 'localisation')
    list_filter = ('type_utilisateur',) + UserAdmin.list_filter
    search_fields = UserAdmin.search_fields + ('telephone',)
    fieldsets = UserAdmin.fieldsets + (
        ('AgriLink', {'fields': ('type_utilisateur', 'telephone', 'localisation')}),
    )
