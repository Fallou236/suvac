"""Référentiel des vaccins et du schéma, consultables selon le rôle."""

from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commun.permissions import EstSuperviseurOuAdministrateur

from .models import RegleVaccinale, Vaccin
from .serializers import RegleVaccinaleSerializer, VaccinSerializer


@extend_schema(tags=["vaccins"])
class VaccinViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Fiches des vaccins, accessibles à tous les utilisateurs connectés.

    L'agent y trouve la voie d'administration, la mère l'explication de ce
    contre quoi le vaccin protège.
    """

    serializer_class = VaccinSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "code"
    pagination_class = None

    def get_queryset(self):
        return Vaccin.objects.filter(actif=True).order_by("code")

    def get_serializer_context(self):
        contexte = super().get_serializer_context()
        contexte["langue"] = getattr(self.request.user, "langue", "fr")
        return contexte


class SchemaVaccinalView(APIView):
    """Le schéma vaccinal en vigueur (EF-25, en consultation).

    Le paramétrage reste réservé à l'administrateur, par l'interface
    d'administration : une erreur de saisie ici recalculerait les
    calendriers de tous les enfants du poste.
    """

    permission_classes = [IsAuthenticated, EstSuperviseurOuAdministrateur]

    @extend_schema(
        responses={200: None},
        description="Règles du calendrier vaccinal, groupées par cible.",
    )
    def get(self, request):
        regles = (
            RegleVaccinale.objects.filter(actif=True)
            .select_related("vaccin")
            .order_by("cible", "age_cible_jours", "vaccin__code", "rang")
        )

        donnees = RegleVaccinaleSerializer(regles, many=True).data

        return Response(
            {
                "enfant": [r for r in donnees if r["cible"] == "enfant"],
                "mere": [r for r in donnees if r["cible"] == "mere"],
                "vaccins": Vaccin.objects.filter(actif=True).count(),
                "regles": regles.count(),
                "avertissement": (
                    "Schéma reconstitué à partir de sources publiques, non "
                    "validé par le PEV Sénégal. À confronter à une source "
                    "officielle avant tout usage réel."
                ),
            }
        )
