"""Jeu de données de démonstration.

    python manage.py charger_donnees_demo --vider
    python manage.py charger_donnees_demo --vider --telephone "+221771234567"

Couvre les cas de figure qu'il faut pouvoir vérifier pendant le développement
et montrer en soutenance : un parcours nominal, des retards de sévérité
croissante, des doses périmées, un prématuré, un nourrisson sans prénom, une
grossesse, un refus de consentement, des homonymes, un enfant d'un autre
poste pour tester le cloisonnement.

Produit aussi de quoi remplir les écrans d'administration : rappels à
différents statuts d'acheminement, accès bénéficiaires ouverts, actes
d'audit, un poste fermé et un compte désactivé dont les doses restent
attribuées. Sans cela, le journal du superviseur et l'espace de la mère
seraient vides.

AVERTISSEMENT — toutes les données sont fictives (ENF-24). Les noms sont
courants au Sénégal mais ne désignent personne.
"""

from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.audit import ActeAdministration, JournalAudit
from apps.accounts.models import Langue, PosteSante, Role, Utilisateur
from apps.beneficiaires.models import (
    CanalRappel,
    Consentement,
    Enfant,
    Grossesse,
    Mere,
    Sexe,
)
from apps.rappels.models import CanalRappel as CanalEnvoi
from apps.rappels.models import Rappel, StatutRappel
from apps.rappels.services import planifier_les_rappels
from apps.suivi.models import (
    DoseAdministree,
    Echeance,
    MotifAnnulation,
    StatutEcheance,
)
from apps.suivi.services import enregistrer_dose, rafraichir_statuts

MOT_DE_PASSE = "suvac-demo-2026"

# Renseignez votre numéro WhatsApp pour voir les rappels arriver réellement
# pendant la démonstration, ou passez --telephone. Les autres numéros
# restent fictifs.
TELEPHONE_DEMONSTRATION = ""


