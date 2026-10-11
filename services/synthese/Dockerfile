# Python 3.11 : le modèle wolof exige des versions de PyTorch et de
# transformers incompatibles avec le backend, qui tourne en 3.13.
FROM python:3.11-slim

# Le paquet TTS compile des extensions C ; ffmpeg sert au rééchantillonnage.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /service

# Les dépendances d'abord : cette couche est réutilisée tant que
# requirements.txt ne change pas, ce qui évite de recompiler TTS à chaque
# modification du code.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY serveur.py .
COPY telecharger_modele.py .

# Le modèle vit dans un volume : l'inclure ici porterait l'image à plus de
# trois gigaoctets et imposerait un jeton Hugging Face à la construction.
ENV TTS_CHECKPOINTS=/modele \
    TTS_SORTIE=/audio \
    PYTHONUNBUFFERED=1

EXPOSE 8800

CMD ["python", "serveur.py"]