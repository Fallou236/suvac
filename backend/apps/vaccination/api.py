"""Référentiel des vaccins, consultable par tous les utilisateurs connectés."""

from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Vaccin
from .serializers import VaccinSerializer


@extend_schema(tags=["vaccins"])
class VaccinViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Fiches des vaccins (EF-70 côté bénéficiaire).

    Accessible à tous : l'agent y trouve la voie d'administration, la mère
    y trouve l'explication de ce contre quoi le vaccin protège.
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
