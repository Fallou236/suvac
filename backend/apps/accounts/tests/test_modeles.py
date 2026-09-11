import pytest
from django.db import IntegrityError

from apps.accounts.models import PosteSante, Role, Utilisateur


def test_agent_est_rattache_a_son_poste(agent, poste):
    assert agent.poste == poste
    assert agent.est_agent
    assert not agent.est_superviseur


def test_agent_sans_poste_est_refuse_par_la_base(db):
    with pytest.raises(IntegrityError):
        Utilisateur.objects.create_user(
            username="sans.poste", password="motdepasse-de-test-123", role=Role.AGENT
        )


def test_administrateur_peut_ne_pas_avoir_de_poste(db):
    admin = Utilisateur.objects.create_user(
        username="admin.suvac",
        password="motdepasse-de-test-123",
        role=Role.ADMINISTRATEUR,
    )
    assert admin.est_administrateur
    assert admin.poste is None


def test_superutilisateur_est_administrateur_sans_poste(db):
    admin = Utilisateur.objects.create_superuser(
        username="racine", email="racine@example.sn", password="motdepasse-de-test-123"
    )
    assert admin.role == Role.ADMINISTRATEUR
    assert admin.poste is None
    assert admin.is_superuser


def test_suppression_du_poste_est_logique(poste):
    poste.supprimer()
    assert PosteSante.objects.count() == 0
    assert PosteSante.tous.count() == 1


def test_un_objet_cree_n_est_pas_deja_supprime(db):
    """Régression : un poste créé depuis l'interface d'administration
    ressortait avec `supprime_le` renseigné, donc invisible partout."""
    poste = PosteSante.objects.create(nom="Poste de Thiénaba", district="Thiès", region="Thiès")

    assert poste.supprime_le is None
    assert PosteSante.objects.filter(pk=poste.pk).exists()
