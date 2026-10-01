import hmac
import html
import os
import re
import random
import string
import threading
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from functools import wraps
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json as _json_std

from flask import Flask, jsonify, request, send_from_directory, session
from flask_compress import Compress
from flask_cors import CORS
from PIL import Image
from sqlalchemy import update as sa_update
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

from models import (
    GABON_TZ,
    MAX_POST_IMAGES,
    REPORT_REASONS,
    REPORT_TARGETS,
    SHOP_STATUSES,
    SOUND_KEYS,
    Category,
    DeliveryPerson,
    Follow,
    Notification,
    Order,
    OrderItem,
    Post,
    Product,
    PromoCode,
    Report,
    Review,
    Setting,
    Shop,
    StockRequest,
    User,
    Variant,
    db,
    normalize_phone,
    slugify,
    get_number,
    get_setting,
    get_zone_fees,
    zone_delivery_fee,
    get_zones,
    is_password_hash,
    set_setting,
    DEFAULT_SETTINGS,
    LIBREVILLE_ZONES,
)

ORDER_STATUSES = ["pending", "delivering", "delivered", "cancelled"]
PROMO_TYPES = ["percent", "freeship"]
# "carte" reste lisible sur les anciennes commandes, mais aucun paiement en ligne
# n'est branché : on n'accepte plus que le paiement à la livraison / au retrait.
PAYMENT_METHODS = ["livraison"]
DELIVERY_METHODS = ["delivery", "pickup"]

BRIDGE_URL = os.environ.get("WHATSAPP_BRIDGE_URL", "http://localhost:3100/notify")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "ma-boutique-secret")


def _fmt_money(n):
    return f"{int(round(n)):,}".replace(",", " ") + " FCFA"


def notify_whatsapp_order(order):
    def _send():
        try:
            lines = [
                f"🛒 *NOUVELLE COMMANDE {order.reference}*",
                f"🏪 Boutique : {order.shop.name}" if order.shop else "",
                f"👤 {order.customer_name} — {order.customer_phone}",
            ]
            lines = [line for line in lines if line]
            if order.delivery_method == "pickup":
                lines.append("🛍️ *RETRAIT EN BOUTIQUE*")
            else:
                lines.append(f"📍 {order.customer_address} ({order.zone})")
                if order.landmark:
                    lines.append(f"🧭 Repère : {order.landmark}")
                if order.latitude is not None and order.longitude is not None:
                    lines.append(
                        f"🗺️ https://www.google.com/maps/search/?api=1&query={order.latitude},{order.longitude}"
                    )
            lines.append(
                "🧾 "
                + " · ".join(f"{i.product_name} ({i.variant_name}) ×{i.quantity}" for i in order.items)
            )
            if order.discount:
                lines.append(f"🎟️ Remise ({order.promo_code}) : -{_fmt_money(order.discount)}")
            if order.delivery_method == "delivery":
                lines.append(
                    f"🚚 Livraison : {'offerte' if not order.delivery_fee else _fmt_money(order.delivery_fee)}"
                )
            lines.append(f"💰 *Total : {_fmt_money(order.total)}*")
            if order.payment_method == "livraison":
                lines.append(
                    "💵 À payer au retrait"
                    if order.delivery_method == "pickup"
                    else "💵 À payer à la livraison"
                )
            else:
                lines.append("💳 Carte bancaire — NON encaissé, à faire payer")
            if order.note:
                lines.append(f"📝 Note : {order.note}")
            payload = _json_std.dumps({"token": BRIDGE_TOKEN, "text": "\n".join(lines)}).encode()
            req = Request(BRIDGE_URL, data=payload, headers={"Content-Type": "application/json"})
            urlopen(req, timeout=5)
        except Exception:
            pass

    threading.Thread(target=_send, daemon=True).start()


