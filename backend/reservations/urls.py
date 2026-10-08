from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MessagesNonLusView, ReservationViewSet, TableauDeBordView

router = DefaultRouter()
router.register('reservations', ReservationViewSet, basename='reservation')

urlpatterns = [
    path('dashboard/', TableauDeBordView.as_view(), name='tableau-de-bord'),
    path('messages/unread/', MessagesNonLusView.as_view(), name='messages-non-lus'),
    *router.urls,
]
