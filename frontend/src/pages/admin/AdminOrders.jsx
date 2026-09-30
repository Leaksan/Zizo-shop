import { useEffect, useState } from "react";
import { Banknote, Bike, Check, ChevronDown, ChevronUp, Clock, Compass, StickyNote, Store } from "lucide-react";
import { api } from "../../api";
import { formatDate, formatPrice } from "../../format";
import { useShop } from "../../context/ShopContext";
import { StatusBadge, statusLabel } from "./AdminDashboard";
import { usePolling } from "../../hooks";
import ShopAvatar from "../../components/ShopAvatar";

const FILTER_STATUSES = [
  { value: "pending", label: "En attente / préparation" },
  { value: "delivering", label: "En cours" },
  { value: "delivered", label: "Terminées" },
  { value: "cancelled", label: "Annulées" },
];

const STATUS_VALUES = ["pending", "delivering", "delivered", "cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currency } = useShop();

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    api
      .get(`/admin/orders${params}`)
      .then(setOrders)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(load, [filter]);
  usePolling(() => load(true), 15000, [filter]);

  const updateOrder = async (order, payload) => {
    const updated = await api.put(`/admin/orders/${order.id}`, payload);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
  };
  const updateStatus = (order, status) => updateOrder(order, { status });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Commandes</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-auto">
          <option value="">Tous les statuts</option>
          {FILTER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-4 text-sm muted">Chargement…</p>
        ) : orders.length === 0 ? (
          <p className="p-4 text-sm muted">Aucune commande.</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="border-b border-gray-100 last:border-0 dark:border-slate-700">
              <button
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <span className="font-semibold">{o.reference}</span>
                <span className="text-gray-700 dark:text-slate-300">{o.customer_name}</span>
                {o.shop && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
                    <ShopAvatar shop={o.shop} className="h-5 w-5 text-[10px]" />
                    {o.shop.name}
                  </span>
                )}
                {o.delivery_method === "pickup" ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                    <Store size={11} /> Retrait
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-xs font-bold text-accent-900 dark:bg-accent-950 dark:text-accent-200">
                    <Bike size={11} /> {o.zone}
                  </span>
                )}
                <span className="text-sm muted">{formatDate(o.created_at)}</span>
                <span className="ml-auto flex items-center gap-3">
                  <StatusBadge status={o.status} method={o.delivery_method} />
                  <span className="font-bold">{formatPrice(o.total, currency)}</span>
                  <span className="text-gray-400">
                    {expanded === o.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </span>
              </button>
              {expanded === o.id && (
                <div className="grid gap-6 border-t border-gray-100 bg-gray-50 p-4 md:grid-cols-2 dark:border-slate-700 dark:bg-slate-900">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-300">
                      Articles
                    </h3>
                    <ul className="flex flex-col gap-1 text-sm">
                      {o.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-2">
                          <span className="text-gray-600 dark:text-slate-300">
                            {i.product_name} ({i.variant_name}) × {i.quantity}
                          </span>
                          <span className="font-medium">{formatPrice(i.line_total, currency)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-col gap-0.5 border-t border-gray-200 pt-2 text-sm dark:border-slate-700">
                      <div className="flex justify-between muted">
                        <span>Sous-total</span>
                        <span>{formatPrice(o.subtotal, currency)}</span>
                      </div>
                      {o.discount > 0 && (
                        <div className="flex justify-between font-semibold text-green-600">
                          <span>Remise ({o.promo_code})</span>
                          <span>−{formatPrice(o.discount, currency)}</span>
                        </div>
                      )}
                      {o.delivery_method === "delivery" && (
                        <div className="flex justify-between muted">
                          <span>Livraison</span>
                          <span>
                            {o.delivery_fee === 0 ? "Offerte" : formatPrice(o.delivery_fee, currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="text-sm">
                      <p className="font-semibold text-gray-700 dark:text-slate-300">Client</p>
                      <p className="text-gray-600 dark:text-slate-300">
                        {o.customer_name} ·{" "}
                        <a href={`tel:${o.customer_phone}`} className="text-brand-600 dark:text-brand-400">
                          {o.customer_phone}
                        </a>
                      </p>
                      {o.customer_email && <p className="muted">{o.customer_email}</p>}
                      {o.delivery_method === "pickup" ? (
                        <p className="mt-1 flex items-center gap-1.5 font-semibold text-green-700 dark:text-green-300">
                          <Store size={14} />
                          Retrait en boutique — pas de livraison à organiser
                        </p>
                      ) : (
                        <>
                          <p className="whitespace-pre-line text-gray-600 dark:text-slate-300">
                            {o.customer_address} ({o.zone})
                          </p>
                          {o.landmark && (
                            <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300">
                              <Compass size={14} className="shrink-0" /> Repère : {o.landmark}
                            </p>
                          )}
                          {o.courier_name && (
                            <p className="mt-1 flex items-center gap-1.5 text-xs muted">
                              <Bike size={13} /> Livreur : {o.courier_name}
                            </p>
                          )}
                        </>
                      )}
                      {o.note && (
                        <p className="mt-1 rounded border-l-2 border-brand-500 bg-white px-2 py-1 text-xs text-gray-500 italic dark:bg-slate-800 dark:text-slate-400">
                          <StickyNote size={13} className="mr-1 inline align-[-2px] not-italic" />
                          {o.note}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1.5 text-xs muted">
                        <Banknote size={13} />
                        {o.payment_method === "livraison"
                          ? o.delivery_method === "pickup"
                            ? "Paiement au retrait"
                            : "Paiement à la livraison"
                          : "Carte — NON encaissé, à faire payer"}
                      </p>
                    </div>
                    {/* Hub : le vendeur prépare le colis, puis il est proposé aux livreurs */}
                    {o.delivery_method === "delivery" && o.status === "pending" && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {o.ready_at ? (
                          <span className="flex items-center gap-1.5 text-green-700 dark:text-green-300">
                            <Check size={15} /> Colis prêt ({formatDate(o.ready_at)}) : visible des livreurs
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5 text-yellow-800 dark:text-yellow-200">
                              <Clock size={15} /> En préparation chez le vendeur
                            </span>
                            <button
                              onClick={() => updateOrder(o, { ready: true })}
                              className="btn-outline px-3 py-1.5 text-xs"
                            >
                              Marquer prête
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <label className="block max-w-xs">
                      <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-slate-300">
                        Changer le statut
                      </span>
                      <select
                        value={o.status}
                        onChange={(e) => updateStatus(o, e.target.value)}
                        className="input"
                      >
                        {STATUS_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s, o.delivery_method)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
