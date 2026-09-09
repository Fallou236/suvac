"""Points d'accès des comptes et des postes."""

from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import PosteSante
from .serializers import (
    ChangementMotDePasseSerializer,
    ConnexionSerializer,
    PosteSanteSerializer,
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
        serializer = ChangementMotDePasseSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
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
