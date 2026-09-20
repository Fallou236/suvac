"""Jeu de données de démonstration.

    python manage.py charger_donnees_demo --vider

Couvre les cas de figure qu'il faut pouvoir vérifier pendant le développement
et montrer en soutenance : un parcours nominal, des retards de sévérité
croissante, des doses périmées, un prématuré, un nourrisson sans prénom, une
grossesse, un refus de consentement, un enfant d'un autre poste pour tester
le cloisonnement.

AVERTISSEMENT — toutes les données sont fictives (ENF-24). Les noms sont
courants au Sénégal mais ne désignent personne.
"""

from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Langue, PosteSante, Role, Utilisateur
from apps.beneficiaires.models import (
    CanalRappel,
    Consentement,
    Enfant,
    Grossesse,
    Mere,
    Sexe,
)
from apps.suivi.models import Echeance, MotifAnnulation, StatutEcheance
from apps.suivi.services import enregistrer_dose, rafraichir_statuts

MOT_DE_PASSE = "suvac-demo-2026"


class Command(BaseCommand):
    help = "Charge un jeu de données de démonstration couvrant les cas d'usage."

    def add_arguments(self, parser):
        parser.add_argument(
            "--vider",
            action="store_true",
            help="Supprime les bénéficiaires et le suivi avant de charger.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["vider"]:
            self._vider()

        postes = self._postes()
        agents = self._utilisateurs(postes)
        self._beneficiaires(postes, agents)

        modifiees = rafraichir_statuts()
        self.stdout.write(f"Statuts rafraîchis : {modifiees} échéances.")
        self.stdout.write(
            self.style.SUCCESS(
                f"\nComptes créés — mot de passe commun : {MOT_DE_PASSE}\n"
                "  awa.ndiaye    agent, Ndondol\n"
                "  moussa.sow    agent, Ndondol\n"
                "  fatou.gueye   superviseur, Ndondol\n"
                "  ibrahima.ba   agent, Ngaparou (pour tester le cloisonnement)\n"
            )
        )
        self.stdout.write(
            self.style.WARNING("Données entièrement fictives. Ne jamais charger en production.")
        )

    # ------------------------------------------------------------------ #

    def _vider(self):
        Echeance.objects.all().delete()
        Consentement.objects.all().delete()
        Enfant.tous.all().delete()
        Grossesse.tous.all().delete()
        Mere.tous.all().delete()
        self.stdout.write("Bénéficiaires et suivi effacés.")

    def _postes(self) -> dict[str, PosteSante]:
        donnees = [
            ("Poste de Santé de Ndondol", "Bambey", "Diourbel"),
            ("Poste de Santé de Ngaparou", "Mbour", "Thiès"),
        ]
        postes = {}
        for nom, district, region in donnees:
            poste, _ = PosteSante.objects.update_or_create(
                nom=nom, district=district, defaults={"region": region, "actif": True}
            )
            postes[nom.split()[-1]] = poste
        self.stdout.write(f"Postes : {len(postes)}.")
        return postes

    def _utilisateurs(self, postes) -> dict[str, Utilisateur]:
        donnees = [
            ("awa.ndiaye", "Awa", "Ndiaye", Role.AGENT, "Ndondol"),
            ("moussa.sow", "Moussa", "Sow", Role.AGENT, "Ndondol"),
            ("fatou.gueye", "Fatou", "Guèye", Role.SUPERVISEUR, "Ndondol"),
            ("ibrahima.ba", "Ibrahima", "Ba", Role.AGENT, "Ngaparou"),
        ]
        agents = {}
        for identifiant, prenom, nom, role, poste in donnees:
            utilisateur, _ = Utilisateur.objects.update_or_create(
                username=identifiant,
                defaults={
                    "first_name": prenom,
                    "last_name": nom,
                    "role": role,
                    "poste": postes[poste],
                    "password": make_password(MOT_DE_PASSE),
                    "is_active": True,
                },
            )
            agents[identifiant] = utilisateur
        self.stdout.write(f"Utilisateurs : {len(agents)}.")
        return agents

    def _beneficiaires(self, postes, agents):
        aujourdhui = timezone.localdate()
        ndondol = postes["Ndondol"]
        ngaparou = postes["Ngaparou"]
        awa = agents["awa.ndiaye"]

        # ---- Cas 1 : parcours nominal, à jour -------------------------
        mere = self._mere("Aïssatou", "Diop", "+221771000001", ndondol, "Keur Samba")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        enfant = self._enfant(
            mere,
            "Ndeye Fatou",
            "Diop",
            aujourdhui - timedelta(days=100),
            Sexe.FEMININ,
            ndondol,
        )
        self._administrer(
            enfant,
            awa,
            [
                ("BCG", 1, 100),
                ("VPO", 1, 100),
                ("PENTA", 1, 58),
                ("PNEUMO", 1, 58),
                ("ROTA", 1, 58),
                ("VPO", 2, 58),
                ("PENTA", 2, 30),
                ("PNEUMO", 2, 30),
                ("ROTA", 2, 30),
                ("VPO", 3, 30),
            ],
        )

        # ---- Cas 2 : dose due aujourd'hui -----------------------------
        mere = self._mere("Khady", "Ndiaye", "+221771000002", ndondol, "Ndondol")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        enfant = self._enfant(
            mere,
            "Moussa",
            "Ndiaye",
            aujourdhui - timedelta(days=42),
            Sexe.MASCULIN,
            ndondol,
        )
        self._administrer(enfant, awa, [("BCG", 1, 42), ("VPO", 1, 42)])

        # ---- Cas 3 : retard modéré ------------------------------------
        mere = self._mere("Bineta", "Fall", "+221771000003", ndondol, "Thiakhar")
        self._consentir(mere, awa, CanalRappel.SMS)
        self._enfant(
            mere,
            "Cheikh",
            "Fall",
            aujourdhui - timedelta(days=200),
            Sexe.MASCULIN,
            ndondol,
        )

        # ---- Cas 4 : retard sévère et doses périmées ------------------
        mere = self._mere("Maimouna", "Sarr", "+221771000004", ndondol, "Ndondol")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        enfant = self._enfant(
            mere,
            "Ousmane",
            "Sarr",
            aujourdhui - timedelta(days=400),
            Sexe.MASCULIN,
            ndondol,
        )
        self._administrer(enfant, awa, [("BCG", 1, 395)])

        # ---- Cas 5 : prématuré ----------------------------------------
        mere = self._mere("Rokhaya", "Ba", "+221771000005", ndondol, "Keur Samba")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        self._enfant(
            mere,
            "Sokhna",
            "Ba",
            aujourdhui - timedelta(days=70),
            Sexe.FEMININ,
            ndondol,
            gestation=33,
            poids=1850,
        )

        # ---- Cas 6 : nouveau-né sans prénom ---------------------------
        mere = self._mere("Adama", "Cissé", "+221771000006", ndondol, "Ndondol")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        self._enfant(mere, "", "Cissé", aujourdhui - timedelta(days=2), Sexe.MASCULIN, ndondol)

        # ---- Cas 7 : sans consentement (EF-47) ------------------------
        mere = self._mere("Coumba", "Faye", "+221771000007", ndondol, "Thiakhar")
        self._consentir(mere, awa, CanalRappel.APPLICATION)
        self._enfant(
            mere,
            "Mariama",
            "Faye",
            aujourdhui - timedelta(days=90),
            Sexe.FEMININ,
            ndondol,
        )

        # ---- Cas 8 : consentement révoqué -----------------------------
        mere = self._mere("Ndeye", "Thiam", "+221771000008", ndondol, "Ndondol")
        consentement = self._consentir(mere, awa, CanalRappel.WHATSAPP)
        consentement.revoquer()
        self._enfant(
            mere,
            "Ibrahima",
            "Thiam",
            aujourdhui - timedelta(days=120),
            Sexe.MASCULIN,
            ndondol,
        )

        # ---- Cas 9 : échéance annulée ---------------------------------
        mere = self._mere("Astou", "Mbaye", "+221771000009", ndondol, "Keur Samba")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        enfant = self._enfant(
            mere,
            "Aminata",
            "Mbaye",
            aujourdhui - timedelta(days=60),
            Sexe.FEMININ,
            ndondol,
        )
        echeance = Echeance.objects.filter(enfant=enfant, vaccin__code="ROTA", rang=1).first()
        if echeance and echeance.statut != StatutEcheance.ADMINISTREE:
            echeance.annuler(
                MotifAnnulation.CONTRE_INDICATION,
                "Antécédent d'invagination intestinale.",
            )

        # ---- Cas 10 : grossesse suivie --------------------------------
        mere = self._mere(
            "Sokhna", "Diouf", "+221771000010", ndondol, "Ndondol", langue=Langue.WOLOF
        )
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        Grossesse.objects.get_or_create(
            mere=mere,
            rang=2,
            defaults={
                "date_reference": aujourdhui - timedelta(days=45),
                "terme_estime": aujourdhui + timedelta(days=180),
            },
        )

        # ---- Cas 11 : fratrie, même mère ------------------------------
        mere = self._mere("Yacine", "Seck", "+221771000011", ndondol, "Thiakhar")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        self._enfant(
            mere,
            "Modou",
            "Seck",
            aujourdhui - timedelta(days=300),
            Sexe.MASCULIN,
            ndondol,
        )
        self._enfant(
            mere,
            "Fatima",
            "Seck",
            aujourdhui - timedelta(days=75),
            Sexe.FEMININ,
            ndondol,
        )

        # ---- Cas 12 : autre poste, pour le cloisonnement (EF-03) ------
        mere = self._mere("Dieynaba", "Sy", "+221771000012", ngaparou, "Ngaparou")
        self._consentir(mere, agents["ibrahima.ba"], CanalRappel.WHATSAPP)
        self._enfant(
            mere,
            "Alioune",
            "Sy",
            aujourdhui - timedelta(days=110),
            Sexe.MASCULIN,
            ngaparou,
        )

        # ---- Cas 13 : sans téléphone ----------------------------------
        mere = self._mere("Penda", "Wade", "", ndondol, "Keur Samba")
        self._enfant(mere, "Awa", "Wade", aujourdhui - timedelta(days=50), Sexe.FEMININ, ndondol)

        self.stdout.write(f"Mères : {Mere.objects.count()}.")
        self.stdout.write(f"Enfants : {Enfant.objects.count()}.")
        self.stdout.write(f"Grossesses : {Grossesse.objects.count()}.")
        self.stdout.write(f"Échéances : {Echeance.objects.count()}.")

    # ------------------------------------------------------------------ #

    def _mere(self, prenom, nom, telephone, poste, village, langue=Langue.WOLOF):
        mere, _ = Mere.objects.update_or_create(
            prenom=prenom,
            nom=nom,
            poste=poste,
            defaults={"telephone": telephone, "village": village, "langue": langue},
        )
        return mere

    def _consentir(self, mere, agent, canal):
        consentement, _ = Consentement.objects.get_or_create(
            mere=mere,
            canal=canal,
            revoque_le=None,
            defaults={"recueilli_par": agent},
        )
        return consentement

    def _enfant(self, mere, prenom, nom, naissance, sexe, poste, gestation=None, poids=None):
        enfant, _ = Enfant.objects.get_or_create(
            mere=mere,
            prenom=prenom,
            nom=nom,
            date_naissance=naissance,
            defaults={
                "sexe": sexe,
                "poste": poste,
                "semaines_gestation": gestation,
                "poids_naissance_grammes": poids,
            },
        )
        return enfant

    def _administrer(self, enfant, agent, doses):
        """doses : liste de (code, rang, jours écoulés depuis l'administration)."""
        aujourdhui = timezone.localdate()
        for code, rang, il_y_a in doses:
            echeance = Echeance.objects.filter(enfant=enfant, vaccin__code=code, rang=rang).first()
            if echeance is None or echeance.statut == StatutEcheance.ADMINISTREE:
                continue
            try:
                enregistrer_dose(
                    echeance=echeance,
                    date_administration=aujourdhui - timedelta(days=il_y_a),
                    agent=agent,
                    numero_lot=f"LOT-{code}-2026",
                )
            except Exception as erreur:  # noqa: BLE001
                self.stdout.write(
                    self.style.WARNING(f"  {enfant} — {code}-{rang} non administrée : {erreur}")
                )
