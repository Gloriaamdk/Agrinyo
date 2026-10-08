from django.contrib import admin

from .models import Avis, Machine


class AvisInline(admin.TabularInline):
    model = Avis
    extra = 0


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ('nom', 'type_machine', 'proprietaire', 'zone', 'localisation', 'prix', 'unite_prix', 'disponible')
    list_filter = ('type_machine', 'zone', 'disponible')
    search_fields = ('nom', 'localisation', 'proprietaire__first_name', 'proprietaire__last_name')
    inlines = [AvisInline]


@admin.register(Avis)
class AvisAdmin(admin.ModelAdmin):
    list_display = ('machine', 'auteur', 'note', 'date_creation')
    list_filter = ('note',)
