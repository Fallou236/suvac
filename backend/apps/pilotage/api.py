"""Points d'accès du pilotage (EF-60 à EF-64)."""

from datetime import date

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.beneficiaires.models import Enfant
from apps.commun.permissions import EstSuperviseurOuAdministrateur, MotDePasseAJour
from apps.suivi.models import DoseAdministree, Echeance

from .services import (
    activite_mensuelle,
    couverture_par_vaccin,
    enfants_en_retard,
    synthese,
    taux_abandon,
)


class BasePilotage(APIView):
    """Restreint les données au périmètre de l'utilisateur.

    Un superviseur voit son poste ; un administrateur voit tout. L'agent
    n'accède pas à ces indicateurs : son écran est la file du jour.
    """

    permission_classes = [
        IsAuthenticated,
        EstSuperviseurOuAdministrateur,
        MotDePasseAJour,
    ]

    def perimetre(self, request):
        utilisateur = request.user

        enfants = Enfant.objects.all()
        echeances = Echeance.objects.all()
        doses = DoseAdministree.objects.all()

        if not utilisateur.est_administrateur:
            if utilisateur.poste_id is None:
                return enfants.none(), echeances.none(), doses.none()

            enfants = enfants.filter(poste_id=utilisateur.poste_id)
            echeances = echeances.filter(
                Q(enfant__poste_id=utilisateur.poste_id)
                | Q(grossesse__mere__poste_id=utilisateur.poste_id)
            )
            doses = doses.filter(poste_id=utilisateur.poste_id)

        return enfants, echeances, doses

    def bornes(self, request) -> tuple[date | None, date | None]:
        """Période optionnelle, appliquée aux doses administrées."""

        def lire(nom: str) -> date | None:
            valeur = request.query_params.get(nom)
            try:
                return date.fromisoformat(valeur) if valeur else None
            except ValueError:
                return None

        return lire("debut"), lire("fin")


PARAMETRES_PERIODE = [
    OpenApiParameter("debut", str, description="Début de période (AAAA-MM-JJ)."),
    OpenApiParameter("fin", str, description="Fin de période (AAAA-MM-JJ)."),
]


class SyntheseView(BasePilotage):
    @extend_schema(
        responses={200: None},
        description="Quatre chiffres résumant l'activité : enfants suivis, doses du mois, retards, doses périmées.",
    )
    def get(self, request):
        enfants, echeances, doses = self.perimetre(request)
        resultat = synthese(enfants, echeances, doses)

        return Response(
            {
                "enfants_suivis": resultat.enfants_suivis,
                "doses_du_mois": resultat.doses_du_mois,
                "en_retard": resultat.en_retard,
                "perimees": resultat.perimees,
                "couverture_globale": resultat.couverture_globale,
                "poste": (request.user.poste.nom if request.user.poste else "Tous les postes"),
                "arrete_au": timezone.localdate().isoformat(),
            }
        )


class CouvertureView(BasePilotage):
    @extend_schema(
        responses={200: None},
        description=(
            "Taux de couverture par vaccin et par rang de dose (EF-60). "
            "Le dénominateur exclut les échéances non encore dues : un enfant "
            "de trois mois n'est pas « non couvert » pour un vaccin prévu à "
            "neuf mois."
        ),
    )
    def get(self, request):
        _, echeances, _ = self.perimetre(request)

        return Response(
            [
                {
                    "code": c.code,
                    "libelle": c.libelle,
                    "rang": c.rang,
                    "attendus": c.attendus,
                    "administres": c.administres,
                    "taux": c.taux,
                }
                for c in couverture_par_vaccin(echeances)
            ]
        )


class AbandonView(BasePilotage):
    @extend_schema(
        responses={200: None},
        description=(
            "Taux d'abandon par série (EF-61) : proportion des bénéficiaires "
            "ayant reçu la première dose sans recevoir la dernière."
        ),
    )
    def get(self, request):
        _, echeances, _ = self.perimetre(request)

        return Response(
            [
                {
                    "code": a.code,
                    "libelle": a.libelle,
                    "premiere_dose": a.premiere_dose,
                    "derniere_dose": a.derniere_dose,
                    "taux": a.taux,
                }
                for a in taux_abandon(echeances)
            ]
        )


class ActiviteView(BasePilotage):
    @extend_schema(
        parameters=[
            OpenApiParameter("mois", int, description="Nombre de mois. Défaut : 12."),
        ],
        responses={200: None},
        description="Doses administrées par mois (EF-63).",
    )
    def get(self, request):
        _, _, doses = self.perimetre(request)

        try:
            mois = int(request.query_params.get("mois", 12))
        except ValueError:
            mois = 12
        mois = max(1, min(mois, 36))

        return Response(activite_mensuelle(doses, mois))


class RetardsView(BasePilotage):
    @extend_schema(
        parameters=[
            OpenApiParameter("limite", int, description="Maximum de lignes. Défaut : 100."),
        ],
        responses={200: None},
        description="Liste nominative des enfants en retard, du plus ancien au plus récent (EF-62).",
    )
    def get(self, request):
        _, echeances, _ = self.perimetre(request)

        try:
            limite = int(request.query_params.get("limite", 100))
        except ValueError:
            limite = 100
        limite = max(1, min(limite, 500))

        return Response(enfants_en_retard(echeances, limite))
