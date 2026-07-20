export function computeTotals(subtotal, promo, { deliveryFee, freeShippingThreshold }) {
  let discount = 0;
  let freeShip = false;
  if (promo) {
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
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