def create_app():
    app = Flask(__name__)
    # Derrière le proxy HTTPS de Render : URL publiques correctes (https://…)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    basedir = os.path.abspath(os.path.dirname(__file__))
    # SHOP_DB / UPLOAD_DIR permettent de placer les données sur un disque
    # persistant (ex: Render) au lieu de l'image éphémère du conteneur.
    db_path = os.environ.get("SHOP_DB", os.path.join(basedir, "shop.db"))
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + db_path
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    # Plusieurs threads gunicorn : attendre un verrou SQLite plutôt qu'échouer
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"connect_args": {"timeout": 15}}
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024
    upload_dir = os.environ.get("UPLOAD_DIR", os.path.join(basedir, "uploads"))
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    os.makedirs(upload_dir, exist_ok=True)
    # En production le frontend est servi par Flask (même origine) : CORS n'est
    # utile qu'en développement. CORS_ORIGINS = liste séparée par des virgules.
    cors_origins = [
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if o.strip()
    ]
    CORS(app, supports_credentials=True, origins=cors_origins)
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE") == "1"
    # Comptes clients / vendeurs : rester connecté sur son téléphone
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

    db.init_app(app)
    # Réponses compressées (JS, CSS, JSON…) : ~3x moins de données mobiles
    app.config["COMPRESS_MIMETYPES"] = [
        "text/html",
        "text/css",
        "text/javascript",
        "application/javascript",
        "application/json",
        "application/manifest+json",
        "image/svg+xml",
    ]
    Compress(app)

    @app.after_request
    def cache_headers(response):
        path = request.path
        if path.startswith("/assets/") or path.startswith("/uploads/"):
            # Noms de fichiers uniques (hash Vite / uuid) : jamais modifiés
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif path == "/sw.js":
            response.headers["Cache-Control"] = "no-cache"
        return response

    def admin_required(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not session.get("admin"):
                return jsonify({"error": "Non autorisé"}), 401
            return f(*args, **kwargs)

        return wrapper

    def courier_required(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            courier = db.session.get(DeliveryPerson, session.get("courier_id") or 0)
            if not courier:
                return jsonify({"error": "Non connecté"}), 401
            return f(courier, *args, **kwargs)

        return wrapper

    # ---------------- Comptes (clients et vendeurs) ----------------

    def current_user():
        user = db.session.get(User, session.get("user_id") or 0)
        return user if user and user.active else None

    def user_required(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Connectez-vous pour continuer"}), 401
            return f(user, *args, **kwargs)

        return wrapper

    def seller_required(f):
        """Vendeur connecté : reçoit (user, shop). La boutique peut être en attente de validation."""

        @wraps(f)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "Connectez-vous pour continuer"}), 401
            if not user.shop:
                return jsonify({"error": "Vous n'avez pas encore de boutique"}), 403
            if user.shop.status == "suspended":
                return jsonify({"error": "Boutique suspendue : contactez la plateforme"}), 403
            return f(user, user.shop, *args, **kwargs)

        return wrapper

    # Connexions ratées par numéro et par adresse IP : 8 essais max par quart d'heure
    LOGIN_FAILS = {}
    LOGIN_LOCK = threading.Lock()
    MAX_LOGIN_FAILS = 8
    LOGIN_WINDOW = 15 * 60

    def login_blocked(*keys):
        now = time.monotonic()
        with LOGIN_LOCK:
            for key in keys:
                recent = [t for t in LOGIN_FAILS.get(key, []) if now - t < LOGIN_WINDOW]
                LOGIN_FAILS[key] = recent
                if len(recent) >= MAX_LOGIN_FAILS:
                    return True
        return False

    def record_login_fail(*keys):
        now = time.monotonic()
        with LOGIN_LOCK:
            for key in keys:
                LOGIN_FAILS.setdefault(key, []).append(now)

    def unique_slug(name, exclude_id=None):
        base = slugify(name)
        slug, n = base, 2
        while True:
            other = Shop.query.filter_by(slug=slug).first()
            if not other or other.id == exclude_id:
                return slug
            slug, n = f"{base}-{n}", n + 1

    def public_products():
        """Produits visibles par le public : actifs, dans une boutique validée."""
        return Product.query.join(Shop, Product.shop_id == Shop.id).filter(
            Product.active.is_(True), Shop.status == "active"
        )

    def can_view_product(product):
        """Le public voit les produits des boutiques validées ; le vendeur et l'admin voient tout."""
        if not product:
            return False
        if session.get("admin"):
            return True
        user = current_user()
        if user and product.shop and product.shop.owner_id == user.id:
            return True
        return product.active and product.shop is not None and product.shop.status == "active"

    def utcnow():
        """Heure UTC sans fuseau, comme les dates relues depuis SQLite (comparaisons)."""
        return datetime.now(timezone.utc).replace(tzinfo=None)

    # Tentatives ratées de code de livraison, par commande (anti-devinette).
    CODE_FAILS = {}
    MAX_CODE_FAILS = 5

    def courier_order_dict(order):
        """Commande vue par un livreur : jamais le code de livraison ; où récupérer le colis."""
        data = order.to_dict()
        data.pop("delivery_code", None)
        shop = order.shop
        data["pickup"] = (
            {
                "name": shop.name,
                "address": shop.address or "",
                "zone": shop.zone or "",
                "whatsapp": shop.whatsapp or "",
                "latitude": shop.latitude,
                "longitude": shop.longitude,
            }
            if shop
            else None
        )
        return data

    # Ce que le vendeur n'a pas à connaître : le code confirme la remise par le livreur. Il voit
    # l'adresse et la position du client (à ouvrir dans Google Maps), comme le livreur.
    SELLER_HIDDEN = ("delivery_code", "customer_email", "courier_rating", "courier_comment")

    def seller_order_dict(order):
        """Commande vue par son vendeur."""
        data = order.to_dict()
        for key in SELLER_HIDDEN:
            data.pop(key, None)
        return data

    def restock(order):
        """Remet en stock les articles d'une commande annulée."""
        for item in order.items:
            if item.variant_id:
                db.session.execute(
                    sa_update(Variant)
                    .where(Variant.id == item.variant_id)
                    .values(stock=Variant.stock + item.quantity)
                )

    # ---------------- Notifications ----------------

    def notify(user_id, kind, text, link=""):
        """Notification pour un compte, enregistrée avec la transaction en cours."""
        if user_id:
            db.session.add(Notification(user_id=user_id, kind=kind, text=text[:300], link=link))

    def money(value):
        return f"{round(value or 0):,}".replace(",", " ") + " FCFA"

    def order_event(order, event, to_customer=True, to_seller=True, courier=None):
        """Avancée d'une commande : prévient le client (s'il avait un compte) et le vendeur,
        sauf celui qui vient d'agir."""
        ref = order.reference
        shop = order.shop
        shop_name = shop.name if shop else ""
        if to_customer and order.user_id:
            text = {
                "ready": f"Votre commande {ref} est prête : retirez-la chez {shop_name}.",
                "delivering": f"Votre commande {ref} ({shop_name}) est en route : le livreur arrive.",
                "delivered": f"Commande {ref} livrée. Donnez votre avis sur vos articles !",
                "cancelled": f"Votre commande {ref} ({shop_name}) a été annulée.",
            }.get(event)
            if text:
                notify(order.user_id, "order", text, f"/suivi?ref={ref}")
        if to_seller and shop and shop.owner_id:
            count = sum(i.quantity for i in order.items)
            amount = money(order.subtotal - (order.discount or 0))
            text = {
                "new": f"Nouvelle commande {ref} : {count} article{'s' if count > 1 else ''}, "
                f"{amount}. À préparer !",
                "delivering": f"{courier.name if courier else 'Un livreur'} vient chercher la "
                f"commande {ref}.",
                "delivered": f"Commande {ref} livrée au client.",
                "cancelled": f"Commande {ref} annulée par la plateforme.",
            }.get(event)
            if text:
                notify(shop.owner_id, "order", text, "/vendeur/commandes")

    SHOP_STATUS_NOTICES = {
        "active": "Bonne nouvelle : votre boutique {name} est validée, elle est visible de tous !",
        "rejected": "Votre boutique {name} n'a pas été validée{note}. Corrigez-la puis enregistrez : "
        "elle repassera en validation.",
        "suspended": "Votre boutique {name} est suspendue{note}. Contactez la plateforme.",
    }

    def shop_status_notice(shop):
        template = SHOP_STATUS_NOTICES.get(shop.status)
        if template and shop.owner_id:
            note = f" : {shop.status_note}" if shop.status_note else ""
            notify(shop.owner_id, "shop", template.format(name=shop.name, note=note), "/vendeur")

    def generate_reference():
        while True:
            ref = "CMD-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if not Order.query.filter_by(reference=ref).first():
                return ref

    # ---------------- Géocodage (Libreville) ----------------

    GEO_CACHE = {}
    GEO_CACHE_MAX = 500
    LBV_BBOX = "9.28,0.18,9.80,0.72"

    GEO_LOCK = threading.Lock()

    def _geo_cache(key, compute):
        with GEO_LOCK:
            if key in GEO_CACHE:
                return GEO_CACHE[key]
        value = compute()  # appel réseau hors du verrou
        with GEO_LOCK:
            while len(GEO_CACHE) >= GEO_CACHE_MAX:
                # Vider le plus ancien (les dict conservent l'ordre d'insertion)
                GEO_CACHE.pop(next(iter(GEO_CACHE)))
            GEO_CACHE[key] = value
        return value

    def _http_json(url):
        req = Request(url, headers={"User-Agent": "241Shop-Libreville/1.0"})
        with urlopen(req, timeout=6) as resp:
            return _json_std.loads(resp.read().decode("utf-8"))

    @app.get("/api/geocode/search")
    def geocode_search():
        q = (request.args.get("q") or "").strip()
        if len(q) < 2:
            return jsonify([])

        def compute():
            results = []
            try:
                params = urlencode(
                    {
                        "q": f"{q}, Libreville, Gabon",
                        "limit": 6,
                        "lat": 0.4162,
                        "lon": 9.4673,
                        "bbox": LBV_BBOX,
                    }
                )
                data = _http_json(f"https://photon.komoot.io/api/?{params}")
                for f in data.get("features", []):
                    props = f.get("properties", {})
                    coords = f.get("geometry", {}).get("coordinates", [None, None])
                    if coords[0] is None:
                        continue
                    seen = set()
                    parts = []
                    for p in [
                        props.get("name"),
                        props.get("district") or props.get("suburb"),
                        props.get("city"),
                    ]:
                        if p and p not in seen:
                            seen.add(p)
                            parts.append(p)
                    results.append(
                        {
                            "name": ", ".join(parts) or props.get("name") or q,
                            "lat": coords[1],
                            "lng": coords[0],
                            "zone": props.get("district") or props.get("suburb") or "",
                        }
                    )
            except Exception:
                results = []
            return results

        return jsonify(_geo_cache(q.lower(), compute))

    @app.get("/api/geocode/reverse")
    def geocode_reverse():
        try:
            lat = float(request.args.get("lat", ""))
            lng = float(request.args.get("lng", ""))
        except ValueError:
            return jsonify({"error": "Coordonnées invalides"}), 400

        def compute():
            try:
                data = _http_json(
                    "https://nominatim.openstreetmap.org/reverse?"
                    + urlencode({"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 16})
                )
                addr = data.get("address", {})
                zone = (
                    addr.get("suburb")
                    or addr.get("neighbourhood")
                    or addr.get("city_district")
                    or addr.get("quarter")
                    or ""
                )
                seen = set()
                parts = []
                for p in [addr.get("road") or data.get("name"), zone]:
                    if p and p not in seen:
                        seen.add(p)
                        parts.append(p)
                return {"name": ", ".join(parts) or data.get("display_name", ""), "zone": zone}
            except Exception:
                return {"name": "", "zone": ""}

        return jsonify(_geo_cache(f"{lat:.4f},{lng:.4f}", compute))

    # ---------------- Public : catalogue ----------------

    @app.get("/api/products")
    def list_products():
        query = public_products()
        category_id = request.args.get("category", type=int)
        search = request.args.get("search", "").strip()
        shop_slug = request.args.get("shop", "").strip()
        if category_id:
            query = query.filter(Product.category_id == category_id)
        if shop_slug:
            query = query.filter(Shop.slug == shop_slug)
        if search:
            like = f"%{search}%"
            query = query.filter(Product.name.ilike(like) | Product.description.ilike(like))
        products = query.order_by(Product.created_at.desc()).all()
        return jsonify([p.to_dict() for p in products])

    @app.get("/api/products/<int:product_id>")
    def get_product(product_id):
        product = db.session.get(Product, product_id)
        if not can_view_product(product):
            return jsonify({"error": "Produit introuvable"}), 404
        return jsonify(product.to_dict())

    @app.get("/api/categories")
    def list_categories():
        cats = Category.query.order_by(Category.name).all()
        # Nombre de produits actifs par rayon, en une seule requête (l'icône du rayon
        # est choisie côté site d'après son nom : src/categoryIcons.js)
        counts = dict(
            public_products()
            .with_entities(Product.category_id, db.func.count(Product.id))
            .group_by(Product.category_id)
            .all()
        )
        return jsonify(
            [{"id": c.id, "name": c.name, "product_count": counts.get(c.id, 0)} for c in cats]
        )

    def sounds_off():
        try:
            keys = _json_std.loads(get_setting("sounds_off") or "[]")
        except ValueError:
            return []
        return [k for k in keys if k in SOUND_KEYS]

    @app.get("/api/settings/public")
    def public_settings():
        return jsonify(
            {
                "shop_name": get_setting("shop_name"),
                "shop_phone": get_setting("shop_phone"),
                "pickup_address": get_setting("pickup_address"),
                "currency": get_setting("currency"),
                "low_stock_threshold": int(get_number("low_stock_threshold", 5)),
                "delivery_fee": get_number("delivery_fee"),
                "free_shipping_threshold": get_number("free_shipping_threshold"),
                "zones": get_zones(),
                "zone_fees": get_zone_fees(),
                # Le lien « Liquidation » n'est affiché que s'il y a quelque chose à voir
                "clearance_count": public_products().filter(Product.clearance.is_(True)).count(),
                "sounds_off": sounds_off(),
            }
        )

    # ---------------- Public : promos ----------------

    @app.post("/api/promo/validate")
    def validate_promo():
        data = request.get_json(force=True)
        code = (data.get("code") or "").strip().upper()
        promo = PromoCode.query.filter_by(code=code, active=True).first()
        if not promo:
            return jsonify({"error": "Code invalide ou expiré"}), 404
        try:
            subtotal = float(data["subtotal"]) if data.get("subtotal") is not None else None
        except (TypeError, ValueError):
            subtotal = None
        error = promo.check(subtotal=subtotal, phone=(data.get("phone") or "").strip() or None)
        if error:
            return jsonify({"error": error}), 400
        return jsonify(promo.to_dict())

    # ---------------- Public : commandes ----------------

    @app.post("/api/orders")
    def create_order():
        data = request.get_json(force=True)
        name = (data.get("customer_name") or "").strip()
        phone = (data.get("customer_phone") or "").strip()
        email = (data.get("customer_email") or "").strip()
        address = (data.get("customer_address") or "").strip()
        landmark = (data.get("landmark") or "").strip()[:300]
        zone = (data.get("zone") or "").strip()
        note = (data.get("note") or "").strip()
        payment = data.get("payment_method") or "livraison"
        delivery_method = data.get("delivery_method") or "delivery"
        promo_code = (data.get("promo_code") or "").strip().upper() or None
        items = data.get("items") or []
        try:
            latitude = float(data["latitude"]) if data.get("latitude") is not None else None
            longitude = float(data["longitude"]) if data.get("longitude") is not None else None
        except (TypeError, ValueError):
            return jsonify({"error": "Coordonnées GPS invalides"}), 400
        if latitude is not None and not (-90 <= latitude <= 90):
            return jsonify({"error": "Latitude invalide"}), 400
        if longitude is not None and not (-180 <= longitude <= 180):
            return jsonify({"error": "Longitude invalide"}), 400

        if not name or not phone:
            return jsonify({"error": "Nom et téléphone requis"}), 400
        if delivery_method not in DELIVERY_METHODS:
            return jsonify({"error": "Mode de récupération invalide"}), 400
        if delivery_method == "delivery":
            if not address:
                return jsonify({"error": "Adresse de livraison requise"}), 400
            zones = get_zones()
            if zones and zone not in zones:
                return jsonify({"error": "Zone de livraison invalide"}), 400
        else:
            address = ""
            landmark = ""
            zone = ""
            latitude = None
            longitude = None
        if payment not in PAYMENT_METHODS:
            return jsonify({"error": "Mode de paiement invalide"}), 400
        if not items:
            return jsonify({"error": "Panier vide"}), 400

        promo = None
        if promo_code:
            promo = PromoCode.query.filter_by(code=promo_code, active=True).first()
            if not promo:
                return jsonify({"error": "Code promo invalide"}), 400

        buyer = current_user()
        # Articles regroupés par boutique : une commande par boutique (le livreur passe chez
        # chaque vendeur). Le code promo de la plateforme ne vaut que pour la boutique officielle.
        groups = {}
        if not isinstance(items, list):
            return jsonify({"error": "Panier invalide"}), 400
        for item in items:
            try:
                variant_id = int(item.get("variant_id"))
                qty = int(item.get("quantity", 0))
            except (AttributeError, TypeError, ValueError):
                return jsonify({"error": "Article invalide"}), 400
            variant = db.session.get(Variant, variant_id)
            shop = variant.product.shop if variant else None
            if not variant or not variant.product.active or not shop or shop.status != "active":
                db.session.rollback()
                return jsonify({"error": "Un article n'est plus disponible"}), 400
            if qty <= 0:
                return jsonify({"error": "Quantité invalide"}), 400
            # Décrément atomique : évite la survente si deux commandes arrivent en même temps
            result = db.session.execute(
                sa_update(Variant)
                .where(Variant.id == variant.id, Variant.stock >= qty)
                .values(stock=Variant.stock - qty)
            )
            if result.rowcount == 0:
                db.session.rollback()
                return jsonify(
                    {"error": f"Stock insuffisant pour {variant.product.name} - {variant.name}"}
                ), 400
            db.session.refresh(variant)
            groups.setdefault(shop.id, {"shop": shop, "lines": []})["lines"].append((variant, qty))

        official_group = next((g for g in groups.values() if g["shop"].official), None)
        if promo and not official_group:
            db.session.rollback()
            return jsonify(
                {"error": "Ce code promo ne s'applique qu'aux produits de la boutique officielle"}
            ), 400
        threshold = get_number("free_shipping_threshold")
        fee = zone_delivery_fee(zone)
        orders = []
        for group in groups.values():
            shop = group["shop"]
            subtotal = sum(v.price * q for v, q in group["lines"])
            order_promo = promo if group is official_group else None
            discount = 0.0
            free_ship = False
            if order_promo:
                error = order_promo.check(subtotal=subtotal, phone=phone)
                if error:
                    db.session.rollback()
                    return jsonify({"error": error}), 400
                if order_promo.type == "percent":
                    discount = subtotal * order_promo.value / 100
                elif order_promo.type == "freeship":
                    free_ship = True
            base = subtotal - discount
            delivery_fee = (
                0.0
                if delivery_method == "pickup" or free_ship or (threshold and base >= threshold)
                else fee
            )
            order = Order(
                reference=generate_reference(),
                shop=shop,  # la relation (pas seulement shop_id) : utilisée avant l'enregistrement
                user_id=buyer.id if buyer else None,
                customer_name=name,
                customer_email=email,
                customer_phone=phone,
                customer_address=address,
                landmark=landmark,
                zone=zone,
                note=note,
                latitude=latitude,
                longitude=longitude,
                payment_method=payment,
                delivery_method=delivery_method,
                delivery_code="".join(random.choices(string.digits, k=4)),
                promo_code=order_promo.code if order_promo else None,
                # Boutique sans vendeur (officielle, gérée par l'admin) : prête tout de suite
                ready_at=None if shop.owner_id else utcnow(),
                subtotal=round(subtotal, 2),
                discount=round(discount, 2),
                delivery_fee=round(delivery_fee, 2),
                total=round(base + delivery_fee, 2),
            )
            for variant, qty in group["lines"]:
                order.items.append(
                    OrderItem(
                        variant_id=variant.id,
                        product_name=variant.product.name,
                        variant_name=variant.name,
                        quantity=qty,
                        unit_price=variant.price,
                    )
                )
            db.session.add(order)
            orders.append(order)
            order_event(order, "new")
        db.session.commit()
        for order in orders:
            notify_whatsapp_order(order)
        return jsonify({"orders": [o.to_dict() for o in orders]}), 201

    @app.get("/api/orders/track/<reference>")
    def track_order(reference):
        order = Order.query.filter_by(reference=reference.strip().upper()).first()
        if not order:
            return jsonify({"error": "Commande introuvable"}), 404
        data = order.to_dict(with_courier=True)
        data["reviewed_product_ids"] = [r.product_id for r in Review.query.filter_by(order_id=order.id)]
        return jsonify(data)

    @app.put("/api/orders/<reference>/courier-rating")
    def rate_courier(reference):
        order = Order.query.filter_by(reference=reference.strip().upper()).first()
        if not order:
            return jsonify({"error": "Commande introuvable"}), 404
        if order.status != "delivered" or not order.courier_id:
            return jsonify({"error": "Notation impossible pour cette commande"}), 400
        data = request.get_json(force=True)
        try:
            rating = int(data.get("rating"))
        except (TypeError, ValueError):
            return jsonify({"error": "Note invalide"}), 400
        if not (1 <= rating <= 5):
            return jsonify({"error": "La note doit être entre 1 et 5"}), 400
        order.courier_rating = rating
        order.courier_comment = (data.get("comment") or "").strip()
        db.session.commit()
        return jsonify(order.to_dict(with_courier=True))

    # ---------------- Public : avis produits ----------------

    @app.get("/api/products/<int:product_id>/reviews")
    def product_reviews(product_id):
        if not db.session.get(Product, product_id):
            return jsonify({"error": "Produit introuvable"}), 404
        reviews = Review.query.filter_by(product_id=product_id).limit(30).all()
        return jsonify([r.to_dict() for r in reviews])

    @app.post("/api/orders/<reference>/reviews")
    def create_review(reference):
        order = Order.query.filter_by(reference=reference.strip().upper()).first()
        if not order:
            return jsonify({"error": "Commande introuvable"}), 404
        if order.status != "delivered":
            return jsonify({"error": "Vous pourrez laisser un avis après la livraison"}), 400
        try:
            product_id = int(request.form.get("product_id", 0))
            rating = int(request.form.get("rating", 0))
        except (TypeError, ValueError):
            return jsonify({"error": "Données invalides"}), 400
        comment = (request.form.get("comment") or "").strip()
        if not (1 <= rating <= 5):
            return jsonify({"error": "La note doit être entre 1 et 5"}), 400
        product = db.session.get(Product, product_id)
        if not product:
            return jsonify({"error": "Produit introuvable"}), 404
        ordered_ids = {
            v.product_id
            for v in (db.session.get(Variant, i.variant_id) for i in order.items if i.variant_id)
            if v
        }
        if product.id not in ordered_ids and not any(
            i.product_name == product.name for i in order.items
        ):
            return jsonify({"error": "Ce produit ne fait pas partie de la commande"}), 400
        if Review.query.filter_by(order_id=order.id, product_id=product_id).first():
            return jsonify({"error": "Avis déjà laissé pour ce produit"}), 400

        photo_url = ""
        file = request.files.get("photo")
        if file and file.filename:
            ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
            if ext not in {"png", "jpg", "jpeg", "webp"}:
                return jsonify({"error": "Format d'image non supporté"}), 400
            try:
                img = Image.open(file.stream)
                img.load()
                img = img.convert("RGB")
                img.thumbnail((900, 900), Image.LANCZOS)
                filename = f"review-{uuid.uuid4().hex}.jpg"
                img.save(os.path.join(upload_dir, filename), "JPEG", quality=85, optimize=True)
                photo_url = f"/uploads/{filename}"
            except Exception:
                return jsonify({"error": "Image illisible"}), 400

        review = Review(
            product_id=product_id,
            order_id=order.id,
            customer_name=order.customer_name,
            rating=rating,
            comment=comment,
            photo_url=photo_url,
        )
        db.session.add(review)
        shop = product.shop
        if shop and shop.owner_id:
            notify(
                shop.owner_id,
                "review",
                f"Nouvel avis {rating}/5 sur « {product.name} ».",
                f"/b/{shop.slug}?onglet=avis",
            )
        db.session.commit()
        return jsonify(review.to_dict()), 201

    # ---------------- Public : demandes de stock ----------------

    @app.post("/api/stock-requests")
    def create_stock_request():
        data = request.get_json(force=True)
        variant = db.session.get(Variant, data.get("variant_id"))
        if not variant:
            return jsonify({"error": "Variante introuvable"}), 404
        if variant.stock > 0:
            return jsonify({"error": "Cette variante est déjà en stock"}), 400
        phone = (data.get("phone") or "").strip()
        req = StockRequest(variant_id=variant.id, phone=phone)
        db.session.add(req)
        db.session.commit()
        return jsonify(req.to_dict()), 201

    # ---------------- Public : offre du jour ----------------

    @app.get("/api/deal")
    def deal_of_the_day():
        products = public_products().order_by(Product.id).all()
        if not products:
            return jsonify({"error": "Aucun produit"}), 404
        seed = int(datetime.now(timezone.utc).strftime("%Y%m%d"))
        promo = [
            p
            for p in products
            if p.clearance or any(v.old_price and v.old_price > v.price for v in p.variants)
        ]
        pool = promo or products
        chosen = pool[seed % len(pool)]
        return jsonify(chosen.to_dict())

    # ---------------- Livreurs (public) ----------------

    @app.post("/api/courier/register")
    def courier_register():
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        password = data.get("password") or ""
        vehicle = (data.get("vehicle") or "").strip()
        zone = (data.get("zone") or "").strip()
        if not name or not phone or len(password) < 4:
            return jsonify({"error": "Nom, téléphone et mot de passe (4 car. min) requis"}), 400
        if DeliveryPerson.query.filter_by(phone=phone).first():
            return jsonify({"error": "Ce numéro est déjà inscrit"}), 400
        courier = DeliveryPerson(name=name, phone=phone, vehicle=vehicle, zone=zone)
        courier.set_password(password)
        db.session.add(courier)
        db.session.commit()
        session["courier_id"] = courier.id
        return jsonify(courier.to_dict()), 201

    @app.post("/api/courier/login")
    def courier_login():
        data = request.get_json(force=True)
        courier = DeliveryPerson.query.filter_by(phone=(data.get("phone") or "").strip()).first()
        if not courier or not courier.check_password(data.get("password") or ""):
            return jsonify({"error": "Téléphone ou mot de passe incorrect"}), 401
        session["courier_id"] = courier.id
        return jsonify(courier.to_dict())

    @app.post("/api/courier/logout")
    def courier_logout():
        session.pop("courier_id", None)
        return jsonify({"ok": True})

    @app.get("/api/courier/me")
    def courier_me():
        courier = db.session.get(DeliveryPerson, session.get("courier_id") or 0)
        return jsonify({"courier": courier.to_dict() if courier else None})

    @app.put("/api/courier/availability")
    @courier_required
    def courier_availability(courier):
        data = request.get_json(force=True)
        courier.available = bool(data.get("available"))
        db.session.commit()
        return jsonify(courier.to_dict())

    @app.put("/api/courier/position")
    @courier_required
    def courier_position(courier):
        data = request.get_json(force=True)
        try:
            lat = float(data.get("lat"))
            lng = float(data.get("lng"))
        except (TypeError, ValueError):
            return jsonify({"error": "Coordonnées invalides"}), 400
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return jsonify({"error": "Coordonnées invalides"}), 400
        courier.last_lat = lat
        courier.last_lng = lng
        courier.position_at = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/courier/deliveries")
    @courier_required
    def courier_deliveries(courier):
        # Un livreur non vérifié ou hors ligne ne voit pas les commandes (données clients).
        if courier.verified and courier.available:
            # Seulement les colis préparés par leur vendeur (prêts à être récupérés)
            available = (
                Order.query.filter_by(
                    status="pending", courier_id=None, delivery_method="delivery"
                )
                .filter(Order.ready_at.isnot(None))
                .order_by(Order.created_at.desc())
                .all()
            )
        else:
            available = []
        available.sort(key=lambda o: (o.zone != courier.zone, -o.created_at.timestamp()))
        in_progress = (
            Order.query.filter_by(status="delivering", courier_id=courier.id)
            .order_by(Order.accepted_at.desc())
            .all()
        )
        delivered = (
            Order.query.filter_by(status="delivered", courier_id=courier.id)
            .order_by(Order.delivered_at.desc())
            .limit(30)
            .all()
        )
        commission = get_number("delivery_commission")
        # Gains et note sur TOUTES les livraisons, pas seulement les 30 affichées
        delivered_count = Order.query.filter_by(status="delivered", courier_id=courier.id).count()
        rated = [
            r
            for (r,) in db.session.query(Order.courier_rating).filter(
                Order.courier_id == courier.id,
                Order.status == "delivered",
                Order.courier_rating.isnot(None),
            )
        ]
        rating_avg = round(sum(rated) / len(rated), 1) if rated else None
        return jsonify(
            {
                "available": [courier_order_dict(o) for o in available],
                "in_progress": [courier_order_dict(o) for o in in_progress],
                "delivered": [courier_order_dict(o) for o in delivered],
                "commission": commission,
                "bonus_total": courier.bonus_total,
                "rating_avg": rating_avg,
                "rating_count": len(rated),
                "delivered_count": delivered_count,
                "earnings": round(delivered_count * commission + courier.bonus_total, 2),
            }
        )

    @app.post("/api/courier/deliveries/<int:order_id>/accept")
    @courier_required
    def courier_accept(courier, order_id):
        if not courier.verified:
            return jsonify(
                {"error": "Votre compte est en cours de vérification par la boutique"}
            ), 403
        if not courier.available:
            return jsonify({"error": "Passez en ligne pour accepter une course"}), 400
        result = db.session.execute(
            sa_update(Order)
            .where(
                Order.id == order_id,
                Order.status == "pending",
                Order.courier_id.is_(None),
                Order.delivery_method == "delivery",
                Order.ready_at.isnot(None),
            )
            .values(
                courier_id=courier.id,
                status="delivering",
                accepted_at=datetime.now(timezone.utc),
            )
        )
        if result.rowcount == 0:
            db.session.rollback()
            return jsonify({"error": "Cette course n'est plus disponible"}), 400
        order = db.session.get(Order, order_id)
        order_event(order, "delivering", courier=courier)
        db.session.commit()
        return jsonify(courier_order_dict(order))

    @app.post("/api/courier/deliveries/<int:order_id>/complete")
    @courier_required
    def courier_complete(courier, order_id):
        order = db.session.get(Order, order_id)
        if not order or order.courier_id != courier.id or order.status != "delivering":
            return jsonify({"error": "Livraison introuvable"}), 400
        if CODE_FAILS.get(order.id, 0) >= MAX_CODE_FAILS:
            return jsonify(
                {"error": "Trop de codes incorrects. Contactez la boutique pour valider la livraison."}
            ), 429
        data = (request.get_json(silent=True) or {}) if request.data else {}
        code = str(data.get("code") or "").strip()
        # Les anciennes commandes (avant l'ajout du code) n'en ont pas : pas de vérification.
        if order.delivery_code and not hmac.compare_digest(
            code.encode(), order.delivery_code.encode()
        ):
            CODE_FAILS[order.id] = CODE_FAILS.get(order.id, 0) + 1
            return jsonify(
                {"error": "Code de livraison incorrect. Demandez le code au client."}
            ), 400
        CODE_FAILS.pop(order.id, None)
        order.status = "delivered"
        order.delivered_at = datetime.now(timezone.utc)
        order_event(order, "delivered")
        db.session.commit()
        return jsonify(courier_order_dict(order))

    # ---------------- Fichiers (images) ----------------

    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

    @app.get("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(upload_dir, filename)

    THUMB_WIDTHS = {160, 320, 640}

    @app.get("/uploads/thumb/<int:width>/<filename>")
    def serve_thumb(width, filename):
        """Miniature WebP d'une image envoyée, créée à la première demande puis gardée."""
        if width not in THUMB_WIDTHS or filename.startswith("."):
            return jsonify({"error": "Taille non disponible"}), 404
        source = os.path.join(upload_dir, filename)
        if not os.path.isfile(source):
            return jsonify({"error": "Image introuvable"}), 404
        thumb_dir = os.path.join(upload_dir, "thumbs", str(width))
        thumb_name = filename.rsplit(".", 1)[0] + ".webp"
        thumb_path = os.path.join(thumb_dir, thumb_name)
        if not os.path.isfile(thumb_path):
            try:
                os.makedirs(thumb_dir, exist_ok=True)
                with Image.open(source) as img:
                    img = img.convert("RGB")
                    img.thumbnail((width, width * 2), Image.LANCZOS)
                    tmp = f"{thumb_path}.{uuid.uuid4().hex}.tmp"
                    img.save(tmp, "WEBP", quality=78, method=4)
                    os.replace(tmp, thumb_path)
            except Exception:
                return send_from_directory(upload_dir, filename)
        return send_from_directory(thumb_dir, thumb_name, mimetype="image/webp")

    def save_uploaded_image(max_size=900):
        """Image envoyée (champ « file ») réduite et enregistrée en JPEG : (url, erreur)."""
        file = request.files.get("file")
        if not file or not file.filename:
            return None, "Aucun fichier envoyé"
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            return None, "Format non supporté (png, jpg, webp, gif)"
        try:
            img = Image.open(file.stream)
            img.load()
        except Exception:
            return None, "Fichier image illisible"
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGBA")
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = background
        else:
            img = img.convert("RGB")
        img.thumbnail((max_size, max_size), Image.LANCZOS)
        filename = f"{uuid.uuid4().hex}.jpg"
        img.save(os.path.join(upload_dir, filename), "JPEG", quality=86, optimize=True)
        return f"/uploads/{filename}", None

    @app.post("/api/admin/upload")
    @admin_required
    def admin_upload():
        url, error = save_uploaded_image()
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"url": url}), 201

    @app.post("/api/me/upload")
    @user_required
    def user_upload(user):
        # ?kind=cover : photo de couverture de boutique, gardée plus large
        url, error = save_uploaded_image(1600 if request.args.get("kind") == "cover" else 900)
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"url": url}), 201

    # ---------------- Comptes : inscription, connexion ----------------

    def login_user(user):
        session.permanent = True
        session["user_id"] = user.id

    def validate_password(password):
        return "Mot de passe trop court (6 caractères minimum)" if len(password) < 6 else None

    @app.post("/api/auth/register")
    def register():
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        phone = normalize_phone(data.get("phone"))
        password = str(data.get("password") or "")
        if not 2 <= len(name) <= 80:
            return jsonify({"error": "Indiquez votre nom (2 à 80 caractères)"}), 400
        if not 8 <= len(phone) <= 12:
            return jsonify({"error": "Numéro de téléphone invalide"}), 400
        error = validate_password(password)
        if error:
            return jsonify({"error": error}), 400
        if User.query.filter_by(phone=phone).first():
            return jsonify({"error": "Un compte existe déjà avec ce numéro : connectez-vous"}), 409
        user = User(name=name, phone=phone)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return jsonify(user.to_dict(private=True)), 201

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(force=True)
        phone = normalize_phone(data.get("phone"))
        keys = (f"tel:{phone}", f"ip:{request.remote_addr}")
        if login_blocked(*keys):
            return jsonify({"error": "Trop d'essais : réessayez dans un quart d'heure"}), 429
        user = User.query.filter_by(phone=phone).first() if phone else None
        if not user or not user.check_password(str(data.get("password") or "")):
            record_login_fail(*keys)
            return jsonify({"error": "Numéro ou mot de passe incorrect"}), 401
        if not user.active:
            return jsonify({"error": "Compte bloqué : contactez la plateforme"}), 403
        login_user(user)
        return jsonify(user.to_dict(private=True))

    @app.post("/api/auth/logout")
    def logout():
        session.pop("user_id", None)
        return jsonify({"ok": True})

    @app.get("/api/auth/me")
    def me():
        user = current_user()
        return jsonify({"user": user.to_dict(private=True) if user else None})

    @app.put("/api/auth/me")
    @user_required
    def update_me(user):
        data = request.get_json(force=True)
        if "name" in data:
            name = (data.get("name") or "").strip()
            if not 2 <= len(name) <= 80:
                return jsonify({"error": "Indiquez votre nom (2 à 80 caractères)"}), 400
            user.name = name
        if "avatar_url" in data:
            user.avatar_url = str(data.get("avatar_url") or "")
        if data.get("new_password"):
            if not user.check_password(str(data.get("current_password") or "")):
                return jsonify({"error": "Mot de passe actuel incorrect"}), 400
            error = validate_password(str(data["new_password"]))
            if error:
                return jsonify({"error": error}), 400
            user.set_password(str(data["new_password"]))
        db.session.commit()
        return jsonify(user.to_dict(private=True))

    # ---------------- Boutiques : pages publiques, abonnements ----------------

    def visible_shop(slug):
        """Boutique affichable : validée, ou vue par son vendeur / l'admin (aperçu)."""
        shop = Shop.query.filter_by(slug=slug).first()
        if not shop:
            return None
        user = current_user()
        if shop.status == "active" or session.get("admin") or (user and shop.owner_id == user.id):
            return shop
        return None

    def shop_ratings(shop_ids):
        """Note des boutiques d'après les avis laissés sur leurs produits (vrais avis, après
        livraison ; jamais les notes de démo saisies à la main) : {shop_id: (moyenne, nombre)}."""
        if not shop_ids:
            return {}
        rows = (
            db.session.query(Product.shop_id, db.func.avg(Review.rating), db.func.count(Review.id))
            .join(Review, Review.product_id == Product.id)
            .filter(Product.shop_id.in_(list(shop_ids)))
            .group_by(Product.shop_id)
        )
        return {shop_id: (round(float(avg), 1), count) for shop_id, avg, count in rows}

    def with_rating(data, rating):
        data["rating"], data["reviews_count"] = rating or (None, 0)
        return data

    @app.get("/api/shops")
    def list_shops():
        query = Shop.query.filter_by(status="active")
        search = request.args.get("search", "").strip()
        if search:
            query = query.filter(Shop.name.ilike(f"%{search}%"))
        found = query.all()
        ratings = shop_ratings([s.id for s in found])
        shops = [with_rating(s.to_dict(), ratings.get(s.id)) for s in found]
        # Boutique officielle d'abord, puis les plus suivies, puis les plus fournies
        shops.sort(key=lambda s: (not s["official"], -s["followers_count"], -s["products_count"]))
        return jsonify(shops)

    @app.get("/api/shops/<slug>")
    def get_shop(slug):
        shop = visible_shop(slug)
        if not shop:
            return jsonify({"error": "Boutique introuvable"}), 404
        user = current_user()
        data = with_rating(shop.to_dict(), shop_ratings([shop.id]).get(shop.id))
        data["is_following"] = bool(
            user and db.session.get(Follow, {"user_id": user.id, "shop_id": shop.id})
        )
        data["is_owner"] = bool(user and shop.owner_id == user.id)
        if shop.status != "active":
            data["status"] = shop.status  # aperçu du vendeur : « en attente de validation »
        return jsonify(data)

    REVIEWS_PAGE = 20

    @app.get("/api/shops/<slug>/reviews")
    def shop_reviews(slug):
        shop = visible_shop(slug)
        if not shop:
            return jsonify({"error": "Boutique introuvable"}), 404
        page = max(0, request.args.get("page", 0, type=int))
        rows = (
            Review.query.join(Product, Review.product_id == Product.id)
            .filter(Product.shop_id == shop.id)
            .order_by(Review.created_at.desc(), Review.id.desc())
            .offset(page * REVIEWS_PAGE)
            .limit(REVIEWS_PAGE + 1)
            .all()
        )
        reviews = []
        for review in rows[:REVIEWS_PAGE]:
            data = review.to_dict()
            data["product"] = {
                "id": review.product.id,
                "name": review.product.name,
                "image_url": review.product.image_url or "",
                "category": review.product.category.name if review.product.category else None,
            }
            reviews.append(data)
        return jsonify({"reviews": reviews, "has_more": len(rows) > REVIEWS_PAGE, "page": page})

    @app.post("/api/shops/<slug>/follow")
    @user_required
    def follow_shop(user, slug):
        shop = Shop.query.filter_by(slug=slug, status="active").first()
        if not shop:
            return jsonify({"error": "Boutique introuvable"}), 404
        if not db.session.get(Follow, {"user_id": user.id, "shop_id": shop.id}):
            db.session.add(Follow(user_id=user.id, shop_id=shop.id))
            db.session.commit()
        return jsonify({"following": True, "followers_count": shop.followers_count()})

    @app.delete("/api/shops/<slug>/follow")
    @user_required
    def unfollow_shop(user, slug):
        shop = Shop.query.filter_by(slug=slug).first()
        if not shop:
            return jsonify({"error": "Boutique introuvable"}), 404
        follow = db.session.get(Follow, {"user_id": user.id, "shop_id": shop.id})
        if follow:
            db.session.delete(follow)
            db.session.commit()
        return jsonify({"following": False, "followers_count": shop.followers_count()})

    @app.get("/api/me/follows")
    @user_required
    def my_follows(user):
        shops = (
            Shop.query.join(Follow, Follow.shop_id == Shop.id)
            .filter(Follow.user_id == user.id, Shop.status == "active")
            .order_by(Follow.created_at.desc())
            .all()
        )
        return jsonify([s.to_dict() for s in shops])

    # ---------------- Espace vendeur : sa boutique et ses produits ----------------

    SHOP_FIELDS = ("name", "description", "logo_url", "cover_url", "whatsapp", "zone", "address")

    def apply_shop_payload(shop, data):
        for field in SHOP_FIELDS:
            if field in data:
                setattr(shop, field, str(data[field] or "").strip())
        # Logo et couverture : photos envoyées sur la plateforme (pas d'image d'un autre site,
        # qui pourrait pister les visiteurs de la boutique)
        for field in ("logo_url", "cover_url"):
            value = getattr(shop, field) or ""
            if field in data and value and not value.startswith("/uploads/"):
                return "Photo invalide : envoyez-la depuis le site"
        if not 2 <= len(shop.name or "") <= 80:
            return "Nom de boutique requis (2 à 80 caractères)"
        if len(shop.description or "") > 1500:
            return "Description trop longue (1500 caractères maximum)"
        zones = get_zones()
        if shop.zone and zones and shop.zone not in zones:
            return "Quartier invalide"
        for key in ("latitude", "longitude"):
            if key in data:
                try:
                    value = float(data[key]) if data[key] not in (None, "") else None
                except (TypeError, ValueError):
                    return "Position GPS invalide"
                setattr(shop, key, value)
        return None

    @app.get("/api/my/shop")
    @user_required
    def my_shop(user):
        if not user.shop:
            return jsonify({"shop": None})
        # Compteur de l'onglet « Commandes » : colis que le vendeur doit encore préparer
        to_prepare = Order.query.filter(
            Order.shop_id == user.shop.id, Order.status == "pending", Order.ready_at.is_(None)
        ).count()
        return jsonify({"shop": user.shop.to_dict(private=True), "orders_to_prepare": to_prepare})

    @app.post("/api/my/shop")
    @user_required
    def create_my_shop(user):
        if user.shop:
            return jsonify({"error": "Vous avez déjà une boutique"}), 409
        data = request.get_json(force=True)
        shop = Shop(name="", owner_id=user.id, status="pending")
        error = apply_shop_payload(shop, data)
        if error:
            return jsonify({"error": error}), 400
        if not shop.whatsapp:
            shop.whatsapp = user.phone
        shop.slug = unique_slug(shop.name)
        db.session.add(shop)
        db.session.commit()
        return jsonify(shop.to_dict(private=True)), 201

    @app.put("/api/my/shop")
    @seller_required
    def update_my_shop(user, shop):
        data = request.get_json(force=True)
        error = apply_shop_payload(shop, data)
        if error:
            db.session.rollback()
            return jsonify({"error": error}), 400
        # Boutique refusée puis corrigée : elle repasse en attente de validation
        if shop.status == "rejected":
            shop.status = "pending"
        db.session.commit()
        return jsonify(shop.to_dict(private=True))

    def my_product(shop, product_id):
        product = db.session.get(Product, product_id)
        return product if product and product.shop_id == shop.id else None

    @app.get("/api/my/products")
    @seller_required
    def my_products(user, shop):
        products = Product.query.filter_by(shop_id=shop.id).order_by(Product.created_at.desc())
        return jsonify([p.to_dict() for p in products])

    @app.post("/api/my/products")
    @seller_required
    def my_create_product(user, shop):
        data = request.get_json(force=True)
        product = Product(name="", shop_id=shop.id)
        error = apply_product_payload(product, {**data, "name": data.get("name") or ""})
        if error:
            db.session.rollback()
            return jsonify({"error": error}), 400
        db.session.add(product)
        db.session.commit()
        return jsonify(product.to_dict()), 201

    @app.put("/api/my/products/<int:product_id>")
    @seller_required
    def my_update_product(user, shop, product_id):
        product = my_product(shop, product_id)
        if not product:
            return jsonify({"error": "Produit introuvable"}), 404
        error = apply_product_payload(product, request.get_json(force=True))
        if error:
            db.session.rollback()
            return jsonify({"error": error}), 400
        db.session.commit()
        return jsonify(product.to_dict())

    @app.delete("/api/my/products/<int:product_id>")
    @seller_required
    def my_delete_product(user, shop, product_id):
        product = my_product(shop, product_id)
        if not product:
            return jsonify({"error": "Produit introuvable"}), 404
        db.session.delete(product)
        db.session.commit()
        return jsonify({"ok": True})

    # ---------------- Compte : ses commandes et ses notifications ----------------

    @app.get("/api/me/orders")
    @user_required
    def my_account_orders(user):
        """Commandes passées connecté : elles suivent le client d'un téléphone à l'autre."""
        orders = (
            Order.query.filter_by(user_id=user.id).order_by(Order.created_at.desc()).limit(30).all()
        )
        result = []
        for order in orders:
            data = order.to_dict()
            data.pop("delivery_code", None)  # affiché seulement sur la page de suivi
            result.append(data)
        return jsonify(result)

    @app.get("/api/me/notifications")
    @user_required
    def my_notifications(user):
        items = (
            Notification.query.filter_by(user_id=user.id)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(50)
            .all()
        )
        unread = Notification.query.filter_by(user_id=user.id, read=False).count()
        return jsonify({"items": [n.to_dict() for n in items], "unread": unread})

    @app.get("/api/me/notifications/count")
    @user_required
    def my_notifications_count(user):
        return jsonify({"unread": Notification.query.filter_by(user_id=user.id, read=False).count()})

    @app.post("/api/me/notifications/read")
    @user_required
    def read_my_notifications(user):
        Notification.query.filter_by(user_id=user.id, read=False).update({"read": True})
        db.session.commit()
        return jsonify({"unread": 0})

    # ---------------- Espace vendeur : tableau de bord ----------------

    STATS_DAYS = 30
    CHART_DAYS = 14

    def local_day(dt):
        """Jour de Libreville d'une date UTC sans fuseau (relue depuis SQLite)."""
        return dt.replace(tzinfo=timezone.utc).astimezone(GABON_TZ).date()

    def daily_series(orders, amount):
        """Commandes et montant par jour sur les CHART_DAYS derniers jours (heure de Libreville)."""
        today = datetime.now(GABON_TZ).date()
        series = []
        for back in range(CHART_DAYS - 1, -1, -1):
            day = today - timedelta(days=back)
            same_day = [o for o in orders if local_day(o.created_at) == day]
            series.append(
                {"date": day.isoformat(), "orders": len(same_day), "amount": round(sum(amount(o) for o in same_day))}
            )
        return series

    @app.get("/api/my/stats")
    @seller_required
    def my_stats(user, shop):
        """Ventes des 30 derniers jours, commandes par jour, meilleures ventes, stock bas."""
        since = utcnow() - timedelta(days=STATS_DAYS)
        orders = Order.query.filter(Order.shop_id == shop.id, Order.created_at >= since).all()
        live = [o for o in orders if o.status != "cancelled"]

        def amount(order):
            return order.subtotal - (order.discount or 0)

        days = daily_series(live, amount)

        top = {}
        for order in live:
            for item in order.items:
                line = top.setdefault(item.product_name, {"name": item.product_name, "quantity": 0, "amount": 0})
                line["quantity"] += item.quantity
                line["amount"] += item.quantity * item.unit_price
        top_products = sorted(top.values(), key=lambda x: (-x["quantity"], -x["amount"]))[:5]

        threshold = int(get_number("low_stock_threshold", 5))
        low_stock = (
            Variant.query.join(Product, Variant.product_id == Product.id)
            .filter(Product.shop_id == shop.id, Product.active.is_(True), Variant.stock <= threshold)
            .order_by(Variant.stock, Product.name)
            .limit(10)
            .all()
        )
        rating = shop_ratings([shop.id]).get(shop.id) or (None, 0)
        return jsonify(
            {
                "period_days": STATS_DAYS,
                "orders": len(live),
                "delivered": sum(1 for o in live if o.status == "delivered"),
                "cancelled": len(orders) - len(live),
                "sales": round(sum(amount(o) for o in live if o.status == "delivered")),
                "sales_pending": round(sum(amount(o) for o in live if o.status != "delivered")),
                "to_prepare": Order.query.filter(
                    Order.shop_id == shop.id, Order.status == "pending", Order.ready_at.is_(None)
                ).count(),
                "followers": shop.followers_count(),
                "new_followers": Follow.query.filter(
                    Follow.shop_id == shop.id, Follow.created_at >= since
                ).count(),
                "rating": rating[0],
                "reviews_count": rating[1],
                "days": days,
                "top_products": [{**t, "amount": round(t["amount"])} for t in top_products],
                "low_stock": [
                    {
                        "product_id": v.product_id,
                        "product": v.product.name,
                        "variant": v.name,
                        "stock": v.stock,
                    }
                    for v in low_stock
                ],
            }
        )

    # ---------------- Signalements ----------------

    REPORTS_PER_DAY = 10

    def report_target(target, target_id):
        """(contenu signalé, boutique concernée)"""
        if target == "post":
            post = db.session.get(Post, target_id)
            return post, post.shop if post else None
        shop = db.session.get(Shop, target_id)
        return shop, shop

    @app.post("/api/reports")
    @user_required
    def create_report(user):
        data = request.get_json(force=True) or {}
        target, reason = data.get("target"), data.get("reason")
        try:
            target_id = int(data.get("target_id"))
        except (TypeError, ValueError):
            return jsonify({"error": "Signalement invalide"}), 400
        if target not in REPORT_TARGETS or reason not in REPORT_REASONS:
            return jsonify({"error": "Signalement invalide"}), 400
        item, shop = report_target(target, target_id)
        if not item or not shop or shop.status != "active" or getattr(item, "hidden", False):
            return jsonify({"error": "Contenu introuvable"}), 404
        if shop.owner_id == user.id:
            return jsonify({"error": "Vous ne pouvez pas signaler votre propre boutique"}), 400
        already = Report.query.filter_by(
            target=target, target_id=target_id, user_id=user.id, status="open"
        ).first()
        if already:
            return jsonify({"ok": True})
        today = Report.query.filter(
            Report.user_id == user.id, Report.created_at >= utcnow() - timedelta(days=1)
        ).count()
        if today >= REPORTS_PER_DAY:
            return jsonify({"error": "Trop de signalements aujourd'hui : réessayez demain"}), 429
        db.session.add(
            Report(
                target=target,
                target_id=target_id,
                reason=reason,
                details=str(data.get("details") or "").strip()[:500],
                user_id=user.id,
            )
        )
        db.session.commit()
        return jsonify({"ok": True}), 201

    @app.get("/api/admin/reports")
    @admin_required
    def admin_reports():
        """Signalements regroupés par contenu (plusieurs personnes peuvent signaler le même)."""
        status = request.args.get("status", "open")
        query = Report.query
        if status == "open":
            query = query.filter_by(status="open")
        else:
            query = query.filter(Report.status != "open")
        groups = {}
        for report in query.order_by(Report.created_at.desc()).limit(300):
            key = (report.target, report.target_id)
            if key not in groups:
                item, shop = report_target(*key)
                groups[key] = {
                    "target": report.target,
                    "target_id": report.target_id,
                    "post": item.to_dict(private=True) if report.target == "post" and item else None,
                    "shop": shop.to_dict(private=True) if shop else None,
                    "reports": [],
                }
            groups[key]["reports"].append(report.to_dict())
        return jsonify(list(groups.values()))

    @app.put("/api/admin/reports")
    @admin_required
    def admin_resolve_reports():
        """Décision sur un contenu signalé : masquer la publication, suspendre la boutique,
        rétablir une publication masquée, ou classer sans suite."""
        data = request.get_json(force=True) or {}
        target, action = data.get("target"), data.get("action")
        try:
            target_id = int(data.get("target_id"))
        except (TypeError, ValueError):
            return jsonify({"error": "Signalement invalide"}), 400
        if target not in REPORT_TARGETS:
            return jsonify({"error": "Signalement invalide"}), 400
        item, shop = report_target(target, target_id)
        if not item:
            return jsonify({"error": "Contenu introuvable"}), 404
        note = str(data.get("note") or "").strip()[:300]
        pending = Report.query.filter_by(target=target, target_id=target_id, status="open").all()
        reason = REPORT_REASONS.get(pending[0].reason, "") if pending else ""
        if action == "hide_post":
            if target != "post":
                return jsonify({"error": "Action impossible"}), 400
            item.hidden = True
            if shop and shop.owner_id:
                notify(
                    shop.owner_id,
                    "moderation",
                    f"Une de vos publications a été masquée par la modération : {note or reason}.",
                    "/vendeur/publications",
                )
        elif action == "restore_post":
            if target != "post":
                return jsonify({"error": "Action impossible"}), 400
            item.hidden = False
        elif action == "suspend_shop":
            if not shop or shop.official:
                return jsonify({"error": "La boutique officielle ne peut pas être suspendue"}), 400
            if shop.status != "suspended":
                shop.status = "suspended"
                shop.status_note = note or reason
                shop_status_notice(shop)
        elif action != "dismiss":
            return jsonify({"error": "Action inconnue"}), 400
        now = utcnow()
        for report in pending:
            report.status = "dismissed" if action == "dismiss" else "done"
            report.resolved_at = now
        db.session.commit()
        return jsonify({"ok": True, "resolved": len(pending)})

    # ---------------- Espace vendeur : ses commandes ----------------

    @app.get("/api/my/orders")
    @seller_required
    def my_orders(user, shop):
        orders = Order.query.filter_by(shop_id=shop.id).order_by(Order.created_at.desc()).limit(100)
        return jsonify([seller_order_dict(o) for o in orders])

    @app.put("/api/my/orders/<int:order_id>")
    @seller_required
    def my_update_order(user, shop, order_id):
        """ready : colis préparé (livraison : proposé aux livreurs ; retrait : prêt au comptoir) ·
        picked_up : le client a retiré sa commande · cancel : commande refusée, stock remis."""
        order = db.session.get(Order, order_id)
        if not order or order.shop_id != shop.id:
            return jsonify({"error": "Commande introuvable"}), 404
        action = (request.get_json(force=True) or {}).get("action")
        now = utcnow()
        if action == "ready":
            if order.status != "pending":
                return jsonify({"error": "Cette commande n'est plus en attente"}), 400
            order.ready_at = order.ready_at or now
            if order.delivery_method == "pickup":
                order.status = "delivering"  # « prête à retirer » pour le client
                order.accepted_at = now
                order_event(order, "ready", to_seller=False)
        elif action == "picked_up":
            if order.delivery_method != "pickup" or order.status != "delivering":
                return jsonify({"error": "Commande pas encore prête"}), 400
            order.status = "delivered"
            order.delivered_at = now
        elif action == "cancel":
            cancellable = order.status == "pending" or (
                order.delivery_method == "pickup" and order.status == "delivering"
            )
            if not cancellable or order.courier_id:
                return jsonify({"error": "Trop tard : la commande est déjà en livraison"}), 400
            restock(order)
            order.status = "cancelled"
            order_event(order, "cancelled", to_seller=False)
        else:
            return jsonify({"error": "Action inconnue"}), 400
        db.session.commit()
        return jsonify(seller_order_dict(order))

    # ---------------- Publications des boutiques ----------------

    POSTS_PAGE = 15

    @app.get("/api/shops/<slug>/posts")
    def shop_posts(slug):
        """Publications écrites par le vendeur (onglet « Publications » de sa page). Les
        anciennes nouveautés automatiques du fil d'actu (retiré) ne sont plus montrées."""
        shop = visible_shop(slug)
        if not shop:
            return jsonify({"error": "Boutique introuvable"}), 404
        page = max(0, request.args.get("page", 0, type=int))
        posts = (
            Post.query.filter_by(shop_id=shop.id, hidden=False, kind="post")
            .order_by(Post.created_at.desc())
            .offset(page * POSTS_PAGE)
            .limit(POSTS_PAGE + 1)
            .all()
        )
        user = current_user()
        following = bool(user and db.session.get(Follow, {"user_id": user.id, "shop_id": shop.id}))
        items = [p.to_dict(following=following) for p in posts[:POSTS_PAGE]]
        # Publication vidée (produits retirés, sans texte ni photo) : rien à montrer
        items = [i for i in items if i["text"] or i["images"] or i["products"]]
        return jsonify({"posts": items, "has_more": len(posts) > POSTS_PAGE, "page": page})

    @app.get("/api/my/posts")
    @seller_required
    def my_posts(user, shop):
        posts = (
            Post.query.filter_by(shop_id=shop.id, kind="post").order_by(Post.created_at.desc()).limit(100)
        )
        return jsonify([p.to_dict(private=True) for p in posts])

    @app.post("/api/my/posts")
    @seller_required
    def create_post(user, shop):
        data = request.get_json(force=True)
        text = str(data.get("text") or "").strip()
        if len(text) > 2000:
            return jsonify({"error": "Texte trop long (2000 caractères maximum)"}), 400
        # Seulement des photos envoyées sur la plateforme (pas d'images externes)
        images = [u for u in (data.get("images") or []) if isinstance(u, str) and u.startswith("/uploads/")]
        if len(images) > MAX_POST_IMAGES:
            return jsonify({"error": f"{MAX_POST_IMAGES} photos maximum"}), 400
        products = []
        for pid in data.get("product_ids") or []:
            product = db.session.get(Product, pid) if isinstance(pid, int) else None
            if not product or product.shop_id != shop.id:
                return jsonify({"error": "Produit invalide"}), 400
            products.append(product)
        if not (text or images or products):
            return jsonify({"error": "Ajoutez un texte, une photo ou un produit"}), 400
        post = Post(shop_id=shop.id, kind="post", text=text, images=_json_std.dumps(images))
        post.products = products
        db.session.add(post)
        db.session.commit()
        return jsonify(post.to_dict(private=True)), 201

    @app.delete("/api/my/posts/<int:post_id>")
    @seller_required
    def delete_post(user, shop, post_id):
        post = db.session.get(Post, post_id)
        if not post or post.shop_id != shop.id:
            return jsonify({"error": "Publication introuvable"}), 404
        db.session.delete(post)
        db.session.commit()
        return jsonify({"ok": True})

    # ---------------- Admin : boutiques et comptes ----------------

    @app.get("/api/admin/shops")
    @admin_required
    def admin_list_shops():
        shops = Shop.query.order_by(Shop.created_at.desc()).all()
        order = {"pending": 0, "active": 1, "suspended": 2, "rejected": 3}
        shops.sort(key=lambda s: order.get(s.status, 9))  # en attente d'abord
        return jsonify([s.to_dict(private=True) for s in shops])

    @app.put("/api/admin/shops/<int:shop_id>")
    @admin_required
    def admin_update_shop(shop_id):
        shop = db.session.get(Shop, shop_id)
        if not shop:
            return jsonify({"error": "Boutique introuvable"}), 404
        data = request.get_json(force=True)
        previous = shop.status
        if "status" in data:
            if data["status"] not in SHOP_STATUSES:
                return jsonify({"error": "Statut invalide"}), 400
            if shop.official and data["status"] != "active":
                return jsonify({"error": "La boutique officielle reste toujours active"}), 400
            shop.status = data["status"]
            if shop.status == "active" and not shop.validated_at:
                shop.validated_at = datetime.now(timezone.utc)
        if "status_note" in data:
            shop.status_note = str(data["status_note"] or "").strip()
        if "owner_phone" in data:
            # Confier la boutique à un compte (ex. la boutique officielle à ton propre compte)
            owner = User.query.filter_by(phone=normalize_phone(data["owner_phone"])).first()
            if not owner:
                return jsonify({"error": "Aucun compte avec ce numéro"}), 400
            if owner.shop and owner.shop.id != shop.id:
                return jsonify({"error": "Ce compte a déjà une boutique"}), 400
            shop.owner_id = owner.id
        error = apply_shop_payload(shop, {k: v for k, v in data.items() if k in SHOP_FIELDS})
        if error:
            db.session.rollback()
            return jsonify({"error": error}), 400
        if shop.status != previous:
            shop_status_notice(shop)
        db.session.commit()
        return jsonify(shop.to_dict(private=True))

    @app.get("/api/admin/users")
    @admin_required
    def admin_list_users():
        query = User.query
        search = request.args.get("search", "").strip()
        if search:
            conditions = [User.name.ilike(f"%{search}%")]
            digits = normalize_phone(search)
            if digits:
                conditions.append(User.phone.contains(digits))
            query = query.filter(db.or_(*conditions))
        users = query.order_by(User.created_at.desc()).limit(200).all()
        return jsonify([u.to_dict(private=True) for u in users])

    @app.put("/api/admin/users/<int:user_id>")
    @admin_required
    def admin_update_user(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "Compte introuvable"}), 404
        data = request.get_json(force=True)
        if "active" in data:
            user.active = bool(data["active"])
        if data.get("new_password"):
            # Mot de passe oublié : l'admin en donne un nouveau au client
            error = validate_password(str(data["new_password"]))
            if error:
                return jsonify({"error": error}), 400
            user.set_password(str(data["new_password"]))
        db.session.commit()
        return jsonify(user.to_dict(private=True))

    # ---------------- Admin : auth ----------------

    def check_admin_password(supplied):
        """Mot de passe admin, enregistré chiffré. Un ancien mot de passe en clair (base créée
        avant) est accepté une dernière fois puis remplacé par son empreinte."""
        stored = get_setting("admin_password")
        if is_password_hash(stored):
            return check_password_hash(stored, supplied)
        if stored and hmac.compare_digest(supplied.encode(), stored.encode()):
            set_setting("admin_password", generate_password_hash(supplied))
            db.session.commit()
            return True
        return False

    @app.post("/api/admin/login")
    def admin_login():
        data = request.get_json(force=True)
        key = f"admin-ip:{request.remote_addr}"
        if login_blocked(key):
            return jsonify({"error": "Trop d'essais : réessayez dans un quart d'heure"}), 429
        if check_admin_password(str(data.get("password") or "")):
            session["admin"] = True
            return jsonify({"ok": True})
        record_login_fail(key)
        return jsonify({"error": "Mot de passe incorrect"}), 401

    @app.post("/api/admin/logout")
    def admin_logout():
        session.pop("admin", None)
        return jsonify({"ok": True})

    @app.get("/api/admin/me")
    def admin_me():
        return jsonify({"admin": bool(session.get("admin"))})

    # ---------------- Admin : stats ----------------

    @app.get("/api/admin/stats")
    @admin_required
    def admin_stats():
        """Tableau de bord : ce qui attend une action, l'activité des 30 derniers jours, et les
        compteurs des pastilles du menu."""
        since = utcnow() - timedelta(days=STATS_DAYS)
        recent_orders = Order.query.filter(Order.created_at >= since).all()
        live = [o for o in recent_orders if o.status != "cancelled"]
        delivered = [o for o in live if o.status == "delivered"]
        today = datetime.now(GABON_TZ).date()
        threshold = int(get_number("low_stock_threshold", 5))

        # Meilleures boutiques du mois : ventes livrées (articles, hors frais de livraison)
        per_shop = {}
        for order in delivered:
            line = per_shop.setdefault(order.shop_id, {"amount": 0, "orders": 0})
            line["amount"] += order.subtotal - (order.discount or 0)
            line["orders"] += 1
        top_shops = []
        for shop_id, line in sorted(per_shop.items(), key=lambda kv: -kv[1]["amount"])[:5]:
            shop = db.session.get(Shop, shop_id) if shop_id else None
            if shop:
                top_shops.append({**shop.summary(), "amount": round(line["amount"]), "orders": line["orders"]})

        pending = Order.query.filter_by(status="pending")
        recent = Order.query.order_by(Order.created_at.desc()).limit(6).all()
        return jsonify(
            {
                # À traiter
                "pending_shops": Shop.query.filter_by(status="pending").count(),
                # Contenus signalés à traiter (un même contenu peut l'être plusieurs fois)
                "open_reports": db.session.query(Report.target, Report.target_id)
                .filter(Report.status == "open")
                .distinct()
                .count(),
                "couriers_to_verify": DeliveryPerson.query.filter_by(verified=False).count(),
                "stock_requests": db.session.query(StockRequest.variant_id).distinct().count(),
                # Colis prêts qu'aucun livreur n'a encore pris
                "waiting_courier": pending.filter(
                    Order.delivery_method == "delivery",
                    Order.ready_at.isnot(None),
                    Order.courier_id.is_(None),
                ).count(),
                # Commandes que les vendeurs doivent encore préparer
                "preparing": pending.filter(Order.ready_at.is_(None)).count(),
                "pending_orders": pending.filter(Order.delivery_method == "delivery").count(),
                "pickup_pending": pending.filter(Order.delivery_method == "pickup").count(),
                "active_deliveries": Order.query.filter_by(status="delivering").count(),
                "low_stock_variants": Variant.query.join(Product, Variant.product_id == Product.id)
                .filter(Product.active.is_(True), Variant.stock <= threshold)
                .count(),
                # Activité des 30 derniers jours
                "period_days": STATS_DAYS,
                "orders_30d": len(live),
                "orders_today": sum(1 for o in live if local_day(o.created_at) == today),
                "sales_30d": round(sum(o.total for o in delivered)),
                "to_collect": round(sum(o.total for o in live if o.status != "delivered")),
                "avg_basket_30d": round(sum(o.total for o in live) / len(live)) if live else 0,
                "new_users_30d": User.query.filter(User.created_at >= since).count(),
                "days": daily_series(live, lambda o: o.total),
                "top_shops": top_shops,
                # Totaux
                "total_orders": Order.query.count(),
                "total_products": Product.query.count(),
                "total_categories": Category.query.count(),
                "total_couriers": DeliveryPerson.query.count(),
                "total_shops": Shop.query.count(),
                "total_users": User.query.count(),
                "recent_orders": [o.to_dict(with_items=False) for o in recent],
            }
        )

    # ---------------- Admin : produits & variantes ----------------

    @app.get("/api/admin/products")
    @admin_required
    def admin_list_products():
        products = Product.query.order_by(Product.created_at.desc()).all()
        return jsonify([p.to_dict() for p in products])

    def apply_product_payload(product, data, demo_fields=False):
        """Champs d'un produit envoyés par l'admin ou par son vendeur.
        Renvoie un message d'erreur, ou None. demo_fields : note et nombre d'avis saisis
        à la main, réservés à l'admin (un vendeur ne s'invente pas des avis)."""
        try:
            for field in ("name", "description", "image_url", "badge"):
                if field in data:
                    setattr(product, field, str(data[field] or "").strip())
            if not product.name:
                return "Nom requis"
            if demo_fields and "rating" in data:
                product.rating = max(0.0, min(5.0, float(data["rating"] or 0)))
            if demo_fields and "reviews_count" in data:
                product.reviews_count = max(0, int(data["reviews_count"] or 0))
            if "clearance" in data:
                product.clearance = bool(data["clearance"])
            if "active" in data:
                product.active = bool(data["active"])
            if "category_id" in data:
                cid = data["category_id"] or None
                if cid and not db.session.get(Category, cid):
                    return "Catégorie invalide"
                product.category_id = cid
            if "variants" in data:
                existing = {v.id: v for v in product.variants}
                keep_ids = set()
                for v in data["variants"] or []:
                    vid = v.get("id")
                    if vid and vid in existing:
                        variant = existing[vid]
                        variant.name = v.get("name", variant.name)
                        variant.price = float(v.get("price", variant.price))
                        variant.old_price = _parse_old_price(v.get("old_price"))
                        variant.stock = int(v.get("stock", variant.stock))
                        variant.sku = v.get("sku", variant.sku)
                        keep_ids.add(vid)
                    else:
                        product.variants.append(_variant_from_payload(v))
                for vid, variant in existing.items():
                    if vid not in keep_ids:
                        product.variants.remove(variant)
                        db.session.delete(variant)
        except (AttributeError, TypeError, ValueError):
            return "Prix, stock ou note invalide"
        if any(v.price < 0 or v.stock < 0 for v in product.variants):
            return "Le prix et le stock ne peuvent pas être négatifs"
        if not product.variants:
            product.variants.append(Variant(name="Standard", price=0.0, stock=0))
        return None

    def official_shop():
        return Shop.query.filter_by(official=True).first()

    @app.post("/api/admin/products")
    @admin_required
    def admin_create_product():
        data = request.get_json(force=True)
        shop = db.session.get(Shop, data.get("shop_id") or 0) or official_shop()
        product = Product(name="", shop_id=shop.id)
        error = apply_product_payload(product, {**data, "name": data.get("name") or ""}, demo_fields=True)
        if error:
            db.session.rollback()
            return jsonify({"error": error}), 400
        db.session.add(product)
        db.session.commit()
        return jsonify(product.to_dict()), 201

    @app.put("/api/admin/products/<int:product_id>")
    @admin_required
    def admin_update_product(product_id):
        product = db.session.get(Product, product_id)
        if not product:
            return jsonify({"error": "Produit introuvable"}), 404
        data = request.get_json(force=True)
        if data.get("shop_id"):
            if not db.session.get(Shop, data["shop_id"]):
                return jsonify({"error": "Boutique invalide"}), 400
            product.shop_id = data["shop_id"]
        error = apply_product_payload(product, data, demo_fields=True)
        if error:
            db.session.rollback()
            return jsonify({"error": error}), 400
        db.session.commit()
        return jsonify(product.to_dict())

    @app.delete("/api/admin/products/<int:product_id>")
    @admin_required
    def admin_delete_product(product_id):
        product = db.session.get(Product, product_id)
        if not product:
            return jsonify({"error": "Produit introuvable"}), 404
        db.session.delete(product)
        db.session.commit()
        return jsonify({"ok": True})

    def _parse_old_price(value):
        if value in (None, "", 0, "0"):
            return None
        try:
            v = float(value)
            return v if v > 0 else None
        except (TypeError, ValueError):
            return None

    def _variant_from_payload(v):
        return Variant(
            name=(v.get("name") or "Standard").strip(),
            price=float(v.get("price", 0)),
            old_price=_parse_old_price(v.get("old_price")),
            stock=int(v.get("stock", 0)),
            sku=v.get("sku", ""),
        )

    # ---------------- Admin : catégories ----------------

    @app.get("/api/admin/categories")
    @admin_required
    def admin_list_categories():
        return jsonify([c.to_dict() for c in Category.query.order_by(Category.name).all()])

    @app.post("/api/admin/categories")
    @admin_required
    def admin_create_category():
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Nom requis"}), 400
        if Category.query.filter_by(name=name).first():
            return jsonify({"error": "Catégorie déjà existante"}), 400
        cat = Category(name=name)
        db.session.add(cat)
        db.session.commit()
        return jsonify(cat.to_dict()), 201

    @app.put("/api/admin/categories/<int:cat_id>")
    @admin_required
    def admin_update_category(cat_id):
        cat = db.session.get(Category, cat_id)
        if not cat:
            return jsonify({"error": "Catégorie introuvable"}), 404
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Nom requis"}), 400
        cat.name = name
        db.session.commit()
        return jsonify(cat.to_dict())

    @app.delete("/api/admin/categories/<int:cat_id>")
    @admin_required
    def admin_delete_category(cat_id):
        cat = db.session.get(Category, cat_id)
        if not cat:
            return jsonify({"error": "Catégorie introuvable"}), 404
        for p in cat.products:
            p.category_id = None
        db.session.delete(cat)
        db.session.commit()
        return jsonify({"ok": True})

    # ---------------- Admin : promos ----------------

    @app.get("/api/admin/promos")
    @admin_required
    def admin_list_promos():
        return jsonify(
            [p.to_dict(admin=True) for p in PromoCode.query.order_by(PromoCode.code).all()]
        )

    @app.post("/api/admin/promos")
    @admin_required
    def admin_create_promo():
        data = request.get_json(force=True)
        code = (data.get("code") or "").strip().upper()
        ptype = data.get("type")
        if not code:
            return jsonify({"error": "Code requis"}), 400
        if ptype not in PROMO_TYPES:
            return jsonify({"error": "Type invalide (percent ou freeship)"}), 400
        if PromoCode.query.filter_by(code=code).first():
            return jsonify({"error": "Ce code existe déjà"}), 400
        promo = PromoCode(
            code=code,
            type=ptype,
            value=float(data.get("value") or 0),
            label=data.get("label", ""),
            active=bool(data.get("active", True)),
        )
        error = _apply_promo_rules(promo, data)
        if error:
            return jsonify({"error": error}), 400
        if promo.type == "percent" and not (0 < promo.value <= 100):
            return jsonify({"error": "Pourcentage invalide (1-100)"}), 400
        db.session.add(promo)
        db.session.commit()
        return jsonify(promo.to_dict(admin=True)), 201

    @app.put("/api/admin/promos/<int:promo_id>")
    @admin_required
    def admin_update_promo(promo_id):
        promo = db.session.get(PromoCode, promo_id)
        if not promo:
            return jsonify({"error": "Code introuvable"}), 404
        data = request.get_json(force=True)
        if "code" in data:
            code = data["code"].strip().upper()
            existing = PromoCode.query.filter_by(code=code).first()
            if existing and existing.id != promo.id:
                return jsonify({"error": "Ce code existe déjà"}), 400
            promo.code = code
        if "type" in data:
            if data["type"] not in PROMO_TYPES:
                return jsonify({"error": "Type invalide"}), 400
            promo.type = data["type"]
        if "value" in data:
            promo.value = float(data["value"] or 0)
        if "label" in data:
            promo.label = data["label"]
        if "active" in data:
            promo.active = bool(data["active"])
        error = _apply_promo_rules(promo, data)
        if error:
            db.session.rollback()
            return jsonify({"error": error}), 400
        if promo.type == "percent" and not (0 < promo.value <= 100):
            db.session.rollback()
            return jsonify({"error": "Pourcentage invalide (1-100)"}), 400
        db.session.commit()
        return jsonify(promo.to_dict(admin=True))

    def _apply_promo_rules(promo, data):
        """Expiration, limite d'utilisations, minimum d'achat, 1 fois par client."""
        if "expires_on" in data:
            raw = (data["expires_on"] or "").strip()
            try:
                promo.expires_on = date.fromisoformat(raw) if raw else None
            except ValueError:
                return "Date d'expiration invalide"
        if "max_uses" in data:
            raw = data["max_uses"]
            if raw in (None, ""):
                promo.max_uses = None
            else:
                try:
                    promo.max_uses = int(raw)
                except (TypeError, ValueError):
                    return "Nombre d'utilisations invalide"
                if promo.max_uses < 1:
                    return "Le nombre d'utilisations doit être d'au moins 1"
        if "min_order" in data:
            try:
                promo.min_order = max(0.0, float(data["min_order"] or 0))
            except (TypeError, ValueError):
                return "Montant minimum invalide"
        if "once_per_customer" in data:
            promo.once_per_customer = bool(data["once_per_customer"])
        return None

    @app.delete("/api/admin/promos/<int:promo_id>")
    @admin_required
    def admin_delete_promo(promo_id):
        promo = db.session.get(PromoCode, promo_id)
        if not promo:
            return jsonify({"error": "Code introuvable"}), 404
        db.session.delete(promo)
        db.session.commit()
        return jsonify({"ok": True})

    # ---------------- Admin : livreurs ----------------

    @app.get("/api/admin/couriers")
    @admin_required
    def admin_list_couriers():
        commission = get_number("delivery_commission")
        result = []
        for c in DeliveryPerson.query.order_by(DeliveryPerson.name).all():
            delivered = Order.query.filter_by(courier_id=c.id, status="delivered").all()
            in_progress = Order.query.filter_by(courier_id=c.id, status="delivering").count()
            rated = [o.courier_rating for o in delivered if o.courier_rating]
            data = c.to_dict()
            data["delivered_count"] = len(delivered)
            data["in_progress_count"] = in_progress
            data["rating_avg"] = round(sum(rated) / len(rated), 1) if rated else None
            data["rating_count"] = len(rated)
            data["earnings"] = round(len(delivered) * commission + c.bonus_total, 2)
            result.append(data)
        return jsonify(result)

    @app.put("/api/admin/couriers/<int:courier_id>")
    @admin_required
    def admin_update_courier(courier_id):
        courier = db.session.get(DeliveryPerson, courier_id)
        if not courier:
            return jsonify({"error": "Livreur introuvable"}), 404
        data = request.get_json(force=True)
        for field in ["name", "phone", "vehicle", "zone"]:
            if field in data:
                setattr(courier, field, str(data[field]).strip())
        if "available" in data:
            courier.available = bool(data["available"])
        if "verified" in data:
            courier.verified = bool(data["verified"])
        if "bonus_add" in data:
            try:
                amount = float(data["bonus_add"])
            except (TypeError, ValueError):
                return jsonify({"error": "Montant de prime invalide"}), 400
            if amount <= 0:
                return jsonify({"error": "Le montant doit être positif"}), 400
            courier.bonus_total += amount
        if data.get("new_password"):
            courier.set_password(data["new_password"])
        db.session.commit()
        return jsonify(courier.to_dict())

    @app.delete("/api/admin/couriers/<int:courier_id>")
    @admin_required
    def admin_delete_courier(courier_id):
        courier = db.session.get(DeliveryPerson, courier_id)
        if not courier:
            return jsonify({"error": "Livreur introuvable"}), 404
        for order in Order.query.filter_by(courier_id=courier.id).all():
            order.courier_id = None
            if order.status == "delivering":
                order.status = "pending"
                order.accepted_at = None
        db.session.delete(courier)
        db.session.commit()
        return jsonify({"ok": True})

    # ---------------- Admin : demandes de stock ----------------

    @app.get("/api/admin/stock-requests")
    @admin_required
    def admin_stock_requests():
        requests = StockRequest.query.order_by(StockRequest.created_at.desc()).all()
        grouped = {}
        for r in requests:
            if not r.variant or not r.variant.product:
                continue
            key = r.variant_id
            if key not in grouped:
                grouped[key] = {
                    "variant_id": r.variant_id,
                    "product_name": r.variant.product.name,
                    "variant_name": r.variant.name,
                    "shop": r.variant.product.shop.summary() if r.variant.product.shop else None,
                    "current_stock": r.variant.stock,
                    "count": 0,
                    "phones": [],
                    "ids": [],
                    "last_at": None,
                }
            g = grouped[key]
            g["count"] += 1
            g["ids"].append(r.id)
            if r.phone:
                g["phones"].append(r.phone)
            if g["last_at"] is None:
                g["last_at"] = r.created_at.isoformat()
        result = sorted(grouped.values(), key=lambda g: -g["count"])
        return jsonify(result)

    @app.delete("/api/admin/stock-requests/<int:request_id>")
    @admin_required
    def admin_delete_stock_request(request_id):
        req = db.session.get(StockRequest, request_id)
        if not req:
            return jsonify({"error": "Demande introuvable"}), 404
        db.session.delete(req)
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/admin/stock-requests/clear-variant/<int:variant_id>")
    @admin_required
    def admin_clear_variant_requests(variant_id):
        StockRequest.query.filter_by(variant_id=variant_id).delete()
        db.session.commit()
        return jsonify({"ok": True})

    # ---------------- Admin : commandes ----------------

    @app.get("/api/admin/orders")
    @admin_required
    def admin_list_orders():
        """Commandes (les 200 plus récentes) : filtre par statut, par boutique, recherche par
        référence, nom ou téléphone du client."""
        status = request.args.get("status")
        shop_id = request.args.get("shop", type=int)
        search = request.args.get("search", "").strip()
        query = Order.query
        if status:
            query = query.filter_by(status=status)
        if shop_id:
            query = query.filter_by(shop_id=shop_id)
        if search:
            conditions = [Order.reference.ilike(f"%{search}%"), Order.customer_name.ilike(f"%{search}%")]
            digits = re.sub(r"\D", "", search)
            if len(digits) >= 3:
                # Téléphone enregistré tel que tapé (« 066 12 34 56 ») : comparer sans espaces
                conditions.append(db.func.replace(Order.customer_phone, " ", "").contains(digits))
            query = query.filter(db.or_(*conditions))
        orders = query.order_by(Order.created_at.desc()).limit(200).all()
        return jsonify([o.to_dict() for o in orders])

    @app.put("/api/admin/orders/<int:order_id>")
    @admin_required
    def admin_update_order(order_id):
        order = db.session.get(Order, order_id)
        if not order:
            return jsonify({"error": "Commande introuvable"}), 404
        data = request.get_json(force=True)
        if data.get("ready"):
            # L'admin peut signaler un colis prêt à la place du vendeur
            order.ready_at = order.ready_at or utcnow()
            if "status" not in data:
                db.session.commit()
                return jsonify(order.to_dict())
        status = data.get("status")
        if status not in ORDER_STATUSES:
            return jsonify({"error": "Statut invalide"}), 400
        if status == "cancelled" and order.status != "cancelled":
            restock(order)
        elif order.status == "cancelled" and status != "cancelled":
            # Réactivation : reprendre le stock, si disponible
            for item in order.items:
                if not item.variant_id:
                    continue
                result = db.session.execute(
                    sa_update(Variant)
                    .where(Variant.id == item.variant_id, Variant.stock >= item.quantity)
                    .values(stock=Variant.stock - item.quantity)
                )
                if result.rowcount == 0:
                    db.session.rollback()
                    return jsonify(
                        {"error": f"Stock insuffisant pour réactiver : {item.product_name} - {item.variant_name}"}
                    ), 400
        previous = order.status
        order.status = status
        now = datetime.now(timezone.utc)
        if status == "delivering" and not order.accepted_at:
            order.accepted_at = now
        if status == "delivered" and not order.delivered_at:
            order.delivered_at = now
        if status != previous:
            pickup = order.delivery_method == "pickup"
            event = {
                "delivering": "ready" if pickup else "delivering",
                "delivered": None if pickup else "delivered",
                "cancelled": "cancelled",
            }.get(status)
            if event:
                order_event(order, event)
        db.session.commit()
        return jsonify(order.to_dict())

    # ---------------- Admin : paramètres ----------------

    SETTINGS_KEYS = [
        "shop_name",
        "shop_phone",
        "pickup_address",
        "currency",
        "low_stock_threshold",
        "delivery_fee",
        "free_shipping_threshold",
        "delivery_commission",
    ]

    NUMERIC_SETTINGS = [
        "low_stock_threshold",
        "delivery_fee",
        "free_shipping_threshold",
        "delivery_commission",
    ]

    @app.get("/api/admin/settings")
    @admin_required
    def admin_get_settings():
        data = {k: get_setting(k) for k in SETTINGS_KEYS}
        data["zones"] = get_zones()
        data["zone_fees"] = get_zone_fees()
        data["sounds_off"] = sounds_off()
        return jsonify(data)

    @app.put("/api/admin/settings")
    @admin_required
    def admin_update_settings():
        import json as _json

        data = request.get_json(force=True)
        if "currency" in data and data["currency"] != "XAF":
            return jsonify({"error": "Devise : seul le franc CFA d'Afrique centrale (XAF) est utilisé"}), 400
        if data.get("new_password") and len(str(data["new_password"])) < 8:
            return jsonify({"error": "Mot de passe admin : 8 caractères minimum"}), 400
        for key in NUMERIC_SETTINGS:
            if key in data:
                try:
                    value = float(data[key])
                except (TypeError, ValueError):
                    return jsonify({"error": f"Valeur numérique invalide pour « {key} »"}), 400
                if value < 0:
                    return jsonify({"error": f"« {key} » ne peut pas être négatif"}), 400
                data[key] = int(value) if key == "low_stock_threshold" else value
        for key in SETTINGS_KEYS:
            if key in data:
                set_setting(key, data[key])
        if "pickup_address" in data:
            # Retrait en boutique officielle : c'est l'adresse donnée au client et au livreur
            official = Shop.query.filter_by(official=True).first()
            if official:
                official.address = str(data["pickup_address"] or "").strip()
        if "sounds_off" in data:
            keys = [k for k in (data["sounds_off"] or []) if k in SOUND_KEYS]
            set_setting("sounds_off", _json.dumps(keys))
        if "zone_fees" in data:
            fees = {}
            for zone_name, value in (data["zone_fees"] or {}).items():
                if value in (None, ""):
                    continue  # pas de tarif propre : frais par défaut
                try:
                    amount = float(value)
                except (TypeError, ValueError):
                    return jsonify({"error": f"Frais invalides pour « {zone_name} »"}), 400
                if amount < 0:
                    return jsonify({"error": f"Frais négatifs pour « {zone_name} »"}), 400
                fees[str(zone_name).strip()] = amount
        else:
            fees = None
        if "zones" in data:
            zones = [str(z).strip() for z in (data["zones"] or []) if str(z).strip()]
            set_setting("zones", _json.dumps(zones, ensure_ascii=False))
        else:
            zones = get_zones()
        if fees is not None or "zones" in data:
            # Ne garder que les tarifs des zones qui existent encore
            current = fees if fees is not None else get_zone_fees()
            set_setting(
                "zone_fees",
                _json.dumps({z: f for z, f in current.items() if z in zones}, ensure_ascii=False),
            )
        if data.get("new_password"):
            set_setting("admin_password", generate_password_hash(str(data["new_password"])))
        db.session.commit()
        return jsonify({"ok": True})

    frontend_dir = os.environ.get("FRONTEND_DIR")
    if frontend_dir and os.path.isdir(frontend_dir):

        index_path = os.path.join(frontend_dir, "index.html")

        def page_meta(path):
            """Titre / description / image de la page, pour les aperçus de liens
            (WhatsApp, Facebook…) : ces robots ne lisent pas le JavaScript."""
            shop = get_setting("shop_name") or "Boutique"
            meta = {
                "title": f"{shop} — Livraison à Libreville",
                "description": "Commandez en ligne et faites-vous livrer à Libreville. "
                "Paiement à la livraison, suivi du livreur en temps réel.",
                "image": request.url_root.rstrip("/") + "/og-image.png",
                "type": "website",
            }
            # Page d'une boutique : son nom, sa présentation et sa couverture (ou son logo)
            shop_match = re.fullmatch(r"b/([a-z0-9-]+)", path)
            seller = (
                Shop.query.filter_by(slug=shop_match.group(1), status="active").first() if shop_match else None
            )
            if seller:
                meta["title"] = f"{seller.name} | {shop}"
                desc = (seller.description or "").strip()
                meta["description"] = (
                    (desc[:180] + "…")
                    if len(desc) > 180
                    else desc or f"Découvrez la boutique {seller.name} sur {shop} : livraison à Libreville."
                )
                image = seller.cover_url or seller.logo_url
                if image:
                    meta["image"] = image if image.startswith("http") else request.url_root.rstrip("/") + image
                meta["type"] = "profile"
            match = re.fullmatch(r"products/(\d+)", path)
            product = db.session.get(Product, int(match.group(1))) if match else None
            if product and product.active and product.shop and product.shop.status == "active":
                prices = [v.price for v in product.variants] or [0]
                price = _fmt_money(min(prices))
                if max(prices) != min(prices):
                    price = "dès " + price
                meta["title"] = f"{product.name} — {price} | {shop}"
                desc = (product.description or "").strip()
                meta["description"] = (desc[:180] + "…") if len(desc) > 180 else desc or meta["description"]
                if product.image_url:
                    meta["image"] = (
                        product.image_url
                        if product.image_url.startswith("http")
                        else request.url_root.rstrip("/") + product.image_url
                    )
                meta["type"] = "product"
            return meta

        def render_index(path):
            with open(index_path, encoding="utf-8") as f:
                page = f.read()
            m = {k: html.escape(v, quote=True) for k, v in page_meta(path).items()}
            tags = (
                f'<meta name="description" content="{m["description"]}" />\n'
                f'    <meta property="og:type" content="{m["type"]}" />\n'
                f'    <meta property="og:title" content="{m["title"]}" />\n'
                f'    <meta property="og:description" content="{m["description"]}" />\n'
                f'    <meta property="og:image" content="{m["image"]}" />\n'
                f'    <meta property="og:url" content="{html.escape(request.base_url, quote=True)}" />\n'
                f'    <meta name="twitter:card" content="summary_large_image" />\n'
            )
            page = re.sub(r"<title>.*?</title>", f"<title>{m['title']}</title>", page, count=1)
            page = page.replace("</head>", f"    {tags}  </head>", 1)
            return page, 200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache"}

        @app.route("/")
        @app.route("/<path:path>")
        def serve_frontend(path=""):
            if path.startswith("api/"):
                return jsonify({"error": "Introuvable"}), 404
            if path and os.path.isfile(os.path.join(frontend_dir, path)):
                return send_from_directory(frontend_dir, path)
            return render_index(path)

    with app.app_context():
        db.create_all()
        _migrate_schema()
        for key, value in DEFAULT_SETTINGS.items():
            if db.session.get(Setting, key) is None:
                db.session.add(Setting(key=key, value=value))
        old_default_zones = ["Centre-ville", "Nord", "Sud", "Est", "Ouest"]
        if get_zones() == old_default_zones:
            import json as _json

            set_setting("zones", _json.dumps(LIBREVILLE_ZONES, ensure_ascii=False))
        if get_setting("currency") == "XOF":
            set_setting("currency", "XAF")
        # Boutique officielle de la plateforme : reçoit les produits d'avant le hub
        official = Shop.query.filter_by(official=True).first()
        if not official:
            official = Shop(
                slug=unique_slug("241 Shop"),
                name="241 Shop",
                description="La boutique officielle de la plateforme.",
                whatsapp=get_setting("shop_phone"),
                address=get_setting("pickup_address"),
                status="active",
                official=True,
                validated_at=datetime.now(timezone.utc),
            )
            db.session.add(official)
            db.session.flush()
        Product.query.filter(Product.shop_id.is_(None)).update(
            {"shop_id": official.id}, synchronize_session=False
        )
        # Commandes d'avant le hub : boutique officielle, déjà prêtes pour les livreurs
        Order.query.filter(Order.shop_id.is_(None)).update(
            {"shop_id": official.id, "ready_at": Order.created_at}, synchronize_session=False
        )
        Notification.query.filter(Notification.created_at < utcnow() - timedelta(days=90)).delete()
        # Véhicules enregistrés avec un emoji (« 🛵 Scooter ») avant qu'ils soient retirés du site
        for courier in DeliveryPerson.query.all():
            cleaned = re.sub(r"^\W+", "", courier.vehicle or "")
            if cleaned != (courier.vehicle or ""):
                courier.vehicle = cleaned
        db.session.commit()

    return app


