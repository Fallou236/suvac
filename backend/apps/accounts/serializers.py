"""Sérialiseurs des comptes et des postes de santé."""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import PosteSante, Utilisateur


class PosteSanteSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)

    class Meta:
        model = PosteSante
        fields = ["id", "nom", "district", "region", "actif"]
        read_only_fields = fields


class UtilisateurSerializer(serializers.ModelSerializer):
    """Profil de l'utilisateur connecté."""

    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    poste = PosteSanteSerializer(read_only=True)
    nom_complet = serializers.SerializerMethodField()

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "nom_complet",
            "email",
            "role",
            "poste",
            "telephone",
            "langue",
        ]
        read_only_fields = ["id", "username", "role", "poste"]

    def get_nom_complet(self, obj: Utilisateur) -> str:
        return obj.get_full_name().strip() or obj.username


class ConnexionSerializer(TokenObtainPairSerializer):
    """Ajoute le profil à la réponse de connexion.

    Sans cela, le client devrait enchaîner un second appel pour savoir qui il
    est et à quel poste il est rattaché — deux allers-retours là où un seul
    suffit, sur des connexions souvent mauvaises.
    """

    @classmethod
    def get_token(cls, utilisateur):
        jeton = super().get_token(utilisateur)
        jeton["role"] = utilisateur.role
        jeton["poste_id"] = str(utilisateur.poste.identifiant_public) if utilisateur.poste else None
        return jeton

    def validate(self, attrs):
        donnees = super().validate(attrs)
        donnees["utilisateur"] = UtilisateurSerializer(self.user).data
        return donnees


class ChangementMotDePasseSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True)

    def validate_ancien_mot_de_passe(self, valeur: str) -> str:
        utilisateur = self.context["request"].user
        if not utilisateur.check_password(valeur):
            raise serializers.ValidationError("Mot de passe actuel incorrect.")
        return valeur

    def validate_nouveau_mot_de_passe(self, valeur: str) -> str:
        validate_password(valeur, self.context["request"].user)
        return valeur

    def save(self, **kwargs) -> Utilisateur:
        utilisateur = self.context["request"].user
        utilisateur.set_password(self.validated_data["nouveau_mot_de_passe"])
        utilisateur.save(update_fields=["password"])
        return utilisateur
