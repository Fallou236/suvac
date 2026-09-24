"""Sérialiseurs du journal des rappels."""

from rest_framework import serializers

from .models import Rappel


class RappelSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="identifiant_public", read_only=True)
    destinataire = serializers.CharField(source="mere.nom_complet", read_only=True)
    telephone = serializers.CharField(source="mere.telephone", read_only=True)
    village = serializers.CharField(source="mere.village", read_only=True)
    type_libelle = serializers.CharField(source="get_type_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    vaccins = serializers.SerializerMethodField()

    class Meta:
        model = Rappel
        fields = [
            "id",
            "destinataire",
            "telephone",
            "village",
            "type",
            "type_libelle",
            "canal",
            "langue",
            "statut",
            "statut_libelle",
            "texte",
            "vaccins",
            "planifie_pour",
            "envoye_le",
            "remis_le",
            "erreur",
            "tentatives",
        ]
        read_only_fields = fields

    def get_vaccins(self, obj: Rappel) -> list[str]:
        return [f"{echeance.vaccin.code}-{echeance.rang}" for echeance in obj.echeances.all()]
