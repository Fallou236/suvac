"""Sérialiseurs des comptes et des postes de santé."""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .audit import JournalAudit
from .models import PosteSante, Role, Utilisateur


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
            "doit_changer_mot_de_passe",
        ]
        read_only_fields = ["id", "username", "role", "poste", "doit_changer_mot_de_passe"]

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


class CreationAgentSerializer(serializers.Serializer):
    """Création d'un compte pour le personnel du poste.

    Le superviseur choisit le mot de passe initial et le transmet
    oralement ; l'agent devra le changer à sa première connexion.
    """

    username = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    telephone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[Role.AGENT, Role.SUPERVISEUR])
    mot_de_passe = serializers.CharField(min_length=8, write_only=True)
    poste_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_username(self, valeur: str) -> str:
        valeur = valeur.strip().lower()
        if Utilisateur.objects.filter(username=valeur).exists():
            raise serializers.ValidationError("Cet identifiant est déjà utilisé.")
        return valeur

    def validate_mot_de_passe(self, valeur: str) -> str:
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        try:
            validate_password(valeur)
        except ValidationError as erreur:
            raise serializers.ValidationError(list(erreur.messages)) from erreur
        return valeur


class TransfertSerializer(serializers.Serializer):
    poste_id = serializers.UUIDField()


class ReinitialisationSerializer(serializers.Serializer):
    mot_de_passe = serializers.CharField(min_length=8, write_only=True)

    def validate_mot_de_passe(self, valeur: str) -> str:
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        try:
            validate_password(valeur)
        except ValidationError as erreur:
            raise serializers.ValidationError(list(erreur.messages)) from erreur
        return valeur


class AgentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    nom_complet = serializers.CharField(read_only=True)
    poste = PosteSanteSerializer(read_only=True)
    role_libelle = serializers.CharField(source="get_role_display", read_only=True)
    derniere_connexion = serializers.DateTimeField(source="last_login", read_only=True)

    class Meta:
        model = Utilisateur
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "nom_complet",
            "telephone",
            "langue",
            "role",
            "role_libelle",
            "poste",
            "is_active",
            "doit_changer_mot_de_passe",
            "derniere_connexion",
            "date_joined",
        ]
        read_only_fields = [
            "id",
            "username",
            "nom_complet",
            "role_libelle",
            "poste",
            "doit_changer_mot_de_passe",
            "derniere_connexion",
            "date_joined",
        ]


class JournalAuditSerializer(serializers.ModelSerializer):
    acte_libelle = serializers.CharField(source="get_acte_display", read_only=True)

    class Meta:
        model = JournalAudit
        fields = [
            "id",
            "acte",
            "acte_libelle",
            "auteur_identifiant",
            "cible_identifiant",
            "detail",
            "horodatage",
        ]
        read_only_fields = fields
