# SUVAC — Kaay Ñakku

Plateforme de suivi de la vaccination pré et post natale, avec rappels
vocaux en wolof envoyés par WhatsApp.

Projet final du module Développement Backend — École Polytechnique de Thiès.
Encadrant : Professeur Michel Seck.

## Ce que fait l'application

Un agent de santé enregistre une mère et ses enfants. Le système calcule
leur calendrier vaccinal à partir du schéma du PEV sénégalais, affiche
chaque matin la file des bénéficiaires attendus, et envoie aux mères un
rappel vocal en wolof avant chaque échéance.

Le superviseur suit la couverture de son poste, gère son personnel et
consulte le journal des rappels émis. La mère, si l'agent lui ouvre un
accès, consulte le carnet de ses enfants et ses messages.

## Architecture

![Architecture du système](docs/images/architecture.svg)

Le navigateur parle à Django, qui tient le moteur de calendrier, l'API et
l'abstraction des canaux. PostgreSQL conserve les données, Redis sert de
courtier à Celery, qui exécute le balayage quotidien et les envois.

Les messages vocaux passent par un service de synthèse séparé : le modèle
wolof exige des versions de bibliothèques incompatibles avec le backend.
WhatsApp est le canal principal, le SMS le repli, et l'application elle-même
sert les mères qui ont refusé les deux.

## Pile technique

Django 5 et Django REST Framework, PostgreSQL 16, Celery et Redis côté
serveur. React 19, TypeScript et Vite côté client. Docker Compose pour
l'environnement local.

---

# Installation

Trois niveaux, du plus simple au plus complet. Le premier suffit pour voir
fonctionner l'application entière.

## 1. L'essentiel — dix minutes

L'application tourne, les rappels sont composés en wolof et consultables
dans le journal. Aucun message n'est envoyé : le canal de simulation les
journalise.

### Ce qu'il faut

Docker et Docker Compose, Python 3.13, Node 22.

### Les services

```bash
git clone https://github.com/Fallou236/suvac.git
cd suvac
docker compose up -d
```

Si le port 6379 est déjà pris par un Redis local, lancez seulement la base :
`docker compose up -d db`.

### Le backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
```

Ouvrez `backend/.env` et renseignez la clé secrète :

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Laissez les variables `WHATSAPP_*` et `SYNTHESE_*` vides : sans elles,
l'application bascule sur la simulation.

```bash
python manage.py migrate
python manage.py charger_schema_pev
python manage.py charger_descriptions
python manage.py charger_donnees_demo --vider
python manage.py runserver
```

### Le frontend

Dans un second terminal :

```bash
cd frontend
npm install
npm run dev
```

L'application est sur `http://localhost:5173`.

### Les comptes

Mot de passe commun : `suvac-demo-2026`

| Identifiant | Rôle | À voir |
|---|---|---|
| `awa.ndiaye` | Agent, Ndondol | File du jour, saisie d'une dose |
| `fatou.gueye` | Superviseur, Ndondol | Pilotage, journal des rappels, personnel |
| `omar.diallo` | Superviseur, Ngaparou | Les mêmes écrans, d'autres chiffres : le cloisonnement |
| `admin.suvac` | Administrateur | Postes, journal d'audit |
| `rokhaya.ba` | Bénéficiaire | L'espace de la mère |
| `yacine.seck` | Bénéficiaire | Deux enfants suivis |

Toutes les données sont fictives.

### Déclencher un balayage

```bash
python manage.py balayer
```

Les rappels sont composés, journalisés, et consultables dans l'écran
« Journal des rappels » avec `fatou.gueye`.

---

## 2. Les messages vocaux — une heure

Ajoute la voix wolof aux messages. Les fichiers sont produits localement ;
aucun envoi n'a lieu.

### Ce qu'il faut

Python 3.11 en plus de 3.13, ffmpeg, et sous Windows les outils de
compilation Microsoft C++ — le paquet `TTS` contient des extensions en C.

```bash
# Linux
sudo apt install ffmpeg python3.11-venv

# Windows
winget install ffmpeg
winget install Python.Python.3.11
winget install Microsoft.VisualStudio.2022.BuildTools
```

