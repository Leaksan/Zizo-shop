from app import app
from models import (
    Category,
    DeliveryPerson,
    Order,
    OrderItem,
    Product,
    PromoCode,
    Variant,
    db,
)

def fcfa(eur):
    return round(eur * 655.957 / 100) * 100


def img(photo_id):
    return f"https://images.unsplash.com/photo-{photo_id}?w=800&auto=format&fit=crop&q=80"


PRODUCTS = [
    dict(name="Écouteurs Sans Fil Pro", cat="Électronique", emoji="🎧", badge="Promo",
         image=img("1505740420928-5e560c06d30e"),
         rating=4.5, reviews=128,
         desc="Écouteurs Bluetooth 5.3 avec réduction de bruit, boîtier de charge 24 h et micro intégré.",
         variants=[dict(name="Standard", price=fcfa(29.99), old=fcfa(39.99), stock=15, sku="ECO-STD")]),
    dict(name="Montre Connectée Fit", cat="Électronique", emoji="⌚", badge="Nouveau",
         image=img("1523275335684-37898b6baf30"),
         rating=4.2, reviews=86,
         desc="Suivi d'activité, fréquence cardiaque, notifications et 7 jours d'autonomie.",
         variants=[dict(name="Standard", price=fcfa(49.99), old=None, stock=10, sku="MON-STD")]),
    dict(name="Enceinte Bluetooth 360", cat="Électronique", emoji="🔊", badge="Top vente",
         image=img("1608043152269-423dbba4e7e1"),
         rating=4.6, reviews=203,
         desc="Son puissant à 360°, étanche IPX7, 12 h d'écoute, idéale pour l'extérieur.",
         variants=[dict(name="Noir", price=fcfa(39.99), old=None, stock=8, sku="ENC-NOIR"),
                   dict(name="Blanc", price=fcfa(39.99), old=None, stock=6, sku="ENC-BLANC")]),
    dict(name="Smartphone Nova X", cat="Électronique", emoji="📱", badge="Promo",
         image=img("1511707171634-5f897ff02aa9"),
         rating=4.7, reviews=312,
         desc="Écran 6,5\" 120 Hz, double capteur 50 Mpx et charge rapide 33 W.",
         variants=[dict(name="128 Go", price=fcfa(299.00), old=fcfa(349.00), stock=5, sku="SMA-128"),
                   dict(name="256 Go", price=fcfa(349.00), old=fcfa(399.00), stock=3, sku="SMA-256")]),
    dict(name="Sneakers Urban", cat="Mode", emoji="👟", badge="Top vente",
         image=img("1542291026-7eec264c27ff"),
         rating=4.4, reviews=167,
         desc="Baskets confortables en mesh respirant, semelle amortissante.",
         variants=[dict(name=f"Pointure {p}", price=fcfa(59.99), old=None, stock=4, sku=f"SNK-{p}")
                   for p in (39, 40, 41, 42, 43, 44)] +
                  [dict(name=f"Pointure {p}", price=fcfa(64.99), old=None, stock=2, sku=f"SNK-{p}")
                   for p in (45, 46)]),
    dict(name="Sac à Dos Voyage", cat="Mode", emoji="🎒", badge="Promo",
         image=img("1553062407-98eeb64c6a62"),
         rating=4.3, reviews=94,
         desc="Sac 25 L avec poche ordinateur 15\", tissu imperméable et dos renforcé.",
         variants=[dict(name="Standard", price=fcfa(34.99), old=fcfa(44.99), stock=12, sku="SAC-STD")]),
    dict(name="Lunettes de Soleil", cat="Mode", emoji="🕶️", badge="", clearance=True,
         image=img("1572635196237-14b3f281503f"),
         rating=4.1, reviews=58,
         desc="Protection UV400, monture ultra-légère, étui rigide offert.",
         variants=[dict(name="Standard", price=6500, old=fcfa(19.99), stock=25, sku="LUN-STD")]),
    dict(name="T-Shirt Coton Bio", cat="Mode", emoji="👕", badge="",
         image=img("1521572163474-6864f9cf17ab"),
         rating=4.0, reviews=73,
         desc="T-shirt 100 % coton bio, coupe unisexe.",
         variants=[dict(name="Blanc / S", price=fcfa(14.99), old=None, stock=8, sku="TSH-BLA-S"),
                   dict(name="Blanc / M", price=fcfa(14.99), old=None, stock=10, sku="TSH-BLA-M"),
                   dict(name="Blanc / L", price=fcfa(16.99), old=None, stock=6, sku="TSH-BLA-L"),
                   dict(name="Noir / S", price=fcfa(14.99), old=None, stock=8, sku="TSH-NOI-S"),
                   dict(name="Noir / M", price=fcfa(14.99), old=None, stock=10, sku="TSH-NOI-M"),
                   dict(name="Noir / L", price=fcfa(16.99), old=None, stock=6, sku="TSH-NOI-L")]),
    dict(name="Lampe LED Ambiance", cat="Maison", emoji="💡", badge="Nouveau",
         image=img("1507473885765-e6ed057f782c"),
         rating=4.5, reviews=112,
         desc="16 millions de couleurs, contrôle par application et minuterie intégrée.",
         variants=[dict(name="Standard", price=fcfa(24.99), old=None, stock=18, sku="LAM-STD")]),
    dict(name="Plante Monstera", cat="Maison", emoji="🪴", badge="Top vente",
         image=img("1485955900006-10f4d324d411"),
         rating=4.8, reviews=145,
         desc="Plante d'intérieur facile d'entretien, pot inclus.",
         variants=[dict(name="40 cm", price=fcfa(12.99), old=None, stock=14, sku="PLA-40"),
                   dict(name="60 cm", price=fcfa(19.99), old=None, stock=6, sku="PLA-60")]),
    dict(name="Bougie Parfumée", cat="Maison", emoji="🕯️", badge="", clearance=True,
         image=img("1603006905003-be475563bc59"),
         rating=4.2, reviews=67,
         desc="Cire 100 % végétale, parfum vanille-santal, 45 h de combustion.",
         variants=[dict(name="Standard", price=3900, old=fcfa(12.99), stock=22, sku="BOU-STD")]),
    dict(name="Parfum Élégance", cat="Beauté", emoji="🌸", badge="",
         image=img("1541643600914-78b084683601"),
         rating=4.6, reviews=189,
         desc="Eau de parfum, notes florales et boisées, longue tenue.",
         variants=[dict(name="50 ml", price=fcfa(44.99), old=None, stock=9, sku="PAR-50"),
                   dict(name="100 ml", price=fcfa(69.99), old=None, stock=5, sku="PAR-100")]),
    dict(name="Coffret Soin Visage", cat="Beauté", emoji="🧴", badge="Promo",
         image=img("1556228720-195a672e8a03"),
         rating=4.4, reviews=98,
         desc="Routine complète : nettoyant doux, sérum vitamine C et crème hydratante.",
         variants=[dict(name="Standard", price=fcfa(27.99), old=fcfa(34.99), stock=11, sku="COF-STD")]),
    dict(name="Café Moulu Arabica", cat="Épicerie", emoji="☕", badge="Top vente",
         image=img("1559056199-641a0ac8b55e"),
         rating=4.7, reviews=231,
         desc="Café 100 % arabica torréfié artisanalement.",
         variants=[dict(name="250 g", price=fcfa(8.99), old=None, stock=40, sku="CAF-250"),
                   dict(name="500 g", price=fcfa(15.99), old=None, stock=25, sku="CAF-500"),
                   dict(name="1 kg", price=fcfa(27.99), old=None, stock=15, sku="CAF-1000")]),
    dict(name="Chocolat Noir 70 %", cat="Épicerie", emoji="🍫", badge="",
         image=img("1511381939415-e44015466834"),
         rating=4.5, reviews=176,
         desc="Tablette de chocolat noir grand cru, issu du commerce équitable.",
         variants=[dict(name="100 g", price=fcfa(5.99), old=None, stock=50, sku="CHO-100"),
                   dict(name="200 g", price=fcfa(9.99), old=None, stock=30, sku="CHO-200")]),
    dict(name="Miel Bio de Montagne", cat="Épicerie", emoji="🍯", badge="Promo",
         image=img("1587049352846-4a222e784d38"),
         rating=4.9, reviews=264,
         desc="Miel pur et naturel récolté en montagne.",
         variants=[dict(name="500 g", price=fcfa(7.99), old=fcfa(9.99), stock=16, sku="MIE-500"),
                   dict(name="1 kg", price=fcfa(13.99), old=fcfa(16.99), stock=10, sku="MIE-1000")]),
]

