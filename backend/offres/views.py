from django.db.models import Count, Prefetch
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from reservations.permissions import EstAgriculteur, EstDetenteur

from .models import Offre, Proposition
from .serializers import (
    CreationOffreSerializer, CreationPropositionSerializer, MonOffreSerializer, OffreSerializer, PropositionSerializer,
)

Statut = Offre.Statut


class OffreViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    POST  /api/offres/                 l'agriculteur lance une offre
    GET   /api/offres/mine/            ses offres avec les machines proposées (« nouvelle » : pas encore vue)
    POST  /api/offres/seen/            marque ses propositions comme vues, une fois affichées
    PATCH /api/offres/{id}/close/      il ferme une offre (trouvé, ou plus besoin)
    GET   /api/offres/unseen/          nombre de propositions pas encore vues, pour la pastille de la navigation
    GET   /api/offres/                 offres ouvertes, pour les propriétaires. Filtres : ?zone=KARA&type=TRACTEUR
    GET   /api/offres/{id}/            une offre ouverte (propriétaire)
    POST  /api/offres/{id}/propose/    le propriétaire propose une de ses machines : {"machine": 12, "message": "…"}
    """

    def get_permissions(self):
        if self.action in ('create', 'mine', 'close', 'unseen', 'seen'):
            return [permissions.IsAuthenticated(), EstAgriculteur()]
        return [permissions.IsAuthenticated(), EstDetenteur()]

    def get_throttles(self):
        if self.action in ('create', 'propose'):
            self.throttle_scope = 'offres'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        queryset = Offre.objects.select_related('agriculteur').annotate(
            nombre_propositions=Count('propositions', distinct=True)
        )
        if self.action in ('mine', 'close'):
            return queryset.filter(agriculteur=self.request.user).prefetch_related(
                Prefetch('propositions', queryset=Proposition.objects.select_related('machine__proprietaire'))
            )
        # Propriétaires : seulement les offres ouvertes ; une offre fermée répond 404.
        queryset = queryset.filter(statut=Statut.OUVERTE).prefetch_related(
            Prefetch('propositions', queryset=Proposition.objects.select_related('machine'))
        )
        params = self.request.query_params
        if params.get('zone'):
            queryset = queryset.filter(zone=params['zone'])
        if params.get('type'):
            queryset = queryset.filter(type_machine=params['type'])
        return queryset

    def get_serializer_class(self):
        if self.action in ('mine', 'close'):
            return MonOffreSerializer
        return OffreSerializer

    def create(self, request, *args, **kwargs):
        serializer = CreationOffreSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        offre = serializer.save(agriculteur=request.user)
        offre.nombre_propositions = 0
        return Response(MonOffreSerializer(offre, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False)
    def mine(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @action(detail=False, methods=['post'])
    def seen(self, request):
        # Appelé par la page une fois les propositions affichées : une lecture seule ne change rien
        # (requête annulée, page rechargée…), le badge « Nouveau » reste visible jusque-là.
        Proposition.objects.filter(offre__agriculteur=request.user, vue_le__isnull=True).update(vue_le=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'])
    def close(self, request, pk=None):
        offre = self.get_object()
        if offre.statut != Statut.OUVERTE:
            raise ValidationError('Cette offre est déjà fermée.')
        offre.statut = Statut.FERMEE
        offre.save(update_fields=['statut'])
        return Response(self.get_serializer(offre).data)

    @action(detail=True, methods=['post'])
    def propose(self, request, pk=None):
        offre = self.get_object()
        serializer = CreationPropositionSerializer(data=request.data, context={'request': request, 'offre': offre})
        serializer.is_valid(raise_exception=True)
        proposition = serializer.save()
        return Response(PropositionSerializer(proposition).data, status=status.HTTP_201_CREATED)

    @action(detail=False)
    def unseen(self, request):
        total = Proposition.objects.filter(
            offre__agriculteur=request.user, offre__statut=Statut.OUVERTE, vue_le__isnull=True
        ).count()
        return Response({'total': total})
