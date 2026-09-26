"""Accès de la bénéficiaire à son propre dossier.

Ces points d'accès sont strictement séparés de ceux du personnel soignant.
Le filtrage ne passe pas par le poste mais par le compte : une mère ne voit
que ses enfants et ses grossesses, jamais ceux d'une autre.
"""

from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.commun.permissions import EstBeneficiaire
from apps.rappels.models import StatutRappel
from apps.suivi.models import DoseAdministree, Echeance

from .models import Mere
from .serializers import MereSerializer


class BaseMonDossier(APIView):
    permission_classes = [IsAuthenticated, EstBeneficiaire]

    def mere(self, request) -> Mere | None:
        """La mère rattachée au compte connecté, et elle seule."""
        return Mere.objects.filter(compte=request.user).first()

    def refus(self):
        return Response(
            {"detail": "Aucun dossier n'est rattaché à ce compte."},
            status=status.HTTP_404_NOT_FOUND,
        )


class MonProfilView(BaseMonDossier):
    @extend_schema(
        responses={200: MereSerializer},
        description="Dossier de la bénéficiaire connectée.",
    )
    def get(self, request):
        mere = self.mere(request)
        if mere is None:
            return self.refus()
        return Response(MereSerializer(mere, context={"request": request}).data)

    @extend_schema(
        request=None,
        responses={200: MereSerializer},
        description=(
            "Modification limitée : la bénéficiaire peut corriger son téléphone, "
            "son village et sa langue. Ni son identité ni son rattachement."
        ),
    )
    def patch(self, request):
        mere = self.mere(request)
        if mere is None:
            return self.refus()

        modifiables = {"telephone", "village", "langue"}
        donnees = {cle: valeur for cle, valeur in request.data.items() if cle in modifiables}

        serializer = MereSerializer(mere, data=donnees, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MesBeneficiairesView(BaseMonDossier):
    @extend_schema(
        responses={200: None},
        description="Enfants et grossesses rattachés à la bénéficiaire connectée.",
    )
    def get(self, request):
        mere = self.mere(request)
        if mere is None:
            return self.refus()

        enfants = mere.enfants.all().order_by("-date_naissance")
        grossesses = mere.grossesses.all().order_by("-date_reference")

        return Response(
            {
                "enfants": [
                    {
                        "id": str(enfant.identifiant_public),
                        "nom": enfant.nom_complet,
                        "date_naissance": enfant.date_naissance.isoformat(),
                        "sexe": enfant.sexe,
                        "age_jours": enfant.age_en_jours(),
                    }
                    for enfant in enfants
                ],
                "grossesses": [
                    {
                        "id": str(grossesse.identifiant_public),
                        "rang": grossesse.rang,
                        "date_reference": grossesse.date_reference.isoformat(),
                        "terme_estime": (
                            grossesse.terme_estime.isoformat() if grossesse.terme_estime else None
                        ),
                        "statut": grossesse.statut,
                    }
                    for grossesse in grossesses
                ],
            }
        )


class MonCarnetView(BaseMonDossier):
    """Carnet vaccinal d'un enfant ou d'une grossesse de la bénéficiaire.

    Le contrôle d'appartenance est fait avant toute lecture : un identifiant
    valide mais rattaché à une autre mère renvoie 404, jamais le carnet.
    """

    @extend_schema(
        responses={200: None},
        description="Carnet vaccinal d'un bénéficiaire rattaché au compte connecté.",
    )
    def get(self, request, id):
        mere = self.mere(request)
        if mere is None:
            return self.refus()

        enfant = mere.enfants.filter(identifiant_public=id).first()
        grossesse = (
            mere.grossesses.filter(identifiant_public=id).first() if enfant is None else None
        )

        if enfant is None and grossesse is None:
            # Un identifiant qui existe mais n'appartient pas à cette mère
            # reçoit la même réponse qu'un identifiant inconnu.
            return self.refus()

        cible = enfant or grossesse
        filtre = {"enfant": enfant} if enfant else {"grossesse": grossesse}

        doses_courantes = Prefetch(
            "doses",
            queryset=DoseAdministree.objects.filter(remplacee_par__isnull=True),
        )
        echeances = (
            Echeance.objects.filter(**filtre)
            .select_related("vaccin")
            .prefetch_related(doses_courantes)
            .order_by("date_cible", "vaccin__code", "rang")
        )

        reference = enfant.date_naissance if enfant else grossesse.date_reference

        return Response(
            {
                "id": str(cible.identifiant_public),
                "nom": enfant.nom_complet if enfant else mere.nom_complet,
                "type": "enfant" if enfant else "grossesse",
                "date_reference": reference.isoformat(),
                "echeances": [
                    {
                        "id": str(e.identifiant_public),
                        "vaccin": e.vaccin.libelle(mere.langue),
                        "code": e.vaccin.code,
                        "protege_contre": e.vaccin.protege_contre,
                        "rang": e.rang,
                        "date_cible": e.date_cible.isoformat(),
                        "statut": e.statut,
                        "age_cible_jours": (e.date_cible - reference).days,
                        "date_administration": (
                            dose.date_administration.isoformat()
                            if (dose := next(iter(e.doses.all()), None))
                            else None
                        ),
                    }
                    for e in echeances
                ],
            }
        )


class MesRappelsView(BaseMonDossier):
    @extend_schema(
        responses={200: None},
        description=(
            "Rappels adressés à la bénéficiaire (EF-41). Ce sont les messages "
            "réellement produits par le balayage, pas une reconstitution : la "
            "mère voit ce que le poste de santé a envoyé."
        ),
    )
    def get(self, request):
        mere = self.mere(request)
        if mere is None:
            return self.refus()

        rappels = (
            mere.rappels.filter(
                statut__in=[
                    StatutRappel.EN_ATTENTE,
                    StatutRappel.ENVOYE,
                    StatutRappel.REMIS,
                    StatutRappel.LU,
                ]
            )
            .prefetch_related("echeances__vaccin", "echeances__enfant")
            .order_by("-planifie_pour")[:50]
        )

        return Response([_presenter(rappel, mere) for rappel in rappels])

    @extend_schema(
        request=None,
        responses={204: None},
        description="Marque tous les rappels comme lus.",
    )
    def post(self, request):
        mere = self.mere(request)
        if mere is None:
            return self.refus()

        for rappel in mere.rappels.filter(
            statut__in=[
                StatutRappel.EN_ATTENTE,
                StatutRappel.ENVOYE,
                StatutRappel.REMIS,
            ]
        ):
            rappel.marquer_lu()

        return Response(status=status.HTTP_204_NO_CONTENT)


class MonRappelView(BaseMonDossier):
    """Un rappel précis : lecture et accusé.

    Marquer comme lu se fait à l'ouverture du message, pas par un geste
    séparé : c'est le comportement d'une boîte de réception.
    """

    @extend_schema(
        responses={200: None},
        description="Détail d'un rappel, qui le marque comme lu.",
    )
    def get(self, request, id):
        mere = self.mere(request)
        if mere is None:
            return self.refus()

        rappel = mere.rappels.filter(identifiant_public=id).first()
        if rappel is None:
            return self.refus()

        if rappel.statut != StatutRappel.LU:
            rappel.marquer_lu()

        return Response(_presenter(rappel, mere))


def _presenter(rappel, mere) -> dict:
    """Met un rappel en forme pour l'espace de la mère.

    Le texte affiché est celui qui a été composé lors du balayage, pas une
    reconstitution : la mère lit exactement ce que le poste lui a adressé.
    """
    echeances = list(rappel.echeances.all())
    premiere = echeances[0] if echeances else None

    beneficiaire = mere.nom_complet
    beneficiaire_id = ""
    if premiere and premiere.enfant_id:
        beneficiaire = premiere.enfant.nom_complet
        beneficiaire_id = str(premiere.enfant.identifiant_public)
    elif premiere and premiere.grossesse_id:
        beneficiaire_id = str(premiere.grossesse.identifiant_public)

    return {
        "id": str(rappel.identifiant_public),
        "type": rappel.type,
        "statut": rappel.statut,
        "texte": rappel.texte,
        "langue": rappel.langue,
        "date": rappel.planifie_pour.isoformat(),
        "lu": rappel.statut == StatutRappel.LU,
        "beneficiaire": beneficiaire,
        "beneficiaire_id": beneficiaire_id,
        "vaccins": [
            {
                "code": e.vaccin.code,
                "libelle": e.vaccin.libelle(mere.langue),
                "protege_contre": e.vaccin.protege_contre,
                "rang": e.rang,
                "statut": e.statut,
            }
            for e in echeances
        ],
    }
