export function formatPrice(value, currency = "XAF") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value ?? 0);
}

// Numéro gabonais enregistré sans le zéro (77112233) -> « 077 11 22 33 »
export function formatPhone(digits) {
  const d = String(digits || "");
  const local = d.length === 8 ? `0${d}` : d;
  return local.length === 9 ? local.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4") : local;
}

// Le serveur envoie ses dates en UTC sans le préciser (« 2026-09-29T22:48:00 ») : sans « Z »,
// le navigateur les lirait comme des heures locales, avec 1 h de retard à Libreville.
export function parseDate(iso) {
  if (!iso) return null;
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    parseDate(iso)
  );
}
