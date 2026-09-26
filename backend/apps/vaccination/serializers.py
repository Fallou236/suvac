from rest_framework import serializers

from .models import RegleVaccinale, Vaccin


class VaccinSerializer(serializers.ModelSerializer):
    libelle = serializers.SerializerMethodField()

    class Meta:
        model = Vaccin
        fields = ["code", "libelle", "protege_contre", "description", "voie"]

    def get_libelle(self, obj: Vaccin) -> str:
        langue = self.context.get("langue", "fr")
        return obj.libelle(langue)


class RegleVaccinaleSerializer(serializers.ModelSerializer):
    vaccin_code = serializers.CharField(source="vaccin.code", read_only=True)
    vaccin_libelle = serializers.CharField(source="vaccin.libelle_fr", read_only=True)
    voie = serializers.CharField(source="vaccin.voie", read_only=True)

    class Meta:
        model = RegleVaccinale
        fields = [
            "id",
            "vaccin_code",
            "vaccin_libelle",
            "voie",
            "cible",
            "rang",
            "age_min_jours",
            "age_cible_jours",
            "age_limite_jours",
            "intervalle_min_jours",
            "actif",
        ]
        read_only_fields = fields
