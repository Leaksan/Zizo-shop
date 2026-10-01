import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flag,
  PackageOpen,
  ShieldCheck,
  Store,
} from "lucide-react";
import { api } from "../../api";
import { formatPrice, timeAgo } from "../../format";
import { useShop } from "../../context/ShopContext";
import { usePolling } from "../../hooks";
import DaysChart from "../../components/DaysChart";
import ShopAvatar from "../../components/ShopAvatar";

export const STATUS_LABELS = {
  delivery: {
    pending: "En attente",
    delivering: "En livraison",
    delivered: "Livrée",
    cancelled: "Annulée",
  },
  pickup: {
    pending: "En préparation",
    delivering: "Prête à retirer",
    delivered: "Récupérée",
    cancelled: "Annulée",
  },
};

export function statusLabel(status, method = "delivery") {
  return STATUS_LABELS[method]?.[status] || status;
}

// Ce qui attend une action de l'admin, du plus urgent au moins urgent
const TODO = [
  { key: "pending_shops", icon: Store, to: "/admin/shops", one: "boutique à valider", many: "boutiques à valider" },
  { key: "open_reports", icon: Flag, to: "/admin/reports", one: "contenu signalé", many: "contenus signalés" },
  {
    key: "waiting_courier",
    icon: Bike,
    to: "/admin/orders?statut=pending",
    one: "colis prêt sans livreur",
    many: "colis prêts sans livreur",
  },
  {
    key: "couriers_to_verify",
    icon: ShieldCheck,
    to: "/admin/couriers",
    one: "livreur à vérifier",
    many: "livreurs à vérifier",
  },
  {
    key: "stock_requests",
    icon: BellRing,
    to: "/admin/stock-requests",
    one: "article réclamé par des clients",
    many: "articles réclamés par des clients",
  },
  {
    key: "low_stock_variants",
    icon: AlertTriangle,
    to: "/admin/products?filtre=stock",
    one: "variante en stock faible",
    many: "variantes en stock faible",
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const { currency } = useShop();

  const load = () => api.get("/admin/stats").then(setStats).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  usePolling(load, 30000);

  if (!stats) return <div className="skeleton h-64" />;

  const todo = TODO.filter((t) => stats[t.key] > 0);
  const kpis = [
    { label: "Commandes aujourd'hui", value: stats.orders_today },
    { label: `Commandes (${stats.period_days} j)`, value: stats.orders_30d },
    { label: `Encaissé, livré (${stats.period_days} j)`, value: formatPrice(stats.sales_30d, currency) },
    { label: "À encaisser (en cours)", value: formatPrice(stats.to_collect, currency) },
    { label: "Panier moyen", value: formatPrice(stats.avg_basket_30d, currency) },
    { label: `Nouveaux comptes (${stats.period_days} j)`, value: stats.new_users_30d },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="mt-1 text-sm muted">
          {stats.total_shops} boutique{stats.total_shops > 1 ? "s" : ""} · {stats.total_users} compte
          {stats.total_users > 1 ? "s" : ""} · {stats.total_products} produits · {stats.total_couriers} livreur
          {stats.total_couriers > 1 ? "s" : ""}
        </p>
      </div>

      {/* À traiter */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-gray-100 px-4 py-3 font-bold dark:border-slate-700">À traiter</h2>
        {todo.length === 0 ? (
          <p className="flex items-center gap-2 p-4 text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 size={18} /> Rien en attente : tout est à jour.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {todo.map((t) => (
              <li key={t.key}>
                <Link to={t.to} className="flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-300">
                    <t.icon size={18} />
                  </span>
                  <span className="flex-1 text-sm">
                    <b className="text-base">{stats[t.key]}</b> {stats[t.key] > 1 ? t.many : t.one}
                  </span>
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(stats.preparing > 0 || stats.active_deliveries > 0) && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 px-4 py-3 text-xs muted dark:border-slate-700">
            {stats.preparing > 0 && (
              <span className="flex items-center gap-1">
                <Clock size={13} /> {stats.preparing} en préparation chez les vendeurs
              </span>
            )}
            {stats.active_deliveries > 0 && (
              <span className="flex items-center gap-1">
                <PackageOpen size={13} /> {stats.active_deliveries} en cours de livraison ou à retirer
              </span>
            )}
          </p>
        )}
      </section>

      {/* Activité */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs muted">{k.label}</p>
            <p className="mt-1 truncate text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <DaysChart days={stats.days} currency={currency} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-bold">Meilleures boutiques ({stats.period_days} jours)</h2>
          {stats.top_shops.length === 0 ? (
            <p className="text-sm muted">Pas encore de vente livrée ce mois-ci.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {stats.top_shops.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-center text-xs font-bold muted">{i + 1}</span>
                  <ShopAvatar shop={s} className="h-8 w-8 text-xs" />
                  <Link to={`/b/${s.slug}`} target="_blank" className="min-w-0 flex-1 truncate font-semibold hover:text-brand-600">
                    {s.name}
                  </Link>
                  <span className="shrink-0 text-xs muted">{s.orders} cde{s.orders > 1 ? "s" : ""}</span>
                  <span className="shrink-0 font-semibold">{formatPrice(s.amount, currency)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-700">
            <h2 className="font-bold">Dernières commandes</h2>
            <Link to="/admin/orders" className="flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400">
              Tout voir <ArrowRight size={15} />
            </Link>
          </div>
          {stats.recent_orders.length === 0 ? (
            <p className="p-4 text-sm muted">Aucune commande pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-slate-700">
              {stats.recent_orders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {o.shop && <ShopAvatar shop={o.shop} className="h-8 w-8 text-xs" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {o.reference} <span className="font-normal muted">· {o.customer_name}</span>
                    </p>
                    <p className="truncate text-xs muted">
                      {o.shop?.name} · {timeAgo(o.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={o.status} method={o.delivery_method} />
                    <span className="font-semibold">{formatPrice(o.total, currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function StatusBadge({ status, method = "delivery" }) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
    delivering: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    delivered: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status] || "bg-gray-100 text-gray-700"}`}
    >
      {statusLabel(status, method)}
    </span>
  );
}
