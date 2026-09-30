// Commandes passées (ou suivies) depuis ce téléphone : le client les retrouve dans
// « Commandes » sans compte ni numéro à retaper. Rien n'est envoyé au serveur.
const STORAGE_KEY = "shop_orders";
const MAX_ORDERS = 20; // un panier multi-boutiques donne plusieurs commandes

export function getMyOrders() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberOrder(order) {
  if (!order?.reference) return;
  const entry = {
    reference: order.reference,
    created_at: order.created_at,
    total: order.total,
    items_count: (order.items || []).reduce((n, i) => n + (i.quantity || 0), 0),
    delivery_method: order.delivery_method,
    shop_name: order.shop?.name || "",
  };
  const list = [entry, ...getMyOrders().filter((o) => o.reference !== entry.reference)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ORDERS)));
  } catch {
    // stockage indisponible (navigation privée) : le suivi par numéro reste possible
  }
}
