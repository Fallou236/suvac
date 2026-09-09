from django.apps import AppConfig


class SuiviConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.suivi"
    verbose_name = "Suivi vaccinal"

    def ready(self):
        from . import signals  # noqa: F401
