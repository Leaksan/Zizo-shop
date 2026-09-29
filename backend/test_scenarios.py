"""Scénarios de bout en bout du hub : comptes, boutiques, validation par l'admin, visibilité.

À lancer depuis la racine du projet, avant de pousser :
    .venv\\Scripts\\python backend\\test_scenarios.py
Travaille sur une base temporaire neuve (données de démo) : la vraie base n'est jamais touchée.
"""
import os
import shutil
import sys
import tempfile
from datetime import timedelta

TMP = tempfile.mkdtemp(prefix="241shop-tests-")
os.environ["SHOP_DB"] = os.path.join(TMP, "test.db")
os.environ["UPLOAD_DIR"] = os.path.join(TMP, "uploads")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import seed  # noqa: E402  (crée l'app sur la base temporaire)
from app import app  # noqa: E402
from models import Post, db  # noqa: E402

passed = 0


def check(label, cond, detail=""):
    global passed
    print(("OK   " if cond else "ÉCHEC"), label, "" if cond else detail)
    if not cond:
        raise SystemExit(1)
    passed += 1


def new_admin():
    admin = app.test_client()
    admin.post("/api/admin/login", json={"password": "admin123"})
    return admin


def open_shop(phone, name, admin=None):
    """Un vendeur inscrit avec sa boutique (validée si un admin est fourni)."""
    client = app.test_client()
    client.post("/api/auth/register", json={"name": f"Vendeur {name}", "phone": phone, "password": "secret1"})
    shop = client.post("/api/my/shop", json={"name": name}).get_json()
    if admin:
        admin.put(f"/api/admin/shops/{shop['id']}", json={"status": "active"})
    return client, shop


def new_product(client, name, price=10000, stock=5, api="/api/my/products", **extra):
    r = client.post(api, json={"name": name, "variants": [{"name": "Standard", "price": price, "stock": stock}], **extra})
    return r.get_json()


def run():
    seed.run()
    phase1_accounts_and_shops()
    phase2_feed()
    login_rate_limit()


def phase1_accounts_and_shops():
    seller, visitor, fan = (app.test_client() for _ in range(3))
    admin = new_admin()

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


def phase2_feed():
    admin = new_admin()
    visitor, fan = app.test_client(), app.test_client()
    seller, shop = open_shop("077 22 33 44", "Mode Libreville", admin)

    # --- Nouveautés automatiques, regroupées ---
    a = new_product(seller, "Robe pagne")
    b = new_product(seller, "Chemise wax")
    posts = visitor.get("/api/feed").get_json()["posts"]
    mine = [p for p in posts if p["shop"]["slug"] == shop["slug"]]
    check("nouveaux produits regroupés en une publication", len(mine) == 1 and mine[0]["kind"] == "new_product")
    check("les deux produits dans la publication", {p["name"] for p in mine[0]["products"]} == {"Robe pagne", "Chemise wax"})

    # --- Publication du vendeur ---
    r = seller.post("/api/my/posts", json={
        "text": "Arrivage du jour !", "product_ids": [a["id"]],
        "images": ["/uploads/photo.jpg", "https://pistage.example/pixel.png"],
    })
    check("publication créée", r.status_code == 201, r.get_json())
    check("seules les photos de la plateforme sont gardées", r.get_json()["images"] == ["/uploads/photo.jpg"])
    check("produit d'une autre boutique refusé",
          seller.post("/api/my/posts", json={"text": "x", "product_ids": [1]}).status_code == 400)
    check("publication vide refusée", seller.post("/api/my/posts", json={"text": "  "}).status_code == 400)
    posts = visitor.get("/api/feed").get_json()["posts"]
    check("la publication est en tête du fil", posts[0]["text"] == "Arrivage du jour !")

    # --- Promo automatique ---
    seller.put(f"/api/my/products/{b['id']}", json={
        "variants": [{"id": b["variants"][0]["id"], "name": "Standard", "price": 8000, "old_price": 10000, "stock": 5}],
    })
    kinds = [p["kind"] for p in visitor.get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"]]
    check("promo annoncée automatiquement", "promo" in kinds, kinds)

    # --- Boutiques suivies en priorité ---
    official = next(s for s in visitor.get("/api/shops").get_json() if s["official"])
    admin_product = new_product(admin, "Produit officiel", api="/api/admin/products")
    with app.app_context():
        # La publication officielle date d'hier : seul l'abonnement peut la faire passer devant
        old = Post.query.filter_by(shop_id=official["id"]).order_by(Post.id.desc()).first()
        old.created_at -= timedelta(hours=24)
        db.session.commit()
    check("publication officielle créée", admin_product["shop"]["official"])
    check("abonnements : compte requis", visitor.get("/api/feed?tab=following").status_code == 401)
    fan.post("/api/auth/register", json={"name": "Fan", "phone": "066 77 88 99", "password": "secret1"})
    fan.post(f"/api/shops/{official['slug']}/follow")
    first_for_fan = fan.get("/api/feed").get_json()["posts"][0]["shop"]["slug"]
    first_for_visitor = visitor.get("/api/feed").get_json()["posts"][0]["shop"]["slug"]
    check("boutique suivie remontée dans le fil", first_for_fan == official["slug"], first_for_fan)
    check("fil anonyme : le plus récent d'abord", first_for_visitor == shop["slug"], first_for_visitor)
    following = fan.get("/api/feed?tab=following").get_json()["posts"]
    check("onglet abonnements : seulement les boutiques suivies",
          following and all(p["shop"]["slug"] == official["slug"] for p in following))

    # --- Produit retiré, boutique en attente, suppression ---
    seller.put(f"/api/my/products/{a['id']}", json={"active": False})
    grouped = next(p for p in visitor.get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"] if p["kind"] == "new_product")
    check("produit masqué retiré de la publication", [p["name"] for p in grouped["products"]] == ["Chemise wax"])
    pending_seller, pending_shop = open_shop("077 55 66 77", "Pas encore validée")
    new_product(pending_seller, "Produit caché")
    slugs = {p["shop"]["slug"] for p in visitor.get("/api/feed").get_json()["posts"]}
    check("boutique en attente absente du fil", pending_shop["slug"] not in slugs)
    my_posts = seller.get("/api/my/posts").get_json()
    check("le vendeur voit ses publications", len(my_posts) >= 3)
    check("impossible de supprimer la publication d'un autre",
          pending_seller.delete(f"/api/my/posts/{my_posts[0]['id']}").status_code == 404)
    check("suppression de sa publication", seller.delete(f"/api/my/posts/{my_posts[0]['id']}").status_code == 200)


def login_rate_limit():
    # En dernier : bloque l'adresse IP de test pendant un quart d'heure
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
