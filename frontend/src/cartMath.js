// Doit rester identique au calcul du serveur (backend/app.py, create_order).
export function computeTotals(subtotal, promo, { deliveryFee, freeShippingThreshold }) {
  let discount = 0;
  let freeShip = false;
  const promoOk = promo && !(promo.min_order > 0 && subtotal < promo.min_order);
  if (promoOk) {
    if (promo.type === "percent") discount = (subtotal * promo.value) / 100;
    if (promo.type === "freeship") freeShip = true;
  }
  const base = subtotal - discount;
  const fee =
    freeShip || (freeShippingThreshold > 0 && base >= freeShippingThreshold) ? 0 : deliveryFee;
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    deliveryFee: round2(fee),
    total: round2(base + fee),
    promoBlocked: Boolean(promo) && !promoOk,
  };
}

// Hub : une commande par boutique (le livreur passe chez chaque vendeur). Chaque boutique a
// ses frais de livraison et son seuil de livraison offerte ; le code promo de la plateforme
// ne s'applique qu'à la boutique officielle. Doit rester identique au serveur (create_order).
export function computeCart(items, promo, settings) {
  const groups = groupByShop(items).map((g) => {
    const subtotal = g.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    return { ...g, ...computeTotals(subtotal, g.shop?.official ? promo : null, settings) };
  });
  const sum = (key) => round2(groups.reduce((total, g) => total + g[key], 0));
  const official = groups.find((g) => g.shop?.official);
  return {
    groups,
    subtotal: sum("subtotal"),
    discount: sum("discount"),
    deliveryFee: sum("deliveryFee"),
    total: sum("total"),
    // Code saisi mais sans effet : pas de produit officiel, ou achat minimum non atteint
    promoNotApplicable: Boolean(promo) && !official,
    promoBlocked: Boolean(official?.promoBlocked),
  };
}

// Articles du panier regroupés par boutique (ordre d'ajout conservé)
export function groupByShop(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.shop?.id ?? 0;
    if (!groups.has(key)) groups.set(key, { shop: item.shop || null, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

// Frais de livraison d'une zone : tarif propre à la zone, sinon frais par défaut.
export function feeForZone(shop, zone) {
  const fee = shop.zoneFees?.[zone];
  return fee != null ? Number(fee) : shop.deliveryFee;
}

// Plus petit et plus grand frais possibles (pour afficher « dès X » dans le panier).
export function feeRange(shop) {
  const fees = (shop.zones.length ? shop.zones : [null]).map((z) => feeForZone(shop, z));
  return { min: Math.min(...fees), max: Math.max(...fees) };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