Sous Windows, ouvrez ensuite Visual Studio Installer, modifiez Build Tools
et cochez « Développement Desktop en C++ ». Travaillez depuis l'invite
**x64 Native Tools Command Prompt** : l'invite ordinaire compile en 32 bits
et l'édition de liens échoue.

### Le service

```bash
cd services/synthese
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Le modèle

Il pèse 952 Mo et demande d'accepter les conditions sur Hugging Face.

```bash
pip install huggingface_hub
hf auth login
python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='AIHubSN/Kiriku-Wolof-TTS', local_dir='checkpoints')"
```

### Lancer

```bash
python serveur.py
```

Puis, dans `backend/.env` : SYNTHESE_URL=http://127.0.0.1:8800


Au prochain balayage, les messages seront prononcés. Comptez cinq à vingt
secondes par message distinct ; les suivants sont servis par le cache.

Les fichiers produits sont dans `backend/media/synthese/`.

---

## 3. L'envoi réel par WhatsApp

Demande un compte Meta Business et un numéro de test. Gratuit, mais une
trentaine de minutes de configuration.

### Le compte

Créez un compte sur `business.facebook.com`, puis une application de type
Business sur `developers.facebook.com` avec le produit WhatsApp.

Meta fournit un numéro de test et un jeton. Déclarez les numéros
destinataires dans la section « À » — cinq au maximum, chacun validant un
code reçu sur WhatsApp.

### Le modèle de message

Dans le Gestionnaire WhatsApp, créez un modèle :

- Nom : `rappel_vaccinal`
- Catégorie : Utilitaire
- Langue : Français
- En-tête : Vidéo
- Corps : `Rappel de vaccination pour {{1}}. Écoutez le message.`
- Pied de page : `Kaay Ñakku — Poste de santé`

L'approbation prend de quelques minutes à quelques heures.

### La configuration

Dans `backend/.env` :

WHATSAPP_NUMERO_ID=l-identifiant-du-numero-de-test
WHATSAPP_COMPTE_ID=l-identifiant-du-compte-business
WHATSAPP_JETON=le-jeton
WHATSAPP_VERSION_API=v25.0
WHATSAPP_MODELE_RAPPEL=rappel_vaccinal


Le jeton temporaire expire en vingt-quatre heures. Pour un jeton permanent,
créez un utilisateur système dans les paramètres d'entreprise, affectez-lui
l'application et le compte WhatsApp, puis générez un jeton avec les
autorisations `whatsapp_business_messaging` et `whatsapp_business_management`.

### Essayer

Attribuez votre numéro à une mère :

```bash
python manage.py charger_donnees_demo --vider --telephone "+221771234567"
python manage.py balayer
```

Ou directement :

```bash
python manage.py essayer_whatsapp 221771234567
```

---

# Vérifier

```bash
cd backend && pytest -q
cd frontend && npm run verifier
```

Environ trois cents tests côté serveur, cent cinquante côté client.

# Documentation

- `docs/cahier-des-charges.pdf` — périmètre, exigences, architecture
- `docs/adr/` — décisions d'architecture et leurs justifications
- `docs/sprints/` — planifications et rétrospectives
- `docs/libelles-wolof.md` — formulations validées par un locuteur natif
- `docs/identite-visuelle/` — palette, logo, jetons de conception
- `services/synthese/README.md` — le service de synthèse vocale

# Dépannage

**La base refuse la connexion.** Les conteneurs ne tournent pas :
`docker compose ps`.

**Le port 6379 est occupé.** Un Redis local tourne déjà. Lancez seulement
la base : `docker compose up -d db`.

**Les rappels ne partent pas.** Vérifiez le consentement de la mère : aucun
rappel n'est émis sans consentement actif (EF-47). Vérifiez aussi que son
numéro figure dans la liste autorisée chez Meta.

**Le service de synthèse refuse de s'installer sous Windows.** Les outils de
compilation C++ manquent, ou vous n'êtes pas dans l'invite x64.

**Un message est accepté par Meta mais n'arrive pas.** Le numéro n'est
probablement pas déclaré, ou sa validation n'a pas été faite. Cherchez la
conversation sous le numéro de test américain, pas sous un nom.