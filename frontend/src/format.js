export function formatPrice(value, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value ?? 0);
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export function stars(rating) {
  const full = Math.round(rating || 0);
  return "★".repeat(full) + "☆".repeat(5 - full);
}
