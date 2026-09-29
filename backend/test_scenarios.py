"""Scénarios de bout en bout du hub : comptes, boutiques, validation par l'admin, visibilité.

À lancer depuis la racine du projet, avant de pousser :
    .venv\\Scripts\\python backend\\test_scenarios.py
Travaille sur une base temporaire neuve (données de démo) : la vraie base n'est jamais touchée.
"""
import os
import shutil
import sys
import tempfile

TMP = tempfile.mkdtemp(prefix="241shop-tests-")
os.environ["SHOP_DB"] = os.path.join(TMP, "test.db")
os.environ["UPLOAD_DIR"] = os.path.join(TMP, "uploads")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import seed  # noqa: E402  (crée l'app sur la base temporaire)
from app import app  # noqa: E402
from models import db  # noqa: E402

passed = 0


def check(label, cond, detail=""):
    global passed
    print(("OK   " if cond else "ÉCHEC"), label, "" if cond else detail)
    if not cond:
        raise SystemExit(1)
    passed += 1


def run():
    seed.run()
    seller, visitor, fan, admin = (app.test_client() for _ in range(4))
    admin.post("/api/admin/login", json={"password": "admin123"})

    # --- Inscription / connexion ---
    r = seller.post("/api/auth/register", json={"name": "Awa", "phone": "077 11 22 33", "password": "123"})
    check("mot de passe trop court refusé", r.status_code == 400)
    r = seller.post("/api/auth/register", json={"name": "Awa", "phone": "077 11 22 33", "password": "secret1"})
    check("inscription", r.status_code == 201, r.get_json())
    check("numéro normalisé", r.get_json()["phone"] == "77112233")
    r = visitor.post("/api/auth/register", json={"name": "Autre", "phone": "+241 77112233", "password": "secret1"})
    check("même numéro écrit autrement refusé", r.status_code == 409, r.get_json())
    check("mauvais mot de passe refusé",
          visitor.post("/api/auth/login", json={"phone": "077112233", "password": "faux"}).status_code == 401)
    check("visiteur non connecté", visitor.get("/api/auth/me").get_json()["user"] is None)

    # --- Boutique et produits du vendeur ---
    check("pas de produit sans boutique", seller.post("/api/my/products", json={"name": "T"}).status_code == 403)
    r = seller.post("/api/my/shop", json={"name": "Chez Awa & Fils !", "zone": "Quartier imaginaire"})
    check("quartier inconnu refusé", r.status_code == 400)
    r = seller.post("/api/my/shop", json={"name": "Chez Awa & Fils !", "description": "Pagnes"})
    shop = r.get_json()
    check("boutique créée en attente", r.status_code == 201 and shop["status"] == "pending", shop)
    check("adresse lisible (slug)", shop["slug"] == "chez-awa-fils", shop["slug"])
    check("une seule boutique par compte", seller.post("/api/my/shop", json={"name": "Deux"}).status_code == 409)
    r = seller.post("/api/my/products", json={
        "name": "Pagne wax", "rating": 5, "reviews_count": 999,
        "variants": [{"name": "6 yards", "price": 15000, "stock": 4}],
    })
    product = r.get_json()
    check("produit créé", r.status_code == 201, product)
    check("le vendeur ne s'invente pas des avis", product["rating"] == 0 and product["reviews_count"] == 0)
    r = seller.put(f"/api/my/products/{product['id']}", json={"variants": [{"name": "x", "price": "abc"}]})
    check("prix invalide refusé proprement", r.status_code == 400)
    check("produit d'une autre boutique intouchable",
          seller.put("/api/my/products/1", json={"name": "Piratage"}).status_code == 404)

    # --- Invisible tant que la boutique n'est pas validée ---
    names = [p["name"] for p in visitor.get("/api/products").get_json()]
    check("produit caché au public", "Pagne wax" not in names)
    check("fiche cachée au public", visitor.get(f"/api/products/{product['id']}").status_code == 404)
    check("aperçu pour le vendeur", seller.get(f"/api/products/{product['id']}").status_code == 200)
    check("boutique cachée au public", visitor.get("/api/shops/chez-awa-fils").status_code == 404)
    r = visitor.post("/api/orders", json={
        "customer_name": "X", "customer_phone": "066000000", "delivery_method": "pickup",
        "items": [{"variant_id": product["variants"][0]["id"], "quantity": 1}],
    })
    check("commande impossible avant validation", r.status_code == 400)

    # --- Validation par l'admin ---
    shops = admin.get("/api/admin/shops").get_json()
    check("boutique en attente listée en premier", shops[0]["slug"] == "chez-awa-fils")
    check("compteur des boutiques en attente", admin.get("/api/admin/stats").get_json()["pending_shops"] == 1)
    check("validation", admin.put(f"/api/admin/shops/{shop['id']}", json={"status": "active"}).status_code == 200)
    official = next(s for s in shops if s["official"])
    check("boutique officielle jamais suspendue",
          admin.put(f"/api/admin/shops/{official['id']}", json={"status": "suspended"}).status_code == 400)
    check("produit visible après validation",
          "Pagne wax" in [p["name"] for p in visitor.get("/api/products").get_json()])
    check("filtre par boutique",
          [p["name"] for p in visitor.get("/api/products?shop=chez-awa-fils").get_json()] == ["Pagne wax"])
    public = visitor.get("/api/shops/chez-awa-fils").get_json()
    check("page publique sans infos privées", "address" not in public and "owner" not in public)

    # --- Suivre ---
    check("suivre demande un compte", visitor.post("/api/shops/chez-awa-fils/follow").status_code == 401)
    fan.post("/api/auth/register", json={"name": "Moussa", "phone": "066 55 44 33", "password": "secret2"})
    check("abonnement", fan.post("/api/shops/chez-awa-fils/follow").get_json()["followers_count"] == 1)
    fan.post("/api/shops/chez-awa-fils/follow")
    check("pas de double abonnement", fan.get("/api/shops/chez-awa-fils").get_json()["followers_count"] == 1)
    check("boutiques suivies", [s["slug"] for s in fan.get("/api/me/follows").get_json()] == ["chez-awa-fils"])
    check("désabonnement", fan.delete("/api/shops/chez-awa-fils/follow").get_json()["followers_count"] == 0)

    # --- Annuaire, suspension, comptes ---
    listed = [s["slug"] for s in visitor.get("/api/shops").get_json()]
    check("annuaire : boutique officielle d'abord", listed[0] == official["slug"])
    admin.put(f"/api/admin/shops/{shop['id']}", json={"status": "suspended", "status_note": "Photos trompeuses"})
    check("boutique suspendue cachée", visitor.get("/api/shops/chez-awa-fils").status_code == 404)
    check("vendeur suspendu bloqué", seller.post("/api/my/products", json={"name": "x"}).status_code == 403)
    users = admin.get("/api/admin/users?search=077112233").get_json()
    check("recherche de compte par numéro", len(users) == 1 and users[0]["name"] == "Awa")
    admin.put(f"/api/admin/users/{users[0]['id']}", json={"new_password": "nouveau1"})
    check("mot de passe réinitialisé par l'admin",
          visitor.post("/api/auth/login", json={"phone": "077112233", "password": "nouveau1"}).status_code == 200)
    admin.put(f"/api/admin/users/{users[0]['id']}", json={"active": False})
    check("compte bloqué déconnecté", seller.get("/api/auth/me").get_json()["user"] is None)
    spam = app.test_client()
    codes = [spam.post("/api/auth/login", json={"phone": "066554433", "password": f"x{i}"}).status_code
             for i in range(9)]
    check("trop d'essais de connexion bloqués", codes[-1] == 429, codes)


try:
    run()
    print(f"\n{passed} vérifications réussies")
finally:
    with app.app_context():
        db.engine.dispose()  # libère le fichier SQLite avant de supprimer le dossier
    shutil.rmtree(TMP, ignore_errors=True)
