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