class Command(BaseCommand):
    help = "Charge un jeu de données de démonstration couvrant les cas d'usage."

    def add_arguments(self, parser):
        parser.add_argument(
            "--vider",
            action="store_true",
            help="Supprime les bénéficiaires et le suivi avant de charger.",
        )
        parser.add_argument(
            "--telephone",
            default="",
            help=(
                "Numéro WhatsApp réel attribué à une mère, pour voir les "
                "rappels arriver pendant la démonstration."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["vider"]:
            self._vider()

        postes = self._postes()
        agents = self._utilisateurs(postes)
        self._beneficiaires(postes, agents, options["telephone"])

        modifiees = rafraichir_statuts()
        self.stdout.write(f"Statuts rafraîchis : {modifiees} échéances.")

        self._acces_beneficiaires()
        self._rappels()
        self._audit(agents)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nComptes créés — mot de passe commun : {MOT_DE_PASSE}\n"
                "  awa.ndiaye    agent, Ndondol\n"
                "  moussa.sow    agent, Ndondol\n"
                "  fatou.gueye   superviseur, Ndondol\n"
                "  ibrahima.ba   agent, Ngaparou (pour tester le cloisonnement)\n"
                "  omar.diallo   superviseur, Ngaparou\n"
                "  mame.diarra   agent désactivé, Ndondol\n"
                "  rokhaya.ba    bénéficiaire, espace de la mère\n"
                "  yacine.seck   bénéficiaire, deux enfants suivis\n"
                "  admin.suvac   administrateur, tous les postes\n"
            )
        )
        self.stdout.write(
            self.style.WARNING("Données entièrement fictives. Ne jamais charger en production.")
        )

    # ------------------------------------------------------------------ #

    def _vider(self):
        from apps.rappels.models import Rappel

        Rappel.objects.all().delete()
        JournalAudit.objects.all().delete()
        # Les doses protègent les échéances (RG-10) : elles partent d'abord.
        DoseAdministree.objects.all().delete()
        Echeance.objects.all().delete()
        Consentement.objects.all().delete()
        Enfant.tous.all().delete()
        Grossesse.tous.all().delete()
        # Les comptes de bénéficiaires n'ont plus d'objet une fois les mères
        # supprimées.
        Utilisateur.objects.filter(role=Role.BENEFICIAIRE).delete()
        Mere.tous.all().delete()
        self.stdout.write("Bénéficiaires, suivi, rappels et audit effacés.")

    def _postes(self) -> dict[str, PosteSante]:
        donnees = [
            ("Poste de Santé de Ndondol", "Bambey", "Diourbel", True),
            ("Poste de Santé de Ngaparou", "Mbour", "Thiès", True),
            # Un poste fermé : son historique demeure, il n'accueille plus.
            ("Poste de Santé de Keur Baka", "Bambey", "Diourbel", False),
        ]
        postes = {}
        for nom, district, region, actif in donnees:
            poste, _ = PosteSante.objects.update_or_create(
                nom=nom,
                district=district,
                defaults={
                    "region": region,
                    "actif": actif,
                    "telephone": "+221339710001" if actif else "",
                },
            )
            postes[nom.split()[-1]] = poste
        self.stdout.write(f"Postes : {len(postes)}.")
        return postes

    def _utilisateurs(self, postes) -> dict[str, Utilisateur]:
        donnees = [
            ("awa.ndiaye", "Awa", "Ndiaye", Role.AGENT, "Ndondol", True),
            ("moussa.sow", "Moussa", "Sow", Role.AGENT, "Ndondol", True),
            ("fatou.gueye", "Fatou", "Guèye", Role.SUPERVISEUR, "Ndondol", True),
            ("ibrahima.ba", "Ibrahima", "Ba", Role.AGENT, "Ngaparou", True),
            # Chaque poste a son superviseur : le cloisonnement se vérifie
            # en comparant deux tableaux de bord.
            ("omar.diallo", "Omar", "Diallo", Role.SUPERVISEUR, "Ngaparou", True),
            # Compte désactivé : les doses qu'il a enregistrées gardent leur
            # auteur (RG-10).
            ("mame.diarra", "Mame Diarra", "Lô", Role.AGENT, "Ndondol", False),
            # Administrateur, sans poste de rattachement : il voit tous les
            # postes.
            ("admin.suvac", "Administrateur", "SUVAC", Role.ADMINISTRATEUR, None, True),
        ]
        agents = {}
        for identifiant, prenom, nom, role, poste, actif in donnees:
            utilisateur, _ = Utilisateur.objects.update_or_create(
                username=identifiant,
                defaults={
                    "first_name": prenom,
                    "last_name": nom,
                    "role": role,
                    "poste": postes[poste] if poste else None,
                    "password": make_password(MOT_DE_PASSE),
                    "is_active": actif,
                    "doit_changer_mot_de_passe": False,
                },
            )
            agents[identifiant] = utilisateur
        self.stdout.write(f"Utilisateurs : {len(agents)}.")
        return agents

    def _beneficiaires(self, postes, agents, telephone_reel=""):
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
        # Cette mère porte le numéro réel quand il est fourni : c'est elle
        # qui recevra les rappels pendant la démonstration.
        mere = self._mere(
            "Rokhaya",
            "Ba",
            telephone_reel or TELEPHONE_DEMONSTRATION or "+221771000005",
            ndondol,
            "Keur Samba",
        )
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

        # ---- Cas 7 : rappels dans l'application seulement -------------
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

        # ---- Cas 8 : consentement révoqué (EF-47) ---------------------
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
        # Deux enfants : le message vocal précise alors le mois de
        # naissance, faute de pouvoir prononcer les prénoms.
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

        # ---- Cas 14 : homonymes dans le même poste --------------------
        # Deux mères portent le même nom. Rien dans le système ne repose
        # sur l'identité nominale : chaque bénéficiaire a son identifiant
        # public (EF-13).
        mere = self._mere("Fatou", "Ndiaye", "+221771000013", ndondol, "Ndondol")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        self._enfant(
            mere,
            "Seynabou",
            "Ndiaye",
            aujourdhui - timedelta(days=85),
            Sexe.FEMININ,
            ndondol,
        )

        mere = self._mere("Fatou", "Ndiaye", "+221771000014", ndondol, "Keur Samba")
        self._consentir(mere, agents["moussa.sow"], CanalRappel.SMS)
        self._enfant(
            mere,
            "Babacar",
            "Ndiaye",
            aujourdhui - timedelta(days=140),
            Sexe.MASCULIN,
            ndondol,
        )

        # ---- Cas 15 : second poste alimenté ---------------------------
        # Ngaparou doit avoir de quoi remplir son tableau de bord, sinon la
        # comparaison entre postes n'a aucun sens.
        for prenom, enfant_prenom, jours, telephone in [
            ("Nafissatou", "Pape", 55, "+221771000015"),
            ("Mariètou", "Ndeye Astou", 180, "+221771000016"),
            ("Seynabou", "Serigne", 35, "+221771000017"),
        ]:
            mere = self._mere(prenom, "Diagne", telephone, ngaparou, "Ngaparou")
            self._consentir(mere, agents["ibrahima.ba"], CanalRappel.WHATSAPP)
            self._enfant(
                mere,
                enfant_prenom,
                "Diagne",
                aujourdhui - timedelta(days=jours),
                Sexe.MASCULIN if jours % 2 else Sexe.FEMININ,
                ngaparou,
            )

        # ---- Cas 16 : rattachée depuis le poste fermé -----------------
        # Keur Baka a fermé ; ses bénéficiaires ont rejoint Ndondol. Les
        # doses qu'un agent désormais désactivé avait enregistrées lui
        # restent attribuées.
        mere = self._mere("Diarra", "Kane", "+221771000018", ndondol, "Keur Baka")
        self._consentir(mere, awa, CanalRappel.WHATSAPP)
        enfant = self._enfant(
            mere,
            "Khadim",
            "Kane",
            aujourdhui - timedelta(days=250),
            Sexe.MASCULIN,
            ndondol,
        )
        self._administrer(
            enfant,
            agents["mame.diarra"],
            [("BCG", 1, 248), ("VPO", 1, 248), ("PENTA", 1, 205)],
        )

        self.stdout.write(f"Mères : {Mere.objects.count()}.")
        self.stdout.write(f"Enfants : {Enfant.objects.count()}.")
        self.stdout.write(f"Grossesses : {Grossesse.objects.count()}.")
        self.stdout.write(f"Échéances : {Echeance.objects.count()}.")

    # ------------------------------------------------------------------ #

    def _acces_beneficiaires(self):
        """Ouvre un accès à deux mères, pour montrer l'espace bénéficiaire.

        L'une a deux enfants suivis, ce qui fait apparaître la désignation
        par mois de naissance dans ses messages.
        """
        comptes = [
            ("rokhaya.ba", "Rokhaya", "Ba"),
            ("yacine.seck", "Yacine", "Seck"),
        ]

        ouverts = 0
        for identifiant, prenom, nom in comptes:
            mere = Mere.objects.filter(prenom=prenom, nom=nom).first()
            if mere is None or mere.compte_id:
                continue

            compte = Utilisateur.objects.create_user(
                username=identifiant,
                password=MOT_DE_PASSE,
                first_name=prenom,
                last_name=nom,
                role=Role.BENEFICIAIRE,
                langue=mere.langue,
                telephone=mere.telephone,
            )
            mere.compte = compte
            mere.save(update_fields=["compte", "modifie_le"])
            ouverts += 1

        self.stdout.write(f"Accès bénéficiaires ouverts : {ouverts}.")

    def _rappels(self):
        """Planifie les rappels et leur attribue des statuts variés.

        Sans cela, le journal du superviseur serait vide et les indicateurs
        d'acheminement sans objet. Les statuts simulent un balayage dont les
        messages sont partis quelques heures plus tôt.
        """
        bilan = planifier_les_rappels()
        self.stdout.write(f"Rappels planifiés : {bilan}.")

        maintenant = timezone.now()
        rappels = list(Rappel.objects.exclude(canal=CanalEnvoi.APPLICATION))

        for index, rappel in enumerate(rappels):
            rappel.envoye_le = maintenant - timedelta(hours=3)
            rappel.identifiant_externe = f"wamid.DEMO{index:04d}"

            # Un échec sur cinq, pour que le motif apparaisse dans la
            # synthèse ; le reste remis, dont une partie lue.
            if index % 5 == 0:
                rappel.statut = StatutRappel.ECHEC
                rappel.erreur = "[131026] Receiver incapable of receiving message"
                rappel.tentatives = 3
            elif index % 3 == 0:
                rappel.statut = StatutRappel.LU
                rappel.remis_le = maintenant - timedelta(hours=2, minutes=50)
            else:
                rappel.statut = StatutRappel.REMIS
                rappel.remis_le = maintenant - timedelta(hours=2, minutes=55)

            rappel.save()

        self.stdout.write(f"Statuts d'acheminement attribués : {len(rappels)}.")

    def _audit(self, agents):
        """Quelques actes d'administration, pour que le journal soit parlant.

        Les actes portant sur un poste n'ont pas de cible utilisateur : le
        détail porte alors l'information.
        """
        fatou = agents["fatou.gueye"]
        actes = [
            (
                ActeAdministration.CREATION_POSTE,
                None,
                None,
                "Poste de Santé de Keur Baka — Bambey, Diourbel",
            ),
            (
                ActeAdministration.CREATION_COMPTE,
                fatou,
                agents["moussa.sow"],
                "Agent de santé au Poste de Santé de Ndondol",
            ),
            (
                ActeAdministration.CREATION_COMPTE,
                fatou,
                agents["mame.diarra"],
                "Agent de santé au Poste de Santé de Ndondol",
            ),
            (
                ActeAdministration.REINITIALISATION,
                fatou,
                agents["awa.ndiaye"],
                "",
            ),
            (
                ActeAdministration.TRANSFERT,
                fatou,
                agents["moussa.sow"],
                "Poste de Santé de Keur Baka → Poste de Santé de Ndondol",
            ),
            (
                ActeAdministration.DESACTIVATION,
                fatou,
                agents["mame.diarra"],
                "Départ du poste",
            ),
            (
                ActeAdministration.MODIFICATION_POSTE,
                None,
                None,
                "Poste de Santé de Keur Baka — fermé",
            ),
        ]

        for acte, auteur, cible, detail in actes:
            JournalAudit.objects.create(
                acte=acte,
                auteur=auteur,
                cible=cible,
                auteur_identifiant=auteur.username if auteur else "admin",
                cible_identifiant=cible.username if cible else "",
                detail=detail,
            )

        self.stdout.write(f"Actes d'audit : {len(actes)}.")

    # ------------------------------------------------------------------ #

    def _mere(self, prenom, nom, telephone, poste, village, langue=Langue.WOLOF):
        """Crée une mère, ou la retrouve.

        L'unicité porte sur le couple nom-village plutôt que sur le nom
        seul : deux homonymes du même poste doivent coexister.
        """
        mere, _ = Mere.objects.update_or_create(
            prenom=prenom,
            nom=nom,
            village=village,
            poste=poste,
            defaults={"telephone": telephone, "langue": langue},
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
