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
from apps.beneficiaires.mon_dossier import (
    MesBeneficiairesView,
    MesRappelsView,
    MonCarnetView,
    MonProfilView,
)
from apps.pilotage.api import (
    AbandonView,
    ActiviteView,
    CouvertureView,
    RetardsView,
    SyntheseView,
)
from apps.suivi.api import DoseViewSet, EcheanceViewSet
from apps.vaccination.api import VaccinViewSet
from config.health import healthz

routeur = DefaultRouter()
routeur.register("postes", PosteSanteViewSet, basename="poste")
routeur.register("meres", MereViewSet, basename="mere")
routeur.register("enfants", EnfantViewSet, basename="enfant")
routeur.register("grossesses", GrossesseViewSet, basename="grossesse")
routeur.register("echeances", EcheanceViewSet, basename="echeance")
routeur.register("doses", DoseViewSet, basename="dose")
routeur.register("vaccins", VaccinViewSet, basename="vaccin")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz, name="healthz"),
    # Authentification
    path("api/auth/connexion/", ConnexionView.as_view(), name="connexion"),
    path("api/auth/rafraichir/", TokenRefreshView.as_view(), name="rafraichir"),
    path("api/auth/verifier/", TokenVerifyView.as_view(), name="verifier"),
    path("api/auth/profil/", ProfilView.as_view(), name="profil"),
    path(
        "api/auth/mot-de-passe/",
        ChangementMotDePasseView.as_view(),
        name="mot-de-passe",
    ),
    # Ressources
    path("api/", include(routeur.urls)),
    # Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/pilotage/synthese/", SyntheseView.as_view(), name="pilotage-synthese"),
    path("api/pilotage/couverture/", CouvertureView.as_view(), name="pilotage-couverture"),
    path("api/pilotage/abandon/", AbandonView.as_view(), name="pilotage-abandon"),
    path("api/pilotage/activite/", ActiviteView.as_view(), name="pilotage-activite"),
    path("api/pilotage/retards/", RetardsView.as_view(), name="pilotage-retards"),
    path("api/mon-dossier/profil/", MonProfilView.as_view(), name="mon-profil"),
    path(
        "api/mon-dossier/beneficiaires/",
        MesBeneficiairesView.as_view(),
        name="mes-beneficiaires",
    ),
    path("api/mon-dossier/carnet/<uuid:id>/", MonCarnetView.as_view(), name="mon-carnet"),
    path("api/mon-dossier/rappels/", MesRappelsView.as_view(), name="mes-rappels"),
]
