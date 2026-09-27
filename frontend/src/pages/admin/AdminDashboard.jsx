import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatDate, formatPrice } from "../../format";
import { useShop } from "../../context/ShopContext";
import { usePolling } from "../../hooks";

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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const { currency } = useShop();

  useEffect(() => {
    api.get("/admin/stats").then(setStats).catch(() => {});
  }, []);

  usePolling(() => {
    api.get("/admin/stats").then(setStats).catch(() => {});
  }, 30000);

  if (!stats) return <p className="muted">Chargement…</p>;

  const cards = [
    { label: "Chiffre d'affaires", value: formatPrice(stats.revenue, currency) },
    { label: "Commandes", value: stats.total_orders },
    { label: "En attente de livreur", value: stats.pending_orders },
    { label: "Retraits à préparer", value: stats.pickup_pending },
    { label: "Livraisons en cours", value: stats.active_deliveries },
    { label: "Produits", value: stats.total_products },
    { label: "Livreurs inscrits", value: stats.total_couriers },
    { label: "Variantes en stock faible", value: stats.low_stock_variants },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-sm muted">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-slate-700">
          <h2 className="font-semibold">Commandes récentes</h2>
          <Link to="/admin/orders" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
            Tout voir →
          </Link>
        </div>
        {stats.recent_orders.length === 0 ? (
          <p className="p-4 text-sm muted">Aucune commande pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-slate-700 dark:text-slate-400">
                <th className="p-4 font-medium">Référence</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Statut</th>
                <th className="p-4 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-100 last:border-0 dark:border-slate-700">
                  <td className="p-4 font-medium">{o.reference}</td>
                  <td className="p-4">{o.customer_name}</td>
                  <td className="p-4 muted">{formatDate(o.created_at)}</td>
                  <td className="p-4">
                    <StatusBadge status={o.status} method={o.delivery_method} />
                  </td>
                  <td className="p-4 text-right font-semibold">{formatPrice(o.total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
