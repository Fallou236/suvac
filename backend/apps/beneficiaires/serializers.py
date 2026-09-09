"""Sérialiseurs des bénéficiaires."""

from rest_framework import serializers

from apps.accounts.models import PosteSante

from .models import CanalRappel, Consentement, Enfant, Grossesse, Mere


class ConsentementSerializer(serializers.ModelSerializer):
    recueilli_par = serializers.CharField(source="recueilli_par.get_full_name", read_only=True)
    actif = serializers.SerializerMethodField()

    class Meta:
        model = Consentement
        fields = ["id", "canal", "accorde_le", "revoque_le", "recueilli_par", "actif"]
        read_only_fields = ["id", "accorde_le", "revoque_le", "recueilli_par"]

    def get_actif(self, obj: Consentement) -> bool:
        return obj.revoque_le is None


class MereSerializer(serializers.ModelSerializer):
    """Vue complète d'une mère, pour sa fiche."""

    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    nom_complet = serializers.CharField(read_only=True)
    accepte_les_rappels = serializers.BooleanField(read_only=True)
    consentements = ConsentementSerializer(many=True, read_only=True)
    nombre_enfants = serializers.SerializerMethodField()

    class Meta:
        model = Mere
        fields = [
            "id",
            "prenom",
            "nom",
            "nom_complet",
            "date_naissance",
            "telephone",
            "langue",
            "village",
            "accepte_les_rappels",
            "consentements",
            "nombre_enfants",
            "cree_le",
        ]
        read_only_fields = ["id", "cree_le"]

    def get_nombre_enfants(self, obj: Mere) -> int:
        return obj.enfants.filter(supprime_le__isnull=True).count()

    def create(self, donnees_validees: dict) -> Mere:
        """Le poste vient de l'agent, jamais du client (EF-03)."""
        donnees_validees["poste"] = self._poste_de_l_agent()
        return super().create(donnees_validees)

    def _poste_de_l_agent(self) -> PosteSante:
        utilisateur = self.context["request"].user
        if utilisateur.poste is None:
            raise serializers.ValidationError(
                {"poste": "Votre compte n'est rattaché à aucun poste de santé."}
            )
        return utilisateur.poste


class MereListeSerializer(serializers.ModelSerializer):
    """Vue allégée pour les listes et la recherche.

    Charger les consentements de trente mères dans une liste serait du gaspillage
    de bande passante, sur des connexions qui n'en ont pas à revendre.
    """

    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    nom_complet = serializers.CharField(read_only=True)

    class Meta:
        model = Mere
        fields = ["id", "prenom", "nom", "nom_complet", "telephone", "village"]


class EnfantSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    mere_id = serializers.UUIDField(write_only=True)
    mere = MereListeSerializer(read_only=True)
    nom_complet = serializers.CharField(read_only=True)
    est_premature = serializers.BooleanField(read_only=True)
    age_jours = serializers.SerializerMethodField()

    class Meta:
        model = Enfant
        fields = [
            "id",
            "mere",
            "mere_id",
            "prenom",
            "nom",
            "nom_complet",
            "date_naissance",
            "sexe",
            "semaines_gestation",
            "poids_naissance_grammes",
            "est_premature",
            "age_jours",
            "cree_le",
        ]
        read_only_fields = ["id", "cree_le"]

    def get_age_jours(self, obj: Enfant) -> int:
        return obj.age_en_jours()

    def validate_mere_id(self, valeur):
        """La mère doit exister ET appartenir au poste de l'agent."""
        utilisateur = self.context["request"].user
        meres = Mere.objects.all()
        if not utilisateur.est_administrateur:
            meres = meres.filter(poste_id=utilisateur.poste_id)

        mere = meres.filter(identifiant_public=valeur).first()
        if mere is None:
            raise serializers.ValidationError("Mère introuvable.")
        return mere

    def create(self, donnees_validees: dict) -> Enfant:
        mere = donnees_validees.pop("mere_id")
        donnees_validees["mere"] = mere
        donnees_validees["poste"] = mere.poste
        return super().create(donnees_validees)


class EnfantListeSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    nom_complet = serializers.CharField(read_only=True)
    mere_nom = serializers.CharField(source="mere.nom_complet", read_only=True)

    class Meta:
        model = Enfant
        fields = ["id", "nom_complet", "date_naissance", "sexe", "mere_nom"]


class GrossesseSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    mere_id = serializers.UUIDField(write_only=True)
    mere = MereListeSerializer(read_only=True)

    class Meta:
        model = Grossesse
        fields = [
            "id",
            "mere",
            "mere_id",
            "rang",
            "date_reference",
            "terme_estime",
            "statut",
            "cree_le",
        ]
        read_only_fields = ["id", "cree_le"]

    def validate_mere_id(self, valeur):
        utilisateur = self.context["request"].user
        meres = Mere.objects.all()
        if not utilisateur.est_administrateur:
            meres = meres.filter(poste_id=utilisateur.poste_id)

        mere = meres.filter(identifiant_public=valeur).first()
        if mere is None:
            raise serializers.ValidationError("Mère introuvable.")
        return mere

    def validate(self, attrs: dict) -> dict:
        reference = attrs.get("date_reference")
        terme = attrs.get("terme_estime")
        if reference and terme and terme < reference:
            raise serializers.ValidationError(
                {"terme_estime": "Le terme ne peut précéder le premier contact prénatal."}
            )
        return attrs

    def create(self, donnees_validees: dict) -> Grossesse:
        donnees_validees["mere"] = donnees_validees.pop("mere_id")
        return super().create(donnees_validees)


class CreationConsentementSerializer(serializers.Serializer):
    canal = serializers.ChoiceField(choices=CanalRappel.choices)
