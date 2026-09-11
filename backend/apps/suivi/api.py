"""Points d'accès du suivi vaccinal."""

from datetime import date, timedelta

from django.db.models import Prefetch, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.commun.permissions import LectureSeulePourSuperviseur

from .models import DoseAdministree, Echeance, StatutEcheance
from .serializers import (
    AnnulationSerializer,
    CreationDoseSerializer,
    DoseSerializer,
    EcheanceFileSerializer,
    EcheanceSerializer,
)
from .services import AdministrationRefusee, enregistrer_dose

STATUTS_EN_ATTENTE = [
    StatutEcheance.A_VENIR,
    StatutEcheance.DUE,
    StatutEcheance.EN_RETARD,
]


class EcheanceViewSet(viewsets.ReadOnlyModelViewSet):
    """Consultation des échéances vaccinales.

    Les échéances ne se créent ni ne se modifient directement : elles sont
    produites par le moteur de calendrier. Seules l'administration d'une dose
    et l'annulation les font évoluer.
    """

    serializer_class = EcheanceSerializer
    permission_classes = [IsAuthenticated, LectureSeulePourSuperviseur]
    lookup_field = "identifiant_public"
    lookup_url_kwarg = "id"

    def get_queryset(self):
        doses_courantes = Prefetch(
            "doses",
            queryset=DoseAdministree.objects.filter(remplacee_par__isnull=True).select_related(
                "agent"
            ),
        )
        queryset = Echeance.objects.select_related(
            "vaccin", "enfant", "enfant__mere", "grossesse", "grossesse__mere"
        ).prefetch_related(doses_courantes)

        utilisateur = self.request.user
        if utilisateur.est_administrateur:
            return queryset
        if utilisateur.poste_id is None:
            return queryset.none()

        return queryset.filter(
            Q(enfant__poste_id=utilisateur.poste_id)
            | Q(grossesse__mere__poste_id=utilisateur.poste_id)
        )

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "date",
                str,
                description="Jour ciblé (AAAA-MM-JJ). Par défaut : aujourd'hui.",
            ),
            OpenApiParameter(
                "horizon",
                int,
                description="Nombre de jours à venir inclus. Défaut : 7.",
            ),
        ],
        responses=EcheanceFileSerializer(many=True),
        description=(
            "File du jour (EF-42) : échéances en retard, plus celles dues "
            "dans les prochains jours. Une échéance dont la date cible est "
            "dépassée mais qui reste dans sa fenêtre de rattrapage n'encombre "
            "pas la file tant qu'elle n'est pas proche de sa limite."
        ),
    )
    @action(detail=False, methods=["get"], url_path="file-du-jour")
    def file_du_jour(self, request):
        jour = request.query_params.get("date")
        jour = date.fromisoformat(jour) if jour else timezone.localdate()

        try:
            horizon = int(request.query_params.get("horizon", 7))
        except ValueError:
            horizon = 7
        horizon = max(0, min(horizon, 90))

        limite_haute = jour + timedelta(days=horizon)
        # Une échéance dont la cible remonte à plus d'un mois n'est plus
        # « attendue aujourd'hui » : c'est du rattrapage, qui relève de la
        # fiche du bénéficiaire et non de la file du jour.
        borne_basse = jour - timedelta(days=30)

        echeances = (
            self.get_queryset()
            .filter(statut__in=STATUTS_EN_ATTENTE)
            .filter(
                Q(statut=StatutEcheance.EN_RETARD)
                | Q(date_cible__gte=borne_basse, date_cible__lte=limite_haute)
            )
            .order_by("date_cible", "vaccin__code", "rang")
        )

        serializer = EcheanceFileSerializer(echeances, many=True, context={"request": request})
        return Response(serializer.data)

    @extend_schema(
        request=AnnulationSerializer,
        responses={200: EcheanceSerializer},
        description="Annule une échéance (EF-27). Aucun rappel ne sera plus émis (RG-08).",
    )
    @action(detail=True, methods=["post"])
    def annuler(self, request, id=None):
        echeance = self.get_object()
        entree = AnnulationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)

        try:
            echeance.annuler(entree.validated_data["motif"], entree.validated_data["commentaire"])
        except Exception as erreur:
            return Response({"detail": str(erreur)}, status=status.HTTP_400_BAD_REQUEST)

        echeance.refresh_from_db()
        return Response(EcheanceSerializer(echeance).data)


class DoseViewSet(viewsets.GenericViewSet):
    """Enregistrement des actes vaccinaux (EF-30, EF-31)."""

    serializer_class = CreationDoseSerializer
    permission_classes = [IsAuthenticated, LectureSeulePourSuperviseur]

    def _echeances_accessibles(self):
        utilisateur = self.request.user
        queryset = Echeance.objects.select_related("vaccin", "enfant", "grossesse")

        if utilisateur.est_administrateur:
            return queryset
        if utilisateur.poste_id is None:
            return queryset.none()
        return queryset.filter(
            Q(enfant__poste_id=utilisateur.poste_id)
            | Q(grossesse__mere__poste_id=utilisateur.poste_id)
        )

    @extend_schema(
        request=CreationDoseSerializer,
        responses={201: DoseSerializer, 400: None},
        description=(
            "Enregistre une dose. Le moteur valide l'âge minimal et l'intervalle "
            "entre doses ; les échéances suivantes sont re-planifiées (RG-04). "
            "Rejouer la même clé d'idempotence ne crée pas de doublon (EF-54)."
        ),
    )
    def create(self, request):
        entree = CreationDoseSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        donnees = entree.validated_data

        echeance = (
            self._echeances_accessibles().filter(identifiant_public=donnees["echeance_id"]).first()
        )
        if echeance is None:
            return Response(
                {"echeance_id": ["Échéance introuvable."]},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            dose = enregistrer_dose(
                echeance=echeance,
                date_administration=donnees["date_administration"],
                agent=request.user,
                numero_lot=donnees["numero_lot"],
                cle_idempotence=donnees.get("cle_idempotence"),
            )
        except AdministrationRefusee as refus:
            return Response(
                {
                    "detail": "L'administration ne respecte pas le schéma vaccinal.",
                    "violations": [v.value for v in refus.violations],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if donnees["evenement_indesirable"]:
            dose.evenement_indesirable = donnees["evenement_indesirable"]
            dose.save(update_fields=["evenement_indesirable", "modifie_le"])

        return Response(DoseSerializer(dose).data, status=status.HTTP_201_CREATED)
