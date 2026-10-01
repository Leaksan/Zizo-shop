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

// « il y a 3 h » : publications, notifications, commandes du vendeur
export function timeAgo(iso) {
  const date = parseDate(iso);
  if (!date) return "";
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 2 * 86400) return "hier";
  if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    parseDate(iso)
  );
}
