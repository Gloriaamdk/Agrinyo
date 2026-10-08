from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from reservations.models import Reservation
from reservations.permissions import EstDetenteur

from .models import Machine
from .serializers import MachineDetailSerializer, MachineEcritureSerializer, MachineSerializer, MaMachineSerializer

# Actions réservées au propriétaire, et seulement sur ses propres machines.
ACTIONS_PROPRIETAIRE = ('create', 'update', 'partial_update', 'destroy', 'mine')


def _choix(choices):
    return [{'valeur': valeur, 'libelle': libelle} for valeur, libelle in choices]


class MachineViewSet(viewsets.ModelViewSet):
    """
    GET    /api/machines/        liste publique. Filtres : ?zone=KARA&type=TRACTEUR&disponible=true&q=tracteur
    GET    /api/machines/{id}/   détail public, avec les périodes déjà réservées
    POST   /api/machines/        le propriétaire publie une machine (JSON, ou multipart avec `photo`)
    PUT    /api/machines/{id}/   PATCH aussi : il modifie l'une des siennes
    DELETE /api/machines/{id}/   il en supprime une ; avec une réservation acceptée à venir,
                                 elle passe en indisponible à la place (409)
    GET    /api/machines/mine/   ses machines, disponibles ou non, avec les demandes en attente
    GET    /api/machines/options/  choix du formulaire machine : types, zones, unités de prix
    """

    def get_permissions(self):
        if self.action in ACTIONS_PROPRIETAIRE:
            return [permissions.IsAuthenticated(), EstDetenteur()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        queryset = Machine.objects.select_related('proprietaire')
        if self.action in ACTIONS_PROPRIETAIRE:
            # La machine d'un autre propriétaire répond 404 : on ne révèle même pas qu'elle existe.
            queryset = queryset.filter(proprietaire=self.request.user)
        params = self.request.query_params

        zone = params.get('zone')
        if zone:
            queryset = queryset.filter(zone=zone)

        type_machine = params.get('type')
        if type_machine:
            queryset = queryset.filter(type_machine=type_machine)

        disponible = params.get('disponible')
        if disponible in ('true', 'false'):
            queryset = queryset.filter(disponible=disponible == 'true')

        recherche = params.get('q', '').strip()
        if recherche:
            queryset = queryset.filter(
                Q(nom__icontains=recherche)
                | Q(localisation__icontains=recherche)
                | Q(proprietaire__first_name__icontains=recherche)
                | Q(proprietaire__last_name__icontains=recherche)
            )

        if self.action == 'mine':
            queryset = queryset.annotate(
                demandes_en_attente=Count(
                    'reservations', filter=Q(reservations__statut=Reservation.Statut.EN_ATTENTE), distinct=True
                )
            )
        return queryset

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return MachineEcritureSerializer
        if self.action == 'retrieve':
            return MachineDetailSerializer
        if self.action == 'mine':
            return MaMachineSerializer
        return MachineSerializer

    def _reponse_machine(self, machine, statut=status.HTTP_200_OK):
        # Relue comme dans la liste (propriétaire joint).
        machine = self.get_queryset().get(pk=machine.pk)
        return Response(MachineSerializer(machine).data, status=statut)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._reponse_machine(serializer.save(proprietaire=request.user), status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=kwargs.get('partial', False))
        serializer.is_valid(raise_exception=True)
        return self._reponse_machine(serializer.save())

    def destroy(self, request, *args, **kwargs):
        machine = self.get_object()
        if machine.reservations.filter(
            statut=Reservation.Statut.ACCEPTEE, date_fin__gte=timezone.localdate()
        ).exists():
            # Les agriculteurs déjà acceptés gardent leur réservation ; plus personne ne peut en faire de nouvelle.
            if machine.disponible:
                machine.disponible = False
                machine.save(update_fields=['disponible'])
            machine = self.get_queryset().get(pk=machine.pk)
            return Response(
                {'detail': 'Cette machine a des réservations acceptées à venir : elle ne peut pas être supprimée. '
                           'Elle est désormais indisponible ; vous pourrez la supprimer après ses réservations.',
                 'machine': MachineSerializer(machine).data},
                status=status.HTTP_409_CONFLICT,
            )
        if machine.photo:
            machine.photo.delete(save=False)
        machine.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False)
    def mine(self, request):
        """Machines du propriétaire connecté, disponibles ou non."""
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @action(detail=False)
    def options(self, request):
        """Listes du formulaire « Ajouter / modifier une machine » : tous les choix possibles."""
        return Response({
            'types': _choix(Machine.TypeMachine.choices),
            'zones': _choix(Machine.Zone.choices),
            'unites_prix': _choix(Machine.UnitePrix.choices),
        })

    @action(detail=False)
    def filtres(self, request):
        """Valeurs possibles pour les filtres, pour que le frontend ne les code pas en dur."""
        # Seuls les types réellement proposés : un filtre vide n'aide personne.
        types_proposes = set(
            Machine.objects.filter(disponible=True).values_list('type_machine', flat=True)
        )
        return Response({
            'zones': _choix(Machine.Zone.choices),
            'types': _choix(c for c in Machine.TypeMachine.choices if c[0] in types_proposes),
            # Formulaire « Ajouter une machine » : tous les choix possibles.
            'tous_les_types': _choix(Machine.TypeMachine.choices),
            'unites': _choix(Machine.UnitePrix.choices),
        })
