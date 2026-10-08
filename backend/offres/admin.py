from django.contrib import admin

from .models import Offre, Proposition


class PropositionInline(admin.TabularInline):
    model = Proposition
    extra = 0
    readonly_fields = ('machine', 'message', 'date_creation', 'vue_le')
    can_delete = False


@admin.register(Offre)
class OffreAdmin(admin.ModelAdmin):
    list_display = ('type_machine', 'localisation', 'zone', 'agriculteur', 'date_souhaitee', 'statut', 'date_creation')
    list_filter = ('statut', 'zone', 'type_machine')
    search_fields = ('description', 'localisation', 'agriculteur__first_name', 'agriculteur__last_name')
    inlines = [PropositionInline]
