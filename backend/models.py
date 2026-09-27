import json
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    products = db.relationship("Product", back_populates="category")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "product_count": len(self.products)}


class Product(db.Model):
    __tablename__ = "products"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    image_url = db.Column(db.String(500), default="")
    emoji = db.Column(db.String(16), default="")
    badge = db.Column(db.String(30), default="")
    rating = db.Column(db.Float, default=0)
    reviews_count = db.Column(db.Integer, default=0)
    clearance = db.Column(db.Boolean, default=False, nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    category = db.relationship("Category", back_populates="products")
    variants = db.relationship(
        "Variant", back_populates="product", cascade="all, delete-orphan", order_by="Variant.id"
    )
    reviews = db.relationship(
        "Review", back_populates="product", cascade="all, delete-orphan", order_by="Review.created_at.desc()"
    )

    def to_dict(self, with_variants=True):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "image_url": self.image_url,
            "emoji": self.emoji,
            "badge": self.badge,
            "rating": self.rating,
            "reviews_count": self.reviews_count,
            "clearance": self.clearance,
            "active": self.active,
            "created_at": self.created_at.isoformat(),
            "category_id": self.category_id,
            "category": self.category.name if self.category else None,
        }
        if with_variants:
            data["variants"] = [v.to_dict() for v in self.variants]
            prices = [v.price for v in self.variants]
            data["price_min"] = min(prices) if prices else 0
            data["price_max"] = max(prices) if prices else 0
            data["total_stock"] = sum(v.stock for v in self.variants)
            discounts = [
                round((1 - v.price / v.old_price) * 100)
                for v in self.variants
                if v.old_price and v.old_price > v.price
            ]
            data["promo_percent"] = max(discounts) if discounts else 0
            if self.reviews:
                data["real_rating"] = round(sum(r.rating for r in self.reviews) / len(self.reviews), 1)
                data["real_reviews_count"] = len(self.reviews)
            else:
                data["real_rating"] = None
                data["real_reviews_count"] = 0
        return data


class Variant(db.Model):
    __tablename__ = "variants"
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    price = db.Column(db.Float, nullable=False)
    old_price = db.Column(db.Float, nullable=True)
    stock = db.Column(db.Integer, default=0, nullable=False)
    sku = db.Column(db.String(80), default="")
    product = db.relationship("Product", back_populates="variants")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "name": self.name,
            "price": self.price,
            "old_price": self.old_price,
            "stock": self.stock,
            "sku": self.sku,
        }


class PromoCode(db.Model):
    __tablename__ = "promo_codes"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(40), unique=True, nullable=False)
    type = db.Column(db.String(20), nullable=False)  # percent | freeship
    value = db.Column(db.Float, default=0)
    label = db.Column(db.String(200), default="")
    active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "type": self.type,
            "value": self.value,
            "label": self.label,
            "active": self.active,
        }


class Review(db.Model):
    __tablename__ = "reviews"
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    customer_name = db.Column(db.String(200), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, default="")
    photo_url = db.Column(db.String(500), default="")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    product = db.relationship("Product", back_populates="reviews")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "customer_name": self.customer_name,
            "rating": self.rating,
            "comment": self.comment,
            "photo_url": self.photo_url,
            "created_at": self.created_at.isoformat(),
        }


class StockRequest(db.Model):
    __tablename__ = "stock_requests"
    id = db.Column(db.Integer, primary_key=True)
    variant_id = db.Column(db.Integer, db.ForeignKey("variants.id"), nullable=False)
    phone = db.Column(db.String(40), default="")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    variant = db.relationship("Variant")

    def to_dict(self):
        return {
            "id": self.id,
            "variant_id": self.variant_id,
            "product_name": self.variant.product.name if self.variant and self.variant.product else "",
            "variant_name": self.variant.name if self.variant else "",
            "current_stock": self.variant.stock if self.variant else 0,
            "phone": self.phone,
            "created_at": self.created_at.isoformat(),
        }


class DeliveryPerson(db.Model):
    __tablename__ = "delivery_persons"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(40), unique=True, nullable=False)
    password_hash = db.Column(db.String(300), nullable=False)
    vehicle = db.Column(db.String(60), default="")
    zone = db.Column(db.String(120), default="")
    available = db.Column(db.Boolean, default=True, nullable=False)
    verified = db.Column(db.Boolean, default=False, nullable=False)
    bonus_total = db.Column(db.Float, default=0, nullable=False)
    last_lat = db.Column(db.Float, nullable=True)
    last_lng = db.Column(db.Float, nullable=True)
    position_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "vehicle": self.vehicle,
            "zone": self.zone,
            "available": self.available,
            "verified": self.verified,
            "bonus_total": self.bonus_total,
            "last_lat": self.last_lat,
            "last_lng": self.last_lng,
            "position_at": self.position_at.isoformat() if self.position_at else None,
            "created_at": self.created_at.isoformat(),
        }


