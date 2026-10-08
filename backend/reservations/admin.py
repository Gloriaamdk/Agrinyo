from django.contrib import admin

from .models import Message, Reservation


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('auteur', 'texte', 'date_envoi', 'lu_le')
    can_delete = False


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ('machine', 'agriculteur', 'date_debut', 'date_fin', 'quantite', 'montant_estime', 'statut')
    list_filter = ('statut', 'machine__type_machine')
    search_fields = ('machine__nom', 'agriculteur__first_name', 'agriculteur__last_name', 'agriculteur__telephone')
    date_hierarchy = 'date_debut'
    inlines = [MessageInline]
