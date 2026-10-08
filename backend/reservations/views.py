from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from machines.models import Machine

from .models import Message, Reservation
from .permissions import EstAgriculteur, EstDetenteur
from .serializers import CreationReservationSerializer, MessageSerializer, ReservationSerializer

Statut = Reservation.Statut


def messages_non_lus(utilisateur):
    """Messages reçus par `utilisateur` (agriculteur ou propriétaire) qu'il n'a pas encore lus."""
    return Message.objects.filter(
        Q(reservation__agriculteur=utilisateur) | Q(reservation__machine__proprietaire=utilisateur),
        lu_le__isnull=True,
    ).exclude(auteur=utilisateur)


class ReservationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    POST  /api/reservations/               l'agriculteur envoie une demande
    GET   /api/reservations/me/            ses demandes
    GET   /api/reservations/received/      les demandes reçues par le détenteur
    PATCH /api/reservations/{id}/accept/   le détenteur accepte
    PATCH /api/reservations/{id}/reject/   le détenteur refuse
    PATCH /api/reservations/{id}/cancel/   l'agriculteur annule une demande en attente
    GET   /api/reservations/{id}/messages/ la conversation (réservation acceptée) ; ?apres=<id> pour
                                           ne recevoir que les nouveaux. Marque comme lus ceux reçus.
    POST  /api/reservations/{id}/messages/ envoie un message : {"texte": "…"}
    """

    serializer_class = ReservationSerializer

    def get_permissions(self):
        if self.action in ('create', 'me', 'cancel'):
            return [permissions.IsAuthenticated(), EstAgriculteur()]
        if self.action in ('received', 'accept', 'reject'):
            return [permissions.IsAuthenticated(), EstDetenteur()]
        return [permissions.IsAuthenticated()]

    def get_throttles(self):
        if self.action == 'messages' and self.request.method == 'POST':
            self.throttle_scope = 'messages'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        # Chacun ne voit que ses propres réservations : une demande d'un autre renvoie 404.
        queryset = Reservation.objects.select_related('machine__proprietaire', 'agriculteur')
        utilisateur = self.request.user
        if self.action in ('me', 'received'):
            queryset = queryset.annotate(messages_non_lus=Count(
                'messages', filter=Q(messages__lu_le__isnull=True) & ~Q(messages__auteur=utilisateur)
            ))
        if self.action in ('me', 'cancel'):
            return queryset.filter(agriculteur=utilisateur)
        if self.action in ('received', 'accept', 'reject'):
            return queryset.filter(machine__proprietaire=utilisateur)
        if self.action == 'messages':
            # Les deux parties de la réservation, et elles seules.
            return queryset.filter(Q(agriculteur=utilisateur) | Q(machine__proprietaire=utilisateur))
        return queryset.none()

    def create(self, request, *args, **kwargs):
        with transaction.atomic():
            # Verrou sur la machine avant de valider : une acceptation concurrente
            # ne peut pas se glisser entre la vérification des dates et l'enregistrement.
            try:
                Machine.objects.select_for_update().filter(pk=int(request.data.get('machine'))).first()
            except (TypeError, ValueError):
                pass  # identifiant invalide : le serializer renverra l'erreur
            serializer = CreationReservationSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            reservation = serializer.save()
        return Response(ReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)

    @action(detail=False)
    def me(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @action(detail=False)
    def received(self, request):
        queryset = self.get_queryset()
        statut = request.query_params.get('statut')
        if statut in Statut.values:
            queryset = queryset.filter(statut=statut)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=True, methods=['patch'])
    def accept(self, request, pk=None):
        reservation = self.get_object()
        with transaction.atomic():
            Machine.objects.select_for_update().get(pk=reservation.machine_id)
            reservation.refresh_from_db()
            self._verifier_en_attente(reservation)
            chevauchements = Reservation.chevauchements(
                reservation.machine, reservation.date_debut, reservation.date_fin
            ).exclude(pk=reservation.pk)
            if chevauchements.filter(statut=Statut.ACCEPTEE).exists():
                raise ValidationError('Vous avez déjà accepté une autre demande sur ces dates.')

            maintenant = timezone.now()
            reservation.statut = Statut.ACCEPTEE
            reservation.date_reponse = maintenant
            reservation.save(update_fields=['statut', 'date_reponse'])
            # Les autres demandes sur les mêmes dates ne peuvent plus être servies.
            chevauchements.filter(statut=Statut.EN_ATTENTE).update(
                statut=Statut.REFUSEE, date_reponse=maintenant
            )
        return Response(self.get_serializer(reservation).data)

    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        return self._changer_statut(Statut.REFUSEE)

    @action(detail=True, methods=['patch'])
    def cancel(self, request, pk=None):
        return self._changer_statut(Statut.ANNULEE)

    def _changer_statut(self, statut):
        reservation = self.get_object()
        with transaction.atomic():
            reservation = Reservation.objects.select_for_update().get(pk=reservation.pk)
            self._verifier_en_attente(reservation)
            reservation.statut = statut
            reservation.date_reponse = timezone.now()
            reservation.save(update_fields=['statut', 'date_reponse'])
        return Response(self.get_serializer(reservation).data)

    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        reservation = self.get_object()
        if reservation.statut != Statut.ACCEPTEE:
            raise PermissionDenied('La messagerie s’ouvre une fois la demande acceptée.')

        if request.method == 'POST':
            serializer = MessageSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save(reservation=reservation, auteur=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        reservation.messages.filter(lu_le__isnull=True).exclude(auteur=request.user).update(lu_le=timezone.now())
        conversation = reservation.messages.select_related('auteur')
        apres = request.query_params.get('apres', '')
        if apres.isdigit():
            conversation = conversation.filter(id__gt=int(apres))
        return Response(MessageSerializer(conversation, many=True, context={'request': request}).data)

    @staticmethod
    def _verifier_en_attente(reservation):
        if reservation.statut != Statut.EN_ATTENTE:
            raise ValidationError(f'Cette demande est déjà « {reservation.get_statut_display().lower()} ».')


class TableauDeBordView(APIView):
    """
    GET /api/dashboard/   accueil du propriétaire : ses machines, les demandes à traiter
                          et ses prochaines réservations acceptées.
    """

    permission_classes = [permissions.IsAuthenticated, EstDetenteur]
    NOMBRE_PROCHAINES = 5

    def get(self, request):
        aujourdhui = timezone.localdate()
        machines = Machine.objects.filter(proprietaire=request.user).aggregate(
            total=Count('id'), disponibles=Count('id', filter=Q(disponible=True))
        )
        reservations = Reservation.objects.filter(machine__proprietaire=request.user)
        a_venir = reservations.filter(statut=Statut.ACCEPTEE, date_fin__gte=aujourdhui)
        prochaines = a_venir.select_related('machine__proprietaire', 'agriculteur').annotate(
            messages_non_lus=Count(
                'messages', filter=Q(messages__lu_le__isnull=True) & ~Q(messages__auteur=request.user)
            )
        ).order_by('date_debut', 'id')
        return Response({
            'nombre_machines': machines['total'],
            'nombre_machines_disponibles': machines['disponibles'],
            'demandes_en_attente': reservations.filter(statut=Statut.EN_ATTENTE).count(),
            'reservations_a_venir': a_venir.count(),
            'prochaines_reservations': ReservationSerializer(prochaines[:self.NOMBRE_PROCHAINES], many=True).data,
            'messages_non_lus': messages_non_lus(request.user).count(),
        })


class MessagesNonLusView(APIView):
    """GET /api/messages/unread/   nombre de messages reçus non lus, pour la pastille de la navigation."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'total': messages_non_lus(request.user).count()})