PROMOS = [
    dict(code="BIENVENUE10", type="percent", value=10, label="-10 % sur votre commande"),
    dict(code="PROMO15", type="percent", value=15, label="-15 % sur votre commande"),
    dict(code="LIVGRATUITE", type="freeship", value=0, label="Livraison offerte"),
]


def run():
    with app.app_context():
        if Product.query.count() > 0:
            print("Base déjà remplie, seed ignoré.")
            return

        cats = {}
        for item in PRODUCTS:
            cat_name = item["cat"]
            if cat_name not in cats:
                cat = Category.query.filter_by(name=cat_name).first()
                if not cat:
                    cat = Category(name=cat_name)
                    db.session.add(cat)
                    db.session.flush()
                cats[cat_name] = cat
            product = Product(
                name=item["name"],
                description=item["desc"],
                image_url=item.get("image", ""),
                emoji=item["emoji"],
                badge=item["badge"],
                rating=item["rating"],
                reviews_count=item["reviews"],
                clearance=item.get("clearance", False),
                category_id=cats[cat_name].id,
            )
            for v in item["variants"]:
                product.variants.append(
                    Variant(name=v["name"], price=v["price"], old_price=v["old"],
                            stock=v["stock"], sku=v["sku"])
                )
            db.session.add(product)

        for p in PROMOS:
            db.session.add(PromoCode(**p))

        courier = DeliveryPerson(
            name="Karim Benali", phone="0698765432", vehicle="Scooter", zone="Centre-ville",
            verified=True,
        )
        courier.set_password("livre123")
        db.session.add(courier)
        db.session.flush()

        cafe = Variant.query.filter_by(sku="CAF-500").first()
        if cafe:
            cafe.stock -= 2
            order = Order(
                reference="CMD-DEMO01",
                customer_name="Marie Dupont",
                customer_email="marie@example.com",
                customer_phone="0612345678",
                customer_address="12 rue des Lilas, bâtiment B",
                zone="Centre-ville",
                note="Code porte 1234",
                payment_method="livraison",
                status="pending",
                subtotal=round(2 * cafe.price, 2),
                discount=0,
                delivery_fee=2000,
                total=round(2 * cafe.price + 2000, 2),
            )
            order.items.append(
                OrderItem(variant_id=cafe.id, product_name=cafe.product.name,
                          variant_name=cafe.name, quantity=2, unit_price=cafe.price)
            )
            db.session.add(order)

        db.session.commit()
        print(
            "Seed terminé :", Product.query.count(), "produits,",
            Variant.query.count(), "variantes,", PromoCode.query.count(), "codes promo,",
            DeliveryPerson.query.count(), "livreur."
        )


if __name__ == "__main__":
    run()
