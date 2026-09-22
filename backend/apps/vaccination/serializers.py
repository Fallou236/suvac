from rest_framework import serializers

from .models import Vaccin


class VaccinSerializer(serializers.ModelSerializer):
    libelle = serializers.SerializerMethodField()

    class Meta:
        model = Vaccin
        fields = ["code", "libelle", "protege_contre", "description", "voie"]

    def get_libelle(self, obj: Vaccin) -> str:
        langue = self.context.get("langue", "fr")
        return obj.libelle(langue)
