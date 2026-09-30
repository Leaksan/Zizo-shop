import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { AlertTriangle, ChevronRight, Newspaper, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { api } from "../../api";
import { formatPrice } from "../../format";
import { useShop } from "../../context/ShopContext";
import Rating from "../../components/Rating";

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

// « 2026-09-30 » (jour de Libreville, donné par le serveur) -> « mercredi 30 septembre »
function dayLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_FORMAT.format(new Date(y, m - 1, d));
}

// Tableau de bord du vendeur : les 30 derniers jours en un coup d'œil
export default function SellerDashboard() {
  const { shop } = useOutletContext();
  const { currency } = useShop();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api
      .get("/my/stats")
      .then(setStats)
      .catch(() => setStats(false));
  }, []);

  if (stats === null) return <div className="skeleton h-64" />;
  if (stats === false) return <p className="card p-6 text-center text-sm muted">Statistiques indisponibles pour le moment.</p>;

  const cards = [
    {
      icon: TrendingUp,
      label: "Ventes livrées",
      value: formatPrice(stats.sales, currency),
      sub: stats.sales_pending > 0 ? `+ ${formatPrice(stats.sales_pending, currency)} en cours` : "30 derniers jours",
    },
    {
      icon: ShoppingBag,
      label: "Commandes",
      value: stats.orders,
      sub: `${stats.delivered} livrée${stats.delivered > 1 ? "s" : ""}${stats.cancelled ? ` · ${stats.cancelled} annulée${stats.cancelled > 1 ? "s" : ""}` : ""}`,
    },
    {
      icon: Package,
      label: "À préparer",
      value: stats.to_prepare,
      sub: stats.to_prepare > 0 ? "Voir les commandes" : "Rien en attente",
      to: "/vendeur/commandes",
      highlight: stats.to_prepare > 0,
    },
    {
      icon: Users,
      label: "Abonnés",
      value: stats.followers,
      sub: stats.new_followers > 0 ? `+${stats.new_followers} ce mois-ci` : "Publiez pour en gagner",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => {
          const inner = (
            <>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  c.highlight
                    ? "bg-accent-400 text-gray-950"
                    : "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400"
                }`}
              >
                <c.icon size={18} />
              </span>
              <p className="mt-2 truncate text-xl font-extrabold">{c.value}</p>
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">{c.label}</p>
              <p className="truncate text-xs muted">{c.sub}</p>
            </>
          );
          return c.to ? (
            <Link key={c.label} to={c.to} className="card p-3 transition hover:border-brand-300">
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="card p-3">
              {inner}
            </div>
          );
        })}
      </div>

      {stats.reviews_count > 0 && (
        <Link
          to={`/b/${shop.slug}?onglet=avis`}
          className="card flex items-center gap-3 p-3 transition hover:border-brand-300"
        >
          <span className="flex-1">
            <span className="block text-xs font-semibold text-gray-700 dark:text-slate-200">Note des clients</span>
            <Rating value={stats.rating} count={stats.reviews_count} />
          </span>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
      )}

      <DaysChart days={stats.days} currency={currency} />

      {stats.orders === 0 && (
        <div className="card flex flex-col gap-2 p-4 text-sm">
          <p className="font-semibold">Vos premières ventes s'afficheront ici.</p>
          <p className="muted">
            Des photos claires et des prix justes font la différence. Publiez vos arrivages dans le fil
            pour vous faire connaître.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link to="/vendeur/produits/nouveau" className="btn-primary px-4 py-2 text-sm">
              Ajouter un produit
            </Link>
            <Link to="/vendeur/publications" className="btn-outline flex items-center gap-1.5 px-4 py-2 text-sm">
              <Newspaper size={15} /> Publier
            </Link>
          </div>
        </div>
      )}

      {stats.top_products.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Meilleures ventes (30 jours)</h2>
          <ol className="flex flex-col gap-2 text-sm">
            {stats.top_products.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold dark:bg-slate-700">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs muted">{p.quantity} vendu{p.quantity > 1 ? "s" : ""}</span>
                <span className="shrink-0 font-semibold">{formatPrice(p.amount, currency)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {stats.low_stock.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <AlertTriangle size={16} className="text-accent-600 dark:text-accent-400" /> Stock bas
          </h2>
          <ul className="flex flex-col divide-y divide-gray-100 text-sm dark:divide-slate-700">
            {stats.low_stock.map((v) => (
              <li key={`${v.product_id}-${v.variant}`}>
                <Link to={`/vendeur/produits/${v.product_id}`} className="flex items-center gap-2 py-2 hover:text-brand-600">
                  <span className="min-w-0 flex-1 truncate">
                    {v.product} <span className="muted">({v.variant})</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.stock === 0
                        ? "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200"
                        : "bg-accent-100 text-accent-900 dark:bg-accent-950 dark:text-accent-200"
                    }`}
                  >
                    {v.stock === 0 ? "Épuisé" : `Plus que ${v.stock}`}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Commandes par jour (heure de Libreville) : barres simples, sans bibliothèque de graphiques
function DaysChart({ days, currency }) {
  const max = Math.max(1, ...days.map((d) => d.orders));
  const total = days.reduce((n, d) => n + d.orders, 0);
  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-bold">
        Commandes des 14 derniers jours
        <span className="text-xs font-medium muted">{total} au total</span>
      </h2>
      <div className="flex h-28 items-end gap-1" role="img" aria-label={`${total} commandes en 14 jours`}>
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
