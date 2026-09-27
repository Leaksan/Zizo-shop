import hmac
import os
import random
import string
import threading
import uuid
from datetime import datetime, timezone
from functools import wraps
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json as _json_std

from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS
from PIL import Image
from sqlalchemy import update as sa_update

from models import (
    Category,
    DeliveryPerson,
    Order,
    OrderItem,
    Product,
    PromoCode,
    Review,
    Setting,
    StockRequest,
    Variant,
    db,
    get_number,
    get_setting,
    get_zones,
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
                f"👤 {order.customer_name} — {order.customer_phone}",
            ]
            if order.delivery_method == "pickup":
                lines.append("🛍️ *RETRAIT EN BOUTIQUE*")
            else:
                lines.append(f"📍 {order.customer_address} ({order.zone})")
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

    db.init_app(app)

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

    # Tentatives ratées de code de livraison, par commande (anti-devinette).
    CODE_FAILS = {}
    MAX_CODE_FAILS = 5

    def courier_order_dict(order):
        """Commande vue par un livreur : jamais le code de livraison."""
        data = order.to_dict()
        data.pop("delivery_code", None)
        return data

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
        req = Request(url, headers={"User-Agent": "MaBoutique-Libreville/1.0"})
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
        query = Product.query.filter_by(active=True)
        category_id = request.args.get("category", type=int)
        search = request.args.get("search", "").strip()
        if category_id:
            query = query.filter_by(category_id=category_id)
        if search:
            like = f"%{search}%"
            query = query.filter(Product.name.ilike(like) | Product.description.ilike(like))
        products = query.order_by(Product.created_at.desc()).all()
        return jsonify([p.to_dict() for p in products])

    @app.get("/api/products/<int:product_id>")
    def get_product(product_id):
        product = db.session.get(Product, product_id)
        if not product or not product.active:
            return jsonify({"error": "Produit introuvable"}), 404
        return jsonify(product.to_dict())

    @app.get("/api/categories")
    def list_categories():
        cats = Category.query.order_by(Category.name).all()
        return jsonify(
            [
                {
                    "id": c.id,
                    "name": c.name,
                    "product_count": Product.query.filter_by(category_id=c.id, active=True).count(),
                }
                for c in cats
            ]
        )

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
        return jsonify(promo.to_dict())

    # ---------------- Public : commandes ----------------

    @app.post("/api/orders")
    def create_order():
        data = request.get_json(force=True)
        name = (data.get("customer_name") or "").strip()
        phone = (data.get("customer_phone") or "").strip()
        email = (data.get("customer_email") or "").strip()
        address = (data.get("customer_address") or "").strip()
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

        order = Order(
            reference=generate_reference(),
            customer_name=name,
            customer_email=email,
            customer_phone=phone,
            customer_address=address,
            zone=zone,
            note=note,
            latitude=latitude,
            longitude=longitude,
            payment_method=payment,
            delivery_method=delivery_method,
            delivery_code="".join(random.choices(string.digits, k=4)),
            promo_code=promo.code if promo else None,
        )
        subtotal = 0.0
        if not isinstance(items, list):
            return jsonify({"error": "Panier invalide"}), 400
        for item in items:
            try:
                variant_id = int(item.get("variant_id"))
                qty = int(item.get("quantity", 0))
            except (AttributeError, TypeError, ValueError):
                return jsonify({"error": "Article invalide"}), 400
            variant = db.session.get(Variant, variant_id)
            if not variant or not variant.product.active:
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
                return jsonify(
                    {"error": f"Stock insuffisant pour {variant.product.name} - {variant.name}"}
                ), 400
            db.session.refresh(variant)
            order.items.append(
                OrderItem(
                    variant_id=variant.id,
                    product_name=variant.product.name,
                    variant_name=variant.name,
                    quantity=qty,
                    unit_price=variant.price,
                )
            )
            subtotal += variant.price * qty

        discount = 0.0
        free_ship = False
        if promo:
            if promo.type == "percent":
                discount = subtotal * promo.value / 100
            elif promo.type == "freeship":
                free_ship = True
        base = subtotal - discount
        threshold = get_number("free_shipping_threshold")
        fee = get_number("delivery_fee")
        delivery_fee = (
            0.0
            if delivery_method == "pickup"
            or free_ship
            or (threshold and base >= threshold)
            else fee
        )

        order.subtotal = round(subtotal, 2)
        order.discount = round(discount, 2)
        order.delivery_fee = round(delivery_fee, 2)
        order.total = round(base + delivery_fee, 2)
        db.session.add(order)
        db.session.commit()
        notify_whatsapp_order(order)
        return jsonify(order.to_dict()), 201

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
        products = Product.query.filter_by(active=True).all()
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
            available = (
                Order.query.filter_by(
                    status="pending", courier_id=None, delivery_method="delivery"
                )
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
        db.session.commit()
        return jsonify(courier_order_dict(db.session.get(Order, order_id)))

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
        db.session.commit()
        return jsonify(courier_order_dict(order))

    # ---------------- Fichiers (images) ----------------

    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}

    @app.get("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(upload_dir, filename)

    @app.post("/api/admin/upload")
    @admin_required
    def admin_upload():
        file = request.files.get("file")
        if not file or not file.filename:
            return jsonify({"error": "Aucun fichier envoyé"}), 400
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({"error": "Format non supporté (png, jpg, webp, gif)"}), 400
        try:
            img = Image.open(file.stream)
            img.load()
        except Exception:
            return jsonify({"error": "Fichier image illisible"}), 400
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGBA")
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = background
        else:
            img = img.convert("RGB")
        img.thumbnail((900, 900), Image.LANCZOS)
        filename = f"{uuid.uuid4().hex}.jpg"
        img.save(os.path.join(upload_dir, filename), "JPEG", quality=86, optimize=True)
        return jsonify({"url": f"/uploads/{filename}"}), 201

    # ---------------- Admin : auth ----------------

    @app.post("/api/admin/login")
    def admin_login():
        data = request.get_json(force=True)
        expected = get_setting("admin_password")
        supplied = str(data.get("password") or "")
        if hmac.compare_digest(supplied.encode(), expected.encode()):
            session["admin"] = True
            return jsonify({"ok": True})
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
        orders = Order.query.all()
        revenue = sum(o.total for o in orders if o.status != "cancelled")
        threshold = int(get_number("low_stock_threshold", 5))
        low_stock = Variant.query.filter(Variant.stock <= threshold).count()
        recent = Order.query.order_by(Order.created_at.desc()).limit(5).all()
        return jsonify(
            {
                "total_products": Product.query.count(),
                "total_orders": len(orders),
                "pending_orders": Order.query.filter_by(
                    status="pending", delivery_method="delivery"
                ).count(),
                "pickup_pending": Order.query.filter_by(
                    status="pending", delivery_method="pickup"
                ).count(),
                "active_deliveries": Order.query.filter_by(status="delivering").count(),
                "revenue": round(revenue, 2),
                "total_categories": Category.query.count(),
                "total_couriers": DeliveryPerson.query.count(),
                "low_stock_variants": low_stock,
                "recent_orders": [o.to_dict(with_items=False) for o in recent],
            }
        )

    # ---------------- Admin : produits & variantes ----------------

    @app.get("/api/admin/products")
    @admin_required
    def admin_list_products():
        products = Product.query.order_by(Product.created_at.desc()).all()
        return jsonify([p.to_dict() for p in products])

    @app.post("/api/admin/products")
    @admin_required
    def admin_create_product():
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Nom requis"}), 400
        product = Product(
            name=name,
            description=data.get("description", ""),
            image_url=data.get("image_url", ""),
            emoji=data.get("emoji", ""),
            badge=data.get("badge", ""),
            rating=float(data.get("rating") or 0),
            reviews_count=int(data.get("reviews_count") or 0),
            clearance=bool(data.get("clearance", False)),
            active=bool(data.get("active", True)),
            category_id=data.get("category_id"),
        )
        if product.category_id:
            if not db.session.get(Category, product.category_id):
                return jsonify({"error": "Catégorie invalide"}), 400
        for v in data.get("variants") or []:
            product.variants.append(_variant_from_payload(v))
        if not product.variants:
            product.variants.append(Variant(name="Standard", price=0.0, stock=0))
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
        for field, cast in [
            ("name", str),
            ("description", str),
            ("image_url", str),
            ("emoji", str),
            ("badge", str),
        ]:
            if field in data:
                setattr(product, field, cast(data[field] or ""))
        if "rating" in data:
            product.rating = max(0.0, min(5.0, float(data["rating"] or 0)))
        if "reviews_count" in data:
            product.reviews_count = max(0, int(data["reviews_count"] or 0))
        if "clearance" in data:
            product.clearance = bool(data["clearance"])
        if "active" in data:
            product.active = bool(data["active"])
        if "category_id" in data:
            cid = data["category_id"]
            if cid and not db.session.get(Category, cid):
                return jsonify({"error": "Catégorie invalide"}), 400
            product.category_id = cid or None

        if "variants" in data:
            incoming = data["variants"] or []
            existing = {v.id: v for v in product.variants}
            keep_ids = set()
            for v in incoming:
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
                    db.session.delete(variant)
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
        return jsonify([p.to_dict() for p in PromoCode.query.order_by(PromoCode.code).all()])

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
        if promo.type == "percent" and not (0 < promo.value <= 100):
            return jsonify({"error": "Pourcentage invalide (1-100)"}), 400
        db.session.add(promo)
        db.session.commit()
        return jsonify(promo.to_dict()), 201

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
        if promo.type == "percent" and not (0 < promo.value <= 100):
            return jsonify({"error": "Pourcentage invalide (1-100)"}), 400
        db.session.commit()
        return jsonify(promo.to_dict())

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
        status = request.args.get("status")
        query = Order.query
        if status:
            query = query.filter_by(status=status)
        orders = query.order_by(Order.created_at.desc()).all()
        return jsonify([o.to_dict() for o in orders])

    @app.put("/api/admin/orders/<int:order_id>")
    @admin_required
    def admin_update_order(order_id):
        order = db.session.get(Order, order_id)
        if not order:
            return jsonify({"error": "Commande introuvable"}), 404
        data = request.get_json(force=True)
        status = data.get("status")
        if status not in ORDER_STATUSES:
            return jsonify({"error": "Statut invalide"}), 400
        if status == "cancelled" and order.status != "cancelled":
            # Remettre en stock les articles de la commande annulée
            for item in order.items:
                if item.variant_id:
                    db.session.execute(
                        sa_update(Variant)
                        .where(Variant.id == item.variant_id)
                        .values(stock=Variant.stock + item.quantity)
                    )
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
        order.status = status
        now = datetime.now(timezone.utc)
        if status == "delivering" and not order.accepted_at:
            order.accepted_at = now
        if status == "delivered" and not order.delivered_at:
            order.delivered_at = now
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
        return jsonify(data)

    @app.put("/api/admin/settings")
    @admin_required
    def admin_update_settings():
        import json as _json

        data = request.get_json(force=True)
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
        if "zones" in data:
            zones = [z.strip() for z in (data["zones"] or []) if str(z).strip()]
            set_setting("zones", _json.dumps(zones, ensure_ascii=False))
        if data.get("new_password"):
            set_setting("admin_password", data["new_password"])
        db.session.commit()
        return jsonify({"ok": True})

    frontend_dir = os.environ.get("FRONTEND_DIR")
    if frontend_dir and os.path.isdir(frontend_dir):

        @app.route("/")
        @app.route("/<path:path>")
        def serve_frontend(path=""):
            if path and os.path.isfile(os.path.join(frontend_dir, path)):
                return send_from_directory(frontend_dir, path)
            return send_from_directory(frontend_dir, "index.html")

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
        db.session.commit()

    return app


def _migrate_schema():
    additions = [
        ("products", "clearance", "clearance BOOLEAN NOT NULL DEFAULT 0"),
        ("orders", "latitude", "latitude FLOAT"),
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
    ]
    for table, column, ddl in additions:
        cols = [r[1] for r in db.session.execute(db.text(f"PRAGMA table_info({table})"))]
        if column not in cols:
            db.session.execute(db.text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
    db.session.commit()


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
