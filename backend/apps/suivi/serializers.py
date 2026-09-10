"""Sérialiseurs des échéances et des doses."""

import uuid

from rest_framework import serializers

from .models import DoseAdministree, Echeance, MotifAnnulation


class DoseSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    agent = serializers.CharField(source="agent.get_full_name", read_only=True)

    class Meta:
        model = DoseAdministree
        fields = [
            "id",
            "date_administration",
            "numero_lot",
            "agent",
            "evenement_indesirable",
            "cree_le",
        ]
        read_only_fields = fields


class EcheanceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    vaccin_code = serializers.CharField(source="vaccin.code", read_only=True)
    vaccin_libelle = serializers.SerializerMethodField()
    dose = serializers.SerializerMethodField()
    retard_jours = serializers.SerializerMethodField()

    class Meta:
        model = Echeance
        fields = [
            "id",
            "vaccin_code",
            "vaccin_libelle",
            "rang",
            "date_ouverture",
            "date_cible",
            "date_limite",
            "statut",
            "motif_annulation",
            "retard_jours",
            "dose",
        ]
        read_only_fields = fields

    def get_vaccin_libelle(self, obj: Echeance) -> str:
        langue = self.context.get("langue", "fr")
        return obj.vaccin.libelle(langue)

    def get_dose(self, obj: Echeance) -> dict | None:
        dose = next((d for d in obj.doses.all() if d.remplacee_par_id is None), None)
        return DoseSerializer(dose).data if dose else None

    def get_retard_jours(self, obj: Echeance) -> int:
        return obj.retard_en_jours()


class EcheanceFileSerializer(EcheanceSerializer):
    """Vue enrichie pour la file du jour de l'agent (EF-42).

    Le nom du bénéficiaire et son téléphone sont inclus pour éviter à
    l'interface d'enchaîner une requête par ligne.
    """

    beneficiaire_nom = serializers.SerializerMethodField()
    beneficiaire_id = serializers.SerializerMethodField()
    beneficiaire_type = serializers.SerializerMethodField()
    telephone = serializers.SerializerMethodField()

    class Meta(EcheanceSerializer.Meta):
        fields = EcheanceSerializer.Meta.fields + [
            "beneficiaire_nom",
            "beneficiaire_id",
            "beneficiaire_type",
            "telephone",
        ]

    def get_beneficiaire_nom(self, obj: Echeance) -> str:
        if obj.enfant_id:
            return obj.enfant.nom_complet
        return obj.grossesse.mere.nom_complet

    def get_beneficiaire_id(self, obj: Echeance) -> str:
        cible = obj.enfant or obj.grossesse
        return str(cible.identifiant_public)

    def get_beneficiaire_type(self, obj: Echeance) -> str:
        return "enfant" if obj.enfant_id else "grossesse"

    def get_telephone(self, obj: Echeance) -> str:
        mere = obj.enfant.mere if obj.enfant_id else obj.grossesse.mere
        return mere.telephone


class CreationDoseSerializer(serializers.Serializer):
    """Entrée de l'enregistrement d'un acte vaccinal (EF-30)."""

    echeance_id = serializers.UUIDField()
    date_administration = serializers.DateField()
    numero_lot = serializers.CharField(required=False, allow_blank=True, default="")
    cle_idempotence = serializers.UUIDField(
        required=False,
        help_text="Générée par le client. Permet de rejouer sans doublon (EF-54).",
    )
    evenement_indesirable = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_cle_idempotence(self, valeur: uuid.UUID | None) -> uuid.UUID:
        return valeur or uuid.uuid4()


class AnnulationSerializer(serializers.Serializer):
    motif = serializers.ChoiceField(choices=MotifAnnulation.choices)
    commentaire = serializers.CharField(required=False, allow_blank=True, default="")


class CalendrierSerializer(serializers.Serializer):
    """Calendrier complet d'un bénéficiaire."""

    beneficiaire_id = serializers.UUIDField()
    beneficiaire_nom = serializers.CharField()
    date_reference = serializers.DateField()
    echeances = EcheanceSerializer(many=True)
