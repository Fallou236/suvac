from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.accounts.api import (
    ChangementMotDePasseView,
    ConnexionView,
    PosteSanteViewSet,
    ProfilView,
)
from apps.beneficiaires.api import EnfantViewSet, GrossesseViewSet, MereViewSet
from config.health import healthz

routeur = DefaultRouter()
routeur.register("postes", PosteSanteViewSet, basename="poste")
routeur.register("meres", MereViewSet, basename="mere")
routeur.register("enfants", EnfantViewSet, basename="enfant")
routeur.register("grossesses", GrossesseViewSet, basename="grossesse")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz, name="healthz"),
    # Authentification
    path("api/auth/connexion/", ConnexionView.as_view(), name="connexion"),
    path("api/auth/rafraichir/", TokenRefreshView.as_view(), name="rafraichir"),
    path("api/auth/verifier/", TokenVerifyView.as_view(), name="verifier"),
    path("api/auth/profil/", ProfilView.as_view(), name="profil"),
    path("api/auth/mot-de-passe/", ChangementMotDePasseView.as_view(), name="mot-de-passe"),
    # Ressources
    path("api/", include(routeur.urls)),
    # Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
