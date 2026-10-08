from rest_framework.routers import DefaultRouter

from .views import OffreViewSet

router = DefaultRouter()
router.register('offres', OffreViewSet, basename='offre')

urlpatterns = router.urls