def _migrate_schema():
    additions = [
        ("products", "clearance", "clearance BOOLEAN NOT NULL DEFAULT 0"),
        ("orders", "latitude", "latitude FLOAT"),
        ("orders", "landmark", "landmark TEXT"),
        ("promo_codes", "expires_on", "expires_on DATE"),
        ("promo_codes", "max_uses", "max_uses INTEGER"),
        ("promo_codes", "min_order", "min_order FLOAT NOT NULL DEFAULT 0"),
        ("promo_codes", "once_per_customer", "once_per_customer BOOLEAN NOT NULL DEFAULT 0"),
        ("orders", "longitude", "longitude FLOAT"),
        ("orders", "delivery_method", "delivery_method VARCHAR(20) NOT NULL DEFAULT 'delivery'"),
        ("orders", "delivery_code", "delivery_code VARCHAR(6) NOT NULL DEFAULT ''"),
        ("orders", "courier_rating", "courier_rating INTEGER"),
        ("orders", "courier_comment", "courier_comment TEXT"),
        ("delivery_persons", "last_lat", "last_lat FLOAT"),
        ("delivery_persons", "last_lng", "last_lng FLOAT"),
        ("delivery_persons", "position_at", "position_at DATETIME"),
        ("delivery_persons", "verified", "verified BOOLEAN NOT NULL DEFAULT 0"),
        ("delivery_persons", "bonus_total", "bonus_total FLOAT NOT NULL DEFAULT 0"),
        ("products", "shop_id", "shop_id INTEGER REFERENCES shops(id)"),
        ("orders", "shop_id", "shop_id INTEGER REFERENCES shops(id)"),
        ("orders", "ready_at", "ready_at DATETIME"),
        ("orders", "user_id", "user_id INTEGER REFERENCES users(id)"),
    ]
    for table, column, ddl in additions:
        cols = [r[1] for r in db.session.execute(db.text(f"PRAGMA table_info({table})"))]
        if column not in cols:
            db.session.execute(db.text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
    db.session.commit()


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
