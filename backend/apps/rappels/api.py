"""Journal des rappels, à l'intention du superviseur (EF-49).

Le journal répond à trois questions : qu'a-t-on envoyé, est-ce arrivé, et
pourquoi certains messages échouent. La troisième est la plus utile — un
taux d'échec qui monte signale un numéro mal saisi, un jeton expiré ou un
modèle suspendu, choses invisibles autrement.
"""

from datetime import date, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.commun.permissions import EstSuperviseurOuAdministrateur

from .models import Rappel, StatutRappel
from .serializers import RappelSerializer


class RappelViewSet(viewsets.ReadOnlyModelViewSet):
    """Consultation du journal des rappels.

    Lecture seule : un rappel est une trace de ce qui s'est passé, rien
    ne doit pouvoir la réécrire.
    """

    serializer_class = RappelSerializer
    permission_classes = [IsAuthenticated, EstSuperviseurOuAdministrateur]
    lookup_field = "identifiant_public"
    lookup_url_kwarg = "id"

    def get_queryset(self):
        queryset = (
            Rappel.objects.select_related("mere")
            .prefetch_related("echeances__vaccin")
            .order_by("-planifie_pour", "-cree_le")
        )

        utilisateur = self.request.user
        if not utilisateur.est_administrateur:
            if utilisateur.poste_id is None:
                return queryset.none()
            queryset = queryset.filter(mere__poste_id=utilisateur.poste_id)

        parametres = self.request.query_params

        if statut := parametres.get("statut"):
            queryset = queryset.filter(statut=statut)
        if canal := parametres.get("canal"):
            queryset = queryset.filter(canal=canal)
        if type_rappel := parametres.get("type"):
            queryset = queryset.filter(type=type_rappel)

        if debut := _lire_date(parametres.get("debut")):
            queryset = queryset.filter(planifie_pour__gte=debut)
        if fin := _lire_date(parametres.get("fin")):
            queryset = queryset.filter(planifie_pour__lte=fin)

        if recherche := parametres.get("search"):
            queryset = queryset.filter(
                Q(mere__prenom__icontains=recherche)
                | Q(mere__nom__icontains=recherche)
                | Q(mere__telephone__icontains=recherche)
            )

        return queryset

    @extend_schema(
        parameters=[
            OpenApiParameter("statut", str, description="Filtre par statut."),
            OpenApiParameter("canal", str, description="Filtre par canal."),
            OpenApiParameter("type", str, description="Filtre par type de rappel."),
            OpenApiParameter("debut", str, description="Depuis cette date."),
            OpenApiParameter("fin", str, description="Jusqu'à cette date."),
            OpenApiParameter("search", str, description="Nom ou téléphone."),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        parameters=[
            OpenApiParameter("jours", int, description="Période. Défaut : 30."),
        ],
        responses={200: None},
        description=(
            "Synthèse de l'acheminement sur la période : volumes par statut, "
            "taux de remise, et motifs d'échec les plus fréquents."
        ),
    )
    @action(detail=False, methods=["get"])
    def synthese(self, request):
        try:
            jours = int(request.query_params.get("jours", 30))
        except ValueError:
            jours = 30
        jours = max(1, min(jours, 365))

        depuis = timezone.localdate() - timedelta(days=jours)
        base = self.get_queryset().filter(planifie_pour__gte=depuis)

        comptes = base.aggregate(
            total=Count("id"),
            en_attente=Count("id", filter=Q(statut=StatutRappel.EN_ATTENTE)),
            envoyes=Count("id", filter=Q(statut=StatutRappel.ENVOYE)),
            remis=Count("id", filter=Q(statut=StatutRappel.REMIS)),
            lus=Count("id", filter=Q(statut=StatutRappel.LU)),
            echecs=Count("id", filter=Q(statut=StatutRappel.ECHEC)),
            abandonnes=Count("id", filter=Q(statut=StatutRappel.ABANDONNE)),
        )

        # Un message « lu » est nécessairement arrivé : le taux de remise
        # les compte tous les deux.
        partis = (
            comptes["envoyes"]
            + comptes["remis"]
            + comptes["lus"]
            + comptes["echecs"]
            + comptes["abandonnes"]
        )
        arrives = comptes["remis"] + comptes["lus"]

        par_canal = list(
            base.values("canal")
            .annotate(
                total=Count("id"),
                echecs=Count(
                    "id",
                    filter=Q(statut__in=[StatutRappel.ECHEC, StatutRappel.ABANDONNE]),
                ),
            )
            .order_by("-total")
        )

        motifs = list(
            base.filter(statut__in=[StatutRappel.ECHEC, StatutRappel.ABANDONNE])
            .exclude(erreur="")
            .values("erreur")
            .annotate(occurrences=Count("id"))
            .order_by("-occurrences")[:5]
        )

        return Response(
            {
                **comptes,
                "taux_remise": (round(100 * arrives / partis, 1) if partis else 0.0),
                "taux_lecture": (round(100 * comptes["lus"] / partis, 1) if partis else 0.0),
                "par_canal": par_canal,
                "motifs_echec": motifs,
                "periode_jours": jours,
                "depuis": depuis.isoformat(),
            }
        )


def _lire_date(valeur: str | None) -> date | None:
    try:
        return date.fromisoformat(valeur) if valeur else None
    except ValueError:
        return None
