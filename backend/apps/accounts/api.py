"""Points d'accès des comptes et des postes."""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.commun.permissions import (
    EstAdministrateur,
    EstSuperviseurOuAdministrateur,
)

from .audit import ActeAdministration, JournalAudit, journaliser
from .models import PosteSante, Role, Utilisateur
from .serializers import (
    AgentSerializer,
    ChangementMotDePasseSerializer,
    ConnexionSerializer,
    CreationAgentSerializer,
    JournalAuditSerializer,
    PosteSanteSerializer,
    ReinitialisationSerializer,
    TransfertSerializer,
    UtilisateurSerializer,
)


class ConnexionView(TokenObtainPairView):
    """Authentification : renvoie les jetons et le profil (EF-01)."""

    serializer_class = ConnexionSerializer


class ProfilView(APIView):
    """Profil de l'utilisateur connecté."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UtilisateurSerializer)
    def get(self, request):
        return Response(UtilisateurSerializer(request.user).data)

    @extend_schema(request=UtilisateurSerializer, responses=UtilisateurSerializer)
    def patch(self, request):
        serializer = UtilisateurSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangementMotDePasseView(APIView):
    """EF-05."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChangementMotDePasseSerializer, responses={204: None})
    def post(self, request):
        entree = ChangementMotDePasseSerializer(data=request.data, context={"request": request})
        entree.is_valid(raise_exception=True)

        utilisateur = request.user
        utilisateur.set_password(entree.validated_data["nouveau_mot_de_passe"])
        # Le mot de passe est désormais connu de lui seul.
        utilisateur.doit_changer_mot_de_passe = False
        utilisateur.save(update_fields=["password", "doit_changer_mot_de_passe"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class PosteSanteViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Référentiel des postes, en lecture seule hors administration."""

    serializer_class = PosteSanteSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "identifiant_public"
    lookup_url_kwarg = "id"

    def get_queryset(self):
        queryset = PosteSante.objects.filter(actif=True)
        utilisateur = self.request.user

        if utilisateur.est_administrateur or utilisateur.est_superviseur:
            return queryset
        if utilisateur.poste_id is None:
            return queryset.none()
        return queryset.filter(pk=utilisateur.poste_id)


class AgentViewSet(viewsets.ModelViewSet):
    """Gestion du personnel du poste par le superviseur (EF-06).

    Un superviseur gère les comptes de son poste ; un administrateur, tous.
    Aucun ne peut se supprimer soi-même, ni créer un administrateur.
    """

    serializer_class = AgentSerializer
    permission_classes = [IsAuthenticated, EstSuperviseurOuAdministrateur]
    lookup_field = "identifiant_public"
    lookup_url_kwarg = "id"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Utilisateur.objects.select_related("poste").exclude(role=Role.BENEFICIAIRE)

        utilisateur = self.request.user
        if not utilisateur.est_administrateur:
            if utilisateur.poste_id is None:
                return queryset.none()
            queryset = queryset.filter(poste_id=utilisateur.poste_id)

        if self.request.query_params.get("actifs") == "true":
            queryset = queryset.filter(is_active=True)

        return queryset.order_by("last_name", "first_name")

    @extend_schema(
        request=CreationAgentSerializer,
        responses={201: AgentSerializer},
        description=(
            "Crée un compte pour le personnel. Le mot de passe est choisi par "
            "le superviseur et transmis oralement ; l'agent devra le changer "
            "à sa première connexion."
        ),
    )
    def create(self, request):
        entree = CreationAgentSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        donnees = entree.validated_data

        poste = self._poste_cible(request, donnees.get("poste_id"))
        if poste is None:
            return Response(
                {"poste_id": ["Poste introuvable ou hors de votre périmètre."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compte = Utilisateur.objects.create_user(
            username=donnees["username"],
            password=donnees["mot_de_passe"],
            first_name=donnees["first_name"],
            last_name=donnees["last_name"],
            telephone=donnees.get("telephone", ""),
            role=donnees["role"],
            poste=poste,
            doit_changer_mot_de_passe=True,
        )

        journaliser(
            ActeAdministration.CREATION_COMPTE,
            request.user,
            compte,
            f"{compte.get_role_display()} au {poste.nom}",
        )

        return Response(AgentSerializer(compte).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request=ReinitialisationSerializer,
        responses={204: None},
        description=(
            "Réinitialise le mot de passe d'un agent qui l'a oublié. "
            "L'agent devra en choisir un nouveau à sa prochaine connexion."
        ),
    )
    @action(detail=True, methods=["post"], url_path="reinitialiser")
    def reinitialiser(self, request, id=None):
        compte = self.get_object()

        if compte == request.user:
            return Response(
                {"detail": "Utilisez le changement de mot de passe habituel."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entree = ReinitialisationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)

        compte.set_password(entree.validated_data["mot_de_passe"])
        compte.doit_changer_mot_de_passe = True
        compte.save(update_fields=["password", "doit_changer_mot_de_passe"])

        journaliser(ActeAdministration.REINITIALISATION, request.user, compte)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        request=TransfertSerializer,
        responses={200: AgentSerializer},
        description=(
            "Transfère un agent vers un autre poste. Son historique reste "
            "rattaché aux actes qu'il a enregistrés."
        ),
    )
    @action(detail=True, methods=["post"])
    def transferer(self, request, id=None):
        compte = self.get_object()

        entree = TransfertSerializer(data=request.data)
        entree.is_valid(raise_exception=True)

        nouveau = PosteSante.objects.filter(
            identifiant_public=entree.validated_data["poste_id"]
        ).first()
        if nouveau is None:
            return Response(
                {"poste_id": ["Poste introuvable."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ancien = compte.poste.nom if compte.poste else "aucun poste"
        compte.poste = nouveau
        compte.save(update_fields=["poste"])

        journaliser(
            ActeAdministration.TRANSFERT,
            request.user,
            compte,
            f"{ancien} → {nouveau.nom}",
        )

        return Response(AgentSerializer(compte).data)

    @extend_schema(
        responses={200: AgentSerializer},
        description=(
            "Désactive ou réactive un compte. Le compte n'est jamais "
            "supprimé : les actes qu'il a enregistrés gardent leur auteur "
            "(RG-10)."
        ),
    )
    @action(detail=True, methods=["post"], url_path="basculer-activation")
    def basculer_activation(self, request, id=None):
        compte = self.get_object()

        if compte == request.user:
            return Response(
                {"detail": "Vous ne pouvez pas désactiver votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compte.is_active = not compte.is_active
        compte.save(update_fields=["is_active"])

        journaliser(
            (
                ActeAdministration.REACTIVATION
                if compte.is_active
                else ActeAdministration.DESACTIVATION
            ),
            request.user,
            compte,
        )

        return Response(AgentSerializer(compte).data)

    def _poste_cible(self, request, poste_id):
        """Un superviseur ne crée que dans son poste ; l'administrateur partout."""
        if request.user.est_administrateur:
            if poste_id is None:
                return None
            return PosteSante.objects.filter(identifiant_public=poste_id).first()
        return request.user.poste


class JournalAuditView(generics.ListAPIView):
    """Actes d'administration sur les comptes.

    Réservé aux administrateurs : un superviseur ne doit pas pouvoir
    vérifier ce que ses pairs ont fait, ni effacer ses propres traces en
    les consultant.
    """

    permission_classes = [IsAuthenticated, EstAdministrateur]
    serializer_class = JournalAuditSerializer
    pagination_class = None

    def get_queryset(self):
        return JournalAudit.objects.select_related("auteur", "cible")[:200]
