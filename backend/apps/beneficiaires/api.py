"""Points d'accès des bénéficiaires."""

from drf_spectacular.utils import extend_schema
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.commun.permissions import FiltrageParPoste, LectureSeulePourSuperviseur

from .models import Consentement, Enfant, Grossesse, Mere
from .serializers import (
    ConsentementSerializer,
    CreationConsentementSerializer,
    EnfantListeSerializer,
    EnfantSerializer,
    GrossesseSerializer,
    MereListeSerializer,
    MereSerializer,
)


class MereViewSet(FiltrageParPoste, viewsets.ModelViewSet):
    """Mères et futures mères (EF-10, EF-14)."""

    permission_classes = [IsAuthenticated, LectureSeulePourSuperviseur]
    lookup_field = "identifiant_public"
    lookup_url_kwarg = "id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["prenom", "nom", "telephone", "village"]
    ordering_fields = ["nom", "cree_le"]
    ordering = ["nom", "prenom"]
    champ_poste = "poste"

    def get_queryset(self):
        queryset = Mere.objects.select_related("poste")
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("consentements__recueilli_par")
        return self.filtrer_par_poste(queryset)

    def get_serializer_class(self):
        return MereListeSerializer if self.action == "list" else MereSerializer

    @extend_schema(
        request=CreationConsentementSerializer,
        responses={201: ConsentementSerializer},
        description="Enregistre un consentement aux rappels (ENF-21).",
    )
    @action(detail=True, methods=["post"], url_path="consentement")
    def consentir(self, request, id=None):
        mere = self.get_object()
        entree = CreationConsentementSerializer(data=request.data)
        entree.is_valid(raise_exception=True)

        consentement = Consentement.objects.create(
            mere=mere, canal=entree.validated_data["canal"], recueilli_par=request.user
        )
        return Response(ConsentementSerializer(consentement).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        responses={204: None},
        description="Révoque le consentement actif. Sans effet s'il n'y en a pas.",
    )
    @action(detail=True, methods=["post"], url_path="revoquer-consentement")
    def revoquer(self, request, id=None):
        mere = self.get_object()
        consentement = mere.consentement_actif
        if consentement:
            consentement.revoquer()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance: Mere) -> None:
        """Suppression logique (RG-10)."""
        instance.supprimer()


class EnfantViewSet(FiltrageParPoste, viewsets.ModelViewSet):
    """Enfants bénéficiaires (EF-12, EF-14)."""

    permission_classes = [IsAuthenticated, LectureSeulePourSuperviseur]
    lookup_field = "identifiant_public"
    lookup_url_kwarg = "id"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["prenom", "nom", "mere__prenom", "mere__nom", "mere__telephone"]
    ordering_fields = ["date_naissance", "nom", "cree_le"]
    ordering = ["-date_naissance"]
    champ_poste = "poste"

    def get_queryset(self):
        queryset = Enfant.objects.select_related("mere", "poste")
        return self.filtrer_par_poste(queryset)

    def get_serializer_class(self):
        return EnfantListeSerializer if self.action == "list" else EnfantSerializer

    @extend_schema(
        responses={200: None},
        description="Calendrier vaccinal complet de l'enfant (EF-20, EF-22, EF-24).",
    )
    @action(detail=True, methods=["get"])
    def calendrier(self, request, id=None):
        # Import local : le module `suivi` importe `beneficiaires`, un import
        # en tête de fichier créerait un cycle.
        from apps.suivi.api import EcheanceViewSet
        from apps.suivi.serializers import EcheanceSerializer

        enfant = self.get_object()

        vue = EcheanceViewSet()
        vue.request = request
        echeances = (
            vue.get_queryset().filter(enfant=enfant).order_by("date_cible", "vaccin__code", "rang")
        )

        return Response(
            {
                "beneficiaire_id": str(enfant.identifiant_public),
                "beneficiaire_nom": enfant.nom_complet,
                "date_reference": enfant.date_naissance,
                "echeances": EcheanceSerializer(
                    echeances, many=True, context={"request": request}
                ).data,
            }
        )

    def perform_destroy(self, instance: Enfant) -> None:
        instance.supprimer()


class GrossesseViewSet(FiltrageParPoste, viewsets.ModelViewSet):
    """Épisodes de grossesse (EF-11)."""

    serializer_class = GrossesseSerializer
    permission_classes = [IsAuthenticated, LectureSeulePourSuperviseur]
    lookup_field = "identifiant_public"
    lookup_url_kwarg = "id"
    champ_poste = "mere__poste"

    def get_queryset(self):
        queryset = Grossesse.objects.select_related("mere", "mere__poste")
        return self.filtrer_par_poste(queryset)

    @extend_schema(
        responses={200: None},
        description="Calendrier antitétanique de la grossesse (EF-21).",
    )
    @action(detail=True, methods=["get"])
    def calendrier(self, request, id=None):
        from apps.suivi.api import EcheanceViewSet
        from apps.suivi.serializers import EcheanceSerializer

        grossesse = self.get_object()

        vue = EcheanceViewSet()
        vue.request = request
        echeances = vue.get_queryset().filter(grossesse=grossesse).order_by("date_cible", "rang")

        return Response(
            {
                "beneficiaire_id": str(grossesse.identifiant_public),
                "beneficiaire_nom": grossesse.mere.nom_complet,
                "date_reference": grossesse.date_reference,
                "echeances": EcheanceSerializer(
                    echeances, many=True, context={"request": request}
                ).data,
            }
        )

    def perform_destroy(self, instance: Grossesse) -> None:
        instance.supprimer()
