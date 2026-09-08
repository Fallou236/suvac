"""Point de contrôle de santé — exigence ENF-32."""

from django.db import connection
from django.http import JsonResponse
import redis

from django.conf import settings


def healthz(request):
    etat = {"base": "inconnue", "redis": "inconnue"}
    ok = True

    try:
        with connection.cursor() as curseur:
            curseur.execute("SELECT 1")
        etat["base"] = "ok"
    except Exception as erreur:
        etat["base"] = f"erreur: {erreur.__class__.__name__}"
        ok = False

    try:
        redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2).ping()
        etat["redis"] = "ok"
    except Exception as erreur:
        etat["redis"] = f"erreur: {erreur.__class__.__name__}"
        ok = False

    return JsonResponse({"statut": "ok" if ok else "degrade", **etat},
                        status=200 if ok else 503)