class Order(db.Model):
    __tablename__ = "orders"
    id = db.Column(db.Integer, primary_key=True)
    reference = db.Column(db.String(20), unique=True, nullable=False)
    customer_name = db.Column(db.String(200), nullable=False)
    customer_email = db.Column(db.String(200), default="")
    customer_phone = db.Column(db.String(40), nullable=False)
    customer_address = db.Column(db.Text, default="")
    zone = db.Column(db.String(120), default="")
    note = db.Column(db.Text, default="")
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    payment_method = db.Column(db.String(20), default="livraison")  # livraison | carte
    delivery_method = db.Column(db.String(20), default="delivery", nullable=False)  # delivery | pickup
    delivery_code = db.Column(db.String(6), default="")
    status = db.Column(db.String(30), default="pending", nullable=False)
    subtotal = db.Column(db.Float, default=0)
    discount = db.Column(db.Float, default=0)
    delivery_fee = db.Column(db.Float, default=0)
    total = db.Column(db.Float, default=0, nullable=False)
    promo_code = db.Column(db.String(40), nullable=True)
    courier_id = db.Column(db.Integer, db.ForeignKey("delivery_persons.id"), nullable=True)
    courier = db.relationship("DeliveryPerson")
    courier_rating = db.Column(db.Integer, nullable=True)
    courier_comment = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    accepted_at = db.Column(db.DateTime, nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    def to_dict(self, with_items=True, with_courier=False):
        data = {
            "id": self.id,
            "reference": self.reference,
            "customer_name": self.customer_name,
            "customer_email": self.customer_email,
            "customer_phone": self.customer_phone,
            "customer_address": self.customer_address,
            "zone": self.zone,
            "note": self.note,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "payment_method": self.payment_method,
            "delivery_method": self.delivery_method,
            "delivery_code": self.delivery_code,
            "status": self.status,
            "subtotal": self.subtotal,
            "discount": self.discount,
            "delivery_fee": self.delivery_fee,
            "total": self.total,
            "promo_code": self.promo_code,
            "courier_rating": self.courier_rating,
            "courier_comment": self.courier_comment,
            "created_at": self.created_at.isoformat(),
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
        }
        if with_items:
            data["items"] = [i.to_dict() for i in self.items]
        if with_courier:
            data["courier"] = (
                {
                    "name": self.courier.name,
                    "phone": self.courier.phone,
                    "vehicle": self.courier.vehicle,
                    "zone": self.courier.zone,
                    "lat": self.courier.last_lat,
                    "lng": self.courier.last_lng,
                }
                if self.courier
                else None
            )
        elif self.courier:
            data["courier_name"] = self.courier.name
        return data


class OrderItem(db.Model):
    __tablename__ = "order_items"
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey("variants.id"), nullable=True)
    product_name = db.Column(db.String(200), nullable=False)
    variant_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    order = db.relationship("Order", back_populates="items")

    def to_dict(self):
        variant = db.session.get(Variant, self.variant_id) if self.variant_id else None
        return {
            "id": self.id,
            "variant_id": self.variant_id,
            "product_id": variant.product_id if variant else None,
            "product_name": self.product_name,
            "variant_name": self.variant_name,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "line_total": round(self.quantity * self.unit_price, 2),
        }


class Setting(db.Model):
    __tablename__ = "settings"
    key = db.Column(db.String(80), primary_key=True)
    value = db.Column(db.Text, default="")


LIBREVILLE_ZONES = [
    "Centre-ville",
    "Mont-Bouët",
    "Glass",
    "Oloumi",
    "Quartier Louis",
    "Batterie IV",
    "Akébé",
    "Nzeng-Ayong",
    "Lalala",
    "Ozoungué",
    "Alibandeng",
    "La Sablière",
    "Angondjé",
    "Owendo",
    "Nkok",
    "Cap Estérias",
]

DEFAULT_SETTINGS = {
    "shop_name": "MaBoutique",
    "shop_phone": "074756768",
    "pickup_address": "Centre-ville, Libreville (près du Marché Mont-Bouët)",
    "currency": "XAF",
    "admin_password": "admin123",
    "low_stock_threshold": "5",
    "delivery_fee": "2000",
    "free_shipping_threshold": "30000",
    "delivery_commission": "2000",
    "zones": json.dumps(LIBREVILLE_ZONES, ensure_ascii=False),
}


def get_setting(key, default=""):
    s = db.session.get(Setting, key)
    if s is not None:
        return s.value
    return DEFAULT_SETTINGS.get(key, default)


def get_number(key, default=0.0):
    """Paramètre numérique ; une valeur corrompue ne doit pas faire planter le site."""
    try:
        return float(get_setting(key, default))
    except (TypeError, ValueError):
        return float(default)


def get_zones():
    try:
        return json.loads(get_setting("zones", "[]"))
    except (json.JSONDecodeError, TypeError):
        return []


def set_setting(key, value):
    s = db.session.get(Setting, key)
    if s is None:
        s = Setting(key=key, value=str(value))
        db.session.add(s)
    else:
        s.value = str(value)
    return s
