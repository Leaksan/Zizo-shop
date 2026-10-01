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
# Jamais de message dans le vrai groupe WhatsApp, même si le pont tourne sur ce PC
os.environ["WHATSAPP_BRIDGE_URL"] = "http://127.0.0.1:9/notify"
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
    phase2_posts()
    phase3_orders()
    phase4_notifications_reviews_reports()
    admin_section()
    cities_port_gentil()
    login_rate_limit()


def place_order(client, items, method="delivery", **extra):
    return client.post("/api/orders", json={
        "customer_name": "Cliente Test", "customer_phone": "066 12 34 56",
        "customer_address": "Carrefour Léon Mba", "zone": "Centre-ville",
        "delivery_method": method, "payment_method": "livraison",
        "items": [{"variant_id": v, "quantity": q} for v, q in items], **extra,
    })


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


def phase2_posts():
    admin = new_admin()
    visitor, fan = app.test_client(), app.test_client()
    seller, shop = open_shop("077 22 33 44", "Mode Libreville", admin)
    product = new_product(seller, "Robe pagne")
    check("plus de nouveautés automatiques",
          visitor.get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"] == [])
    check("plus de fil d'actu", visitor.get("/api/feed").status_code == 404)

    # --- Publication du vendeur, sur la page de sa boutique ---
    r = seller.post("/api/my/posts", json={
        "text": "Arrivage du jour !", "product_ids": [product["id"]],
        "images": ["/uploads/photo.jpg", "https://pistage.example/pixel.png"],
    })
    check("publication créée", r.status_code == 201, r.get_json())
    check("seules les photos de la plateforme sont gardées", r.get_json()["images"] == ["/uploads/photo.jpg"])
    check("produit d'une autre boutique refusé",
          seller.post("/api/my/posts", json={"text": "x", "product_ids": [1]}).status_code == 400)
    check("publication vide refusée", seller.post("/api/my/posts", json={"text": "  "}).status_code == 400)
    posts = visitor.get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"]
    check("publication sur la page de la boutique", [p["text"] for p in posts] == ["Arrivage du jour !"], posts)

    # --- Boutiques suivies ---
    fan.post("/api/auth/register", json={"name": "Fan", "phone": "066 77 88 99", "password": "secret1"})
    fan.post(f"/api/shops/{shop['slug']}/follow")
    check("abonnement indiqué sur les publications",
          fan.get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"][0]["following"])
    check("boutique suivie dans le compte", [s["slug"] for s in fan.get("/api/me/follows").get_json()] == [shop["slug"]])

    # --- Produit retiré, boutique en attente, suppression ---
    seller.put(f"/api/my/products/{product['id']}", json={"active": False})
    post = visitor.get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"][0]
    check("produit masqué retiré de la publication", post["products"] == [], post)
    pending_seller, pending_shop = open_shop("077 55 66 77", "Pas encore validée")
    check("boutique en attente : publications invisibles",
          visitor.get(f"/api/shops/{pending_shop['slug']}/posts").status_code == 404)
    my_posts = seller.get("/api/my/posts").get_json()
    check("le vendeur voit ses publications", len(my_posts) == 1, my_posts)
    check("impossible de supprimer la publication d'un autre",
          pending_seller.delete(f"/api/my/posts/{my_posts[0]['id']}").status_code == 404)
    check("suppression de sa publication", seller.delete(f"/api/my/posts/{my_posts[0]['id']}").status_code == 200)


def phase3_orders():
    admin = new_admin()
    customer = app.test_client()
    seller, shop = open_shop("077 33 44 55", "Épicerie Awa", admin)
    other_seller, other_shop = open_shop("077 44 55 66", "Autre boutique", admin)
    mine = new_product(seller, "Huile de palme", price=10000, stock=5)
    official = next(p for p in customer.get("/api/products").get_json() if p["shop"]["official"] and p["total_stock"] > 0)
    official_variant = next(v for v in official["variants"] if v["stock"] > 0)

    # --- Un panier, une commande par boutique ---
    r = place_order(customer, [(mine["variants"][0]["id"], 2), (official_variant["id"], 1)])
    check("commande passée", r.status_code == 201, r.get_json())
    orders = r.get_json()["orders"]
    check("une commande par boutique", len(orders) == 2 and len({o["reference"] for o in orders}) == 2)
    seller_order = next(o for o in orders if o["shop"]["slug"] == shop["slug"])
    official_order = next(o for o in orders if o["shop"]["official"])
    check("sous-total de la commande vendeur", seller_order["subtotal"] == 20000)
    check("frais de livraison par commande", seller_order["delivery_fee"] > 0 and official_order["delivery_fee"] > 0)
    check("commande vendeur pas encore prête", seller_order["ready_at"] is None)
    check("commande officielle prête tout de suite", official_order["ready_at"] is not None)
    check("suivi public avec la boutique",
          customer.get(f"/api/orders/track/{seller_order['reference']}").get_json()["shop"]["slug"] == shop["slug"])

    # --- Codes promo de la plateforme : boutique officielle seulement ---
    r = place_order(customer, [(mine["variants"][0]["id"], 1)], promo_code="BIENVENUE10")
    check("code promo refusé sans produit officiel", r.status_code == 400, r.get_json())
    r = place_order(customer, [(mine["variants"][0]["id"], 1), (official_variant["id"], 1)], promo_code="BIENVENUE10")
    promo_orders = r.get_json()["orders"]
    check("remise seulement sur la commande officielle",
          all((o["discount"] > 0) == o["shop"]["official"] for o in promo_orders), promo_orders)

    # --- Le vendeur voit et prépare ses commandes ---
    listed = seller.get("/api/my/orders").get_json()
    check("le vendeur voit ses commandes", {o["reference"] for o in listed} >= {seller_order["reference"]})
    check("jamais le code de livraison pour le vendeur", all("delivery_code" not in o for o in listed))
    seen = next(o for o in listed if o["reference"] == seller_order["reference"])
    check("le vendeur voit l'adresse du client (Google Maps)", seen["customer_address"] == "Carrefour Léon Mba"
          and "latitude" in seen)
    check("pas les commandes des autres boutiques", all(o["shop"]["slug"] == shop["slug"] for o in listed))
    to_prepare = seller.get("/api/my/shop").get_json()["orders_to_prepare"]
    check("compteur des commandes à préparer", to_prepare == 2, to_prepare)
    check("impossible de gérer la commande d'une autre boutique",
          other_seller.put(f"/api/my/orders/{seller_order['id']}", json={"action": "ready"}).status_code == 404)

    # --- Livreur : seulement les colis prêts, avec le point de retrait ---
    courier = app.test_client()
    courier.post("/api/courier/login", json={"phone": "0698765432", "password": "livre123"})
    available = {o["reference"] for o in courier.get("/api/courier/deliveries").get_json()["available"]}
    check("colis non préparé invisible pour les livreurs", seller_order["reference"] not in available)
    check("colis officiel proposé aux livreurs", official_order["reference"] in available)
    check("course impossible avant préparation",
          courier.post(f"/api/courier/deliveries/{seller_order['id']}/accept").status_code == 400)
    seller.put(f"/api/my/orders/{seller_order['id']}", json={"action": "ready"})
    check("compteur mis à jour après préparation",
          seller.get("/api/my/shop").get_json()["orders_to_prepare"] == to_prepare - 1)
    deliveries = courier.get("/api/courier/deliveries").get_json()["available"]
    ready = next((o for o in deliveries if o["reference"] == seller_order["reference"]), None)
    check("colis prêt proposé aux livreurs", ready is not None)
    check("le livreur sait où récupérer le colis", ready and ready["pickup"]["name"] == "Épicerie Awa")
    check("course acceptée", courier.post(f"/api/courier/deliveries/{seller_order['id']}/accept").status_code == 200)
    check("plus d'annulation une fois en livraison",
          seller.put(f"/api/my/orders/{seller_order['id']}", json={"action": "cancel"}).status_code == 400)

    # --- Refus d'une commande : stock remis ---
    before = seller.get("/api/my/products").get_json()[0]["total_stock"]
    extra = place_order(customer, [(mine["variants"][0]["id"], 1)]).get_json()["orders"][0]
    seller.put(f"/api/my/orders/{extra['id']}", json={"action": "cancel"})
    after = seller.get("/api/my/products").get_json()[0]["total_stock"]
    check("commande refusée, stock remis", after == before, (before, after))

    # --- Retrait en boutique chez le vendeur ---
    seller.put("/api/my/shop", json={"address": "Marché Mont-Bouët, allée 3"})
    pickup = place_order(customer, [(mine["variants"][0]["id"], 1)], method="pickup").get_json()["orders"][0]
    tracked = customer.get(f"/api/orders/track/{pickup['reference']}").get_json()
    check("retrait : le client voit l'adresse du vendeur", tracked["pickup_address"] == "Marché Mont-Bouët, allée 3")
    seller.put("/api/my/shop", json={"latitude": 0.4123, "longitude": 9.4567})
    tracked = customer.get(f"/api/orders/track/{pickup['reference']}").get_json()
    check("retrait : position de la boutique pour l'itinéraire",
          tracked["pickup_latitude"] == 0.4123 and tracked["pickup_longitude"] == 9.4567, tracked)
    check("adresse du vendeur absente de sa page publique",
          "address" not in customer.get(f"/api/shops/{shop['slug']}").get_json())
    check("retrait : pas de frais de livraison", pickup["delivery_fee"] == 0)
    check("retrait : pas encore récupérable",
          seller.put(f"/api/my/orders/{pickup['id']}", json={"action": "picked_up"}).status_code == 400)
    r = seller.put(f"/api/my/orders/{pickup['id']}", json={"action": "ready"})
    check("retrait : prête au comptoir", r.get_json()["status"] == "delivering")
    r = seller.put(f"/api/my/orders/{pickup['id']}", json={"action": "picked_up"})
    check("retrait : récupérée par le client", r.get_json()["status"] == "delivered")
    check("admin : commande marquée prête à la place du vendeur",
          admin.put(f"/api/admin/orders/{extra['id']}", json={"ready": True}).status_code == 200)


def texts(client):
    return [n["text"] for n in client.get("/api/me/notifications").get_json()["items"]]


def phase4_notifications_reviews_reports():
    admin = new_admin()
    seller, shop = open_shop("077 88 99 00", "Robes de Nzeng", admin)
    check("vendeur prévenu de la validation", any("est validée" in t for t in texts(seller)), texts(seller))
    r = seller.put("/api/my/shop", json={"logo_url": "/uploads/logo.jpg"})
    check("logo changé en un geste", r.status_code == 200 and r.get_json()["logo_url"] == "/uploads/logo.jpg", r.get_json())
    check("logo venant d'un autre site refusé",
          seller.put("/api/my/shop", json={"cover_url": "https://pistage.example/pixel.png"}).status_code == 400)
    check("compteur de notifications", seller.get("/api/me/notifications/count").get_json()["unread"] >= 1)
    check("notifications privées", app.test_client().get("/api/me/notifications").status_code == 401)
    product = new_product(seller, "Robe pagne", price=20000, stock=5)
    variant = product["variants"][0]["id"]

    # --- Commande passée connecté : liée au compte, vendeur prévenu ---
    buyer = app.test_client()
    buyer.post("/api/auth/register", json={"name": "Cliente Fidèle", "phone": "066 21 21 21", "password": "secret1"})
    order = place_order(buyer, [(variant, 1)]).get_json()["orders"][0]
    anonymous = place_order(app.test_client(), [(variant, 1)]).get_json()["orders"][0]
    mine = buyer.get("/api/me/orders").get_json()
    check("commande liée au compte", [o["reference"] for o in mine] == [order["reference"]], mine)
    check("pas de code de livraison dans la liste", "delivery_code" not in mine[0])
    check("vendeur prévenu de la nouvelle commande", any(order["reference"] in t for t in texts(seller)))
    check("commande sans compte aussi signalée au vendeur", any(anonymous["reference"] in t for t in texts(seller)))

    # --- Suivi : le client est prévenu, le vendeur aussi quand le livreur arrive ---
    seller.put(f"/api/my/orders/{order['id']}", json={"action": "ready"})
    courier = app.test_client()
    courier.post("/api/courier/login", json={"phone": "0698765432", "password": "livre123"})
    courier.post(f"/api/courier/deliveries/{order['id']}/accept")
    check("client prévenu : commande en route", any("en route" in t for t in texts(buyer)), texts(buyer))
    check("vendeur prévenu : le livreur arrive", any("vient chercher" in t for t in texts(seller)))
    code = buyer.get(f"/api/orders/track/{order['reference']}").get_json()["delivery_code"]
    courier.post(f"/api/courier/deliveries/{order['id']}/complete", json={"code": code})
    check("client prévenu : commande livrée", any("livrée" in t for t in texts(buyer)))
    pickup = place_order(buyer, [(variant, 1)], method="pickup").get_json()["orders"][0]
    seller.put(f"/api/my/orders/{pickup['id']}", json={"action": "ready"})
    check("client prévenu : prête à retirer", any("retirez-la chez Robes de Nzeng" in t for t in texts(buyer)))
    refused = place_order(buyer, [(variant, 1)]).get_json()["orders"][0]
    seller.put(f"/api/my/orders/{refused['id']}", json={"action": "cancel"})
    check("client prévenu : commande annulée", any(refused["reference"] in t and "annulée" in t for t in texts(buyer)))
    check("le vendeur n'est pas prévenu de sa propre annulation",
          not any(refused["reference"] in t and "annulée" in t for t in texts(seller)))
    buyer.post("/api/me/notifications/read")
    check("notifications lues", buyer.get("/api/me/notifications/count").get_json()["unread"] == 0)

    # --- Avis : note de la boutique, vendeur prévenu ---
    r = buyer.post(f"/api/orders/{order['reference']}/reviews",
                   data={"product_id": product["id"], "rating": "4", "comment": "Belle robe"})
    check("avis laissé après livraison", r.status_code == 201, r.get_json())
    page = app.test_client().get(f"/api/shops/{shop['slug']}").get_json()
    check("note de la boutique", page["rating"] == 4.0 and page["reviews_count"] == 1, page)
    reviews = app.test_client().get(f"/api/shops/{shop['slug']}/reviews").get_json()
    check("avis listés avec leur produit", reviews["reviews"][0]["product"]["name"] == "Robe pagne", reviews)
    listed = {s["slug"]: s for s in app.test_client().get("/api/shops").get_json()}
    check("note dans l'annuaire", listed[shop["slug"]]["rating"] == 4.0)
    check("pas de note sans avis", listed["autre-boutique"]["rating"] is None)
    check("vendeur prévenu du nouvel avis", any("Nouvel avis 4/5" in t for t in texts(seller)))

    # --- Tableau de bord du vendeur ---
    stats = seller.get("/api/my/stats").get_json()
    check("stats : commandes et annulations", stats["orders"] == 3 and stats["cancelled"] == 1, stats)
    check("stats : ventes livrées", stats["sales"] == 20000 and stats["sales_pending"] == 40000, stats)
    check("stats : commandes du jour", stats["days"][-1]["orders"] == 3 and len(stats["days"]) == 14)
    check("stats : meilleure vente", stats["top_products"][0] == {"name": "Robe pagne", "quantity": 3, "amount": 60000})
    check("stats : stock bas", stats["low_stock"][0]["stock"] == 2, stats["low_stock"])
    check("stats réservées aux vendeurs", buyer.get("/api/my/stats").status_code == 403)

    # --- Boutique refusée : le vendeur reçoit le motif ---
    other, other_shop = open_shop("077 90 90 90", "Boutique douteuse")
    admin.put(f"/api/admin/shops/{other_shop['id']}", json={"status": "rejected", "status_note": "Photos floues"})
    check("vendeur prévenu du refus avec le motif", any("Photos floues" in t for t in texts(other)))

    # --- Signalements ---
    post = seller.post("/api/my/posts", json={"text": "Arrivage de robes !"}).get_json()
    report = {"target": "post", "target_id": post["id"], "reason": "arnaque", "details": "Prix trop beau"}
    check("signaler demande un compte", app.test_client().post("/api/reports", json=report).status_code == 401)
    check("motif inconnu refusé", buyer.post("/api/reports", json={**report, "reason": "x"}).status_code == 400)
    check("publication signalée", buyer.post("/api/reports", json=report).status_code == 201)
    check("pas de doublon", buyer.post("/api/reports", json=report).status_code == 200)
    check("on ne signale pas sa propre boutique",
          seller.post("/api/reports", json={"target": "shop", "target_id": shop["id"], "reason": "autre"}).status_code == 400)
    witness = app.test_client()
    witness.post("/api/auth/register", json={"name": "Témoin", "phone": "066 31 31 31", "password": "secret1"})
    witness.post("/api/reports", json={**report, "reason": "trompeur"})
    check("compteur admin des signalements", admin.get("/api/admin/stats").get_json()["open_reports"] == 1)
    groups = admin.get("/api/admin/reports").get_json()
    check("signalements regroupés par contenu", len(groups) == 1 and len(groups[0]["reports"]) == 2, groups)
    check("admin : aperçu de la publication", groups[0]["post"]["text"] == "Arrivage de robes !")
    r = admin.put("/api/admin/reports", json={"target": "post", "target_id": post["id"], "action": "hide_post"})
    check("publication masquée, signalements traités", r.get_json()["resolved"] == 2, r.get_json())
    shown = {p["id"] for p in app.test_client().get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"]}
    check("publication masquée invisible", post["id"] not in shown)
    check("vendeur prévenu de la modération", any("masquée par la modération" in t for t in texts(seller)))
    check("plus rien à traiter", admin.get("/api/admin/stats").get_json()["open_reports"] == 0)
    check("signalements traités consultables", len(admin.get("/api/admin/reports?status=done").get_json()) == 1)
    admin.put("/api/admin/reports", json={"target": "post", "target_id": post["id"], "action": "restore_post"})
    shown = {p["id"] for p in app.test_client().get(f"/api/shops/{shop['slug']}/posts").get_json()["posts"]}
    check("publication rétablie", post["id"] in shown)
    witness.post("/api/reports", json={"target": "shop", "target_id": shop["id"], "reason": "contrefacon"})
    admin.put("/api/admin/reports", json={"target": "shop", "target_id": shop["id"], "action": "suspend_shop",
                                          "note": "Contrefaçons"})
    check("boutique suspendue invisible", app.test_client().get(f"/api/shops/{shop['slug']}").status_code == 404)
    check("vendeur prévenu de la suspension", any("suspendue : Contrefaçons" in t for t in texts(seller)))
    official = next(s for s in app.test_client().get("/api/shops").get_json() if s["official"])
    witness.post("/api/reports", json={"target": "shop", "target_id": official["id"], "reason": "autre"})
    check("boutique officielle jamais suspendue",
          admin.put("/api/admin/reports", json={"target": "shop", "target_id": official["id"],
                                                "action": "suspend_shop"}).status_code == 400)
    r = admin.put("/api/admin/reports", json={"target": "shop", "target_id": official["id"], "action": "dismiss"})
    check("signalement classé sans suite", r.get_json()["resolved"] == 1)


def cities_port_gentil():
    admin = new_admin()
    public = app.test_client()
    settings = public.get("/api/settings/public").get_json()
    check("quartiers de Port-Gentil livrés", "Port-Gentil · Balise" in settings["zones"], settings["zones"])
    check("frais d'envoi entre villes publics", settings["intercity_fee"] == 3000 and settings["intercity_delay"])

    def seen(courier):
        return {o["reference"] for o in courier.get("/api/courier/deliveries").get_json()["available"]}

    # --- Boutique de Libreville, client de Port-Gentil : le colis voyage ---
    lbv_seller, _ = open_shop("077 30 30 30", "Boutique de Glass", admin)
    lbv_seller.put("/api/my/shop", json={"zone": "Glass"})
    product = new_product(lbv_seller, "Sac à main", price=10000, stock=5)
    check("ville de la boutique", product["shop"]["city"] == "Libreville", product["shop"])
    order = place_order(public, [(product["variants"][0]["id"], 1)], zone="Port-Gentil · Balise").get_json()["orders"][0]
    check("commande envoyée entre villes",
          order["intercity"] and order["from_city"] == "Libreville" and order["to_city"] == "Port-Gentil", order)
    check("frais d'envoi ajoutés à la livraison", order["delivery_fee"] == 2000 + 3000, order["delivery_fee"])
    lbv_seller.put(f"/api/my/orders/{order['id']}", json={"action": "ready"})

    lbv_courier = app.test_client()
    lbv_courier.post("/api/courier/login", json={"phone": "0698765432", "password": "livre123"})
    pg_courier = app.test_client()
    pg_courier.post("/api/courier/register", json={
        "name": "Livreur PG", "phone": "066404040", "password": "secret1", "vehicle": "Moto",
        "zone": "Port-Gentil · Balise"})
    pg_id = next(c["id"] for c in admin.get("/api/admin/couriers").get_json() if c["phone"] == "066404040")
    admin.put(f"/api/admin/couriers/{pg_id}", json={"verified": True})

    check("livreur de Libreville : pas les courses de Port-Gentil", order["reference"] not in seen(lbv_courier))
    check("livreur de Port-Gentil : pas avant l'arrivée du colis", order["reference"] not in seen(pg_courier))
    check("course refusée avant l'arrivée",
          pg_courier.post(f"/api/courier/deliveries/{order['id']}/accept").status_code == 400)
    check("colis à envoyer au tableau de bord", admin.get("/api/admin/stats").get_json()["to_ship"] >= 1)
    r = admin.put(f"/api/admin/orders/{order['id']}", json={"arrived": True})
    check("colis arrivé à Port-Gentil", r.status_code == 200 and r.get_json()["arrived_at"], r.get_json())
    course = next((o for o in pg_courier.get("/api/courier/deliveries").get_json()["available"]
                   if o["reference"] == order["reference"]), None)
    check("livreur de Port-Gentil : course visible une fois arrivée", course is not None)
    check("récupération au point relais de la ville", course and course["pickup"]["name"] == "Point relais Port-Gentil")
    check("livreur de Libreville : toujours pas", order["reference"] not in seen(lbv_courier))
    check("le livreur de Libreville ne peut pas la prendre",
          lbv_courier.post(f"/api/courier/deliveries/{order['id']}/accept").status_code == 400)
    check("course acceptée à Port-Gentil",
          pg_courier.post(f"/api/courier/deliveries/{order['id']}/accept").status_code == 200)

    # --- Boutique de Port-Gentil, client de Port-Gentil : livraison sur place ---
    pg_seller, _ = open_shop("077 50 50 50", "Boutique de Salsa", admin)
    pg_seller.put("/api/my/shop", json={"zone": "Port-Gentil · Salsa"})
    pg_product = new_product(pg_seller, "Pagne de Port-Gentil", price=12000, stock=3)
    local = place_order(public, [(pg_product["variants"][0]["id"], 1)], zone="Port-Gentil · Matanda").get_json()["orders"][0]
    check("livraison sur place à Port-Gentil, sans frais d'envoi",
          not local["intercity"] and local["delivery_fee"] == 2000, local)
    pg_seller.put(f"/api/my/orders/{local['id']}", json={"action": "ready"})
    check("course locale visible du livreur de Port-Gentil dès qu'elle est prête", local["reference"] in seen(pg_courier))
    check("pas d'« arrivée » pour une course locale",
          admin.put(f"/api/admin/orders/{local['id']}", json={"arrived": True}).status_code == 400)


def admin_section():
    admin = new_admin()
    seller, shop = open_shop("077 12 12 12", "Atelier Mbolo", admin)
    product = new_product(seller, "Panier tressé", price=8000, stock=6)
    customer = app.test_client()
    order = place_order(customer, [(product["variants"][0]["id"], 1)]).get_json()["orders"][0]

    # --- Tableau de bord : ce qui attend une action, l'activité du mois ---
    stats = admin.get("/api/admin/stats").get_json()
    check("tableau de bord : commandes à préparer", stats["preparing"] >= 1, stats)
    check("tableau de bord : 14 jours d'activité", len(stats["days"]) == 14 and stats["days"][-1]["orders"] >= 1)
    check("tableau de bord : livreurs et demandes à traiter",
          "couriers_to_verify" in stats and "stock_requests" in stats and "waiting_courier" in stats)
    check("tableau de bord réservé à l'admin", customer.get("/api/admin/stats").status_code in (401, 403))

    # --- Commandes : recherche et filtre par boutique ---
    found = admin.get(f"/api/admin/orders?search={order['reference'].lower()}").get_json()
    check("recherche par référence", [o["reference"] for o in found] == [order["reference"]], found)
    found = admin.get("/api/admin/orders?search=0661 23456").get_json()
    check("recherche par téléphone, espaces ignorés", order["reference"] in {o["reference"] for o in found})
    found = admin.get(f"/api/admin/orders?shop={shop['id']}").get_json()
    check("filtre par boutique", found and all(o["shop"]["slug"] == shop["slug"] for o in found))

    # --- Paramètres ---
    check("devise autre que XAF refusée", admin.put("/api/admin/settings", json={"currency": "XOF"}).status_code == 400)
    admin.put("/api/admin/settings", json={"pickup_address": "Carrefour Rio, Libreville"})
    official = next(s for s in admin.get("/api/admin/shops").get_json() if s["official"])
    check("adresse de retrait = adresse de la boutique officielle", official["address"] == "Carrefour Rio, Libreville")
    admin.put("/api/admin/settings", json={"sounds_off": ["panier", "inconnu", "vente"]})
    public = app.test_client().get("/api/settings/public").get_json()
    check("sons coupés par l'admin, clés inconnues ignorées", public["sounds_off"] == ["panier", "vente"], public["sounds_off"])
    admin.put("/api/admin/settings", json={"sounds_off": []})

    # --- Mot de passe admin : 8 caractères minimum, enregistré chiffré ---
    check("mot de passe admin trop court refusé",
          admin.put("/api/admin/settings", json={"new_password": "court"}).status_code == 400)
    admin.put("/api/admin/settings", json={"new_password": "nouveau-mdp-2026"})
    with app.app_context():
        from models import get_setting
        stored = get_setting("admin_password")
    check("mot de passe admin jamais en clair", stored.startswith(("pbkdf2:", "scrypt:")) and "nouveau" not in stored)
    check("connexion avec le nouveau mot de passe",
          app.test_client().post("/api/admin/login", json={"password": "nouveau-mdp-2026"}).status_code == 200)
    check("ancien mot de passe refusé",
          app.test_client().post("/api/admin/login", json={"password": "admin123"}).status_code == 401)
    admin.put("/api/admin/settings", json={"new_password": "admin123"})  # pour les autres scénarios


def login_rate_limit():
    # En dernier : bloque l'adresse IP de test pendant un quart d'heure
    spam = app.test_client()
    codes = [spam.post("/api/auth/login", json={"phone": "066554433", "password": f"x{i}"}).status_code
             for i in range(9)]
    check("trop d'essais de connexion bloqués", codes[-1] == 429, codes)
    codes = [spam.post("/api/admin/login", json={"password": f"x{i}"}).status_code for i in range(9)]
    check("trop d'essais de connexion admin bloqués", codes[-1] == 429, codes)


try:
    run()
    print(f"\n{passed} vérifications réussies")
finally:
    with app.app_context():
        db.engine.dispose()  # libère le fichier SQLite avant de supprimer le dossier
    shutil.rmtree(TMP, ignore_errors=True)
