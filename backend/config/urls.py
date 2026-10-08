from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from .sante import sante

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/sante/', sante, name='sante'),
    path('api/', include('comptes.urls')),
    path('api/', include('machines.urls')),
    path('api/', include('reservations.urls')),
    path('api/', include('offres.urls')),
]

if settings.SERVIR_MEDIA:
    # static() ne sert rien hors DEBUG : on déclare la route nous-mêmes.
    urlpatterns += [
        re_path(rf'^{settings.MEDIA_URL.lstrip("/")}(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
