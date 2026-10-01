import { formatPrice } from "../format";

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

// « 2026-09-30 » (jour de Libreville, donné par le serveur) -> « mercredi 30 septembre »
function dayLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_FORMAT.format(new Date(y, m - 1, d));
}

// Commandes par jour (heure de Libreville) : barres simples, sans bibliothèque de graphiques.
// Utilisé par le tableau de bord du vendeur et par celui de l'admin.
export default function DaysChart({ days, currency, title = "Commandes des 14 derniers jours" }) {
  const max = Math.max(1, ...days.map((d) => d.orders));
  const total = days.reduce((n, d) => n + d.orders, 0);
  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-bold">
        {title}
        <span className="text-xs font-medium muted">{total} au total</span>
      </h2>
      <div className="flex h-28 items-end gap-1" role="img" aria-label={`${total} commandes en ${days.length} jours`}>
        {days.map((d) => (
          <div
            key={d.date}
            className="flex h-full flex-1 flex-col items-center justify-end gap-0.5"
            title={`${dayLabel(d.date)} : ${d.orders} commande${d.orders > 1 ? "s" : ""}, ${formatPrice(d.amount, currency)}`}
          >
            {d.orders > 0 && <span className="text-[10px] leading-none font-bold">{d.orders}</span>}
            <div
              className={`w-full rounded-t ${d.orders ? "bg-brand-500" : "bg-gray-200 dark:bg-slate-700"}`}
              style={{ height: d.orders ? `${Math.max(8, (d.orders / max) * 80)}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {days.map((d, i) => (
          <span key={d.date} className="flex-1 text-center text-[10px] muted">
            {i % 2 === days.length % 2 ? "" : Number(d.date.slice(8))}
          </span>
        ))}
      </div>
    </section>
  );
}
