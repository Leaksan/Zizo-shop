import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bike, Check, ExternalLink, Hand, MapPin, Phone, ShoppingBag, StickyNote, Store, X } from "lucide-react";
import { api } from "../../api";
import { formatPhone, formatPrice, timeAgo } from "../../format";
import { useShop } from "../../context/ShopContext";
import { usePolling } from "../../hooks";
import { hasCoords, mapsUrl } from "../../maps";
import { WhatsAppIcon, whatsappUrl } from "../../whatsapp";

const TODO = "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200";
const ONGOING = "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200";
const DONE = "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200";
const CANCELLED = "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";

// Où en est une commande, du point de vue du vendeur
function sellerStep(o) {
  const pickup = o.delivery_method === "pickup";
  if (o.status === "cancelled") return { tab: "done", label: "Annulée", cls: CANCELLED };
  if (o.status === "delivered") return { tab: "done", label: pickup ? "Retirée" : "Livrée", cls: DONE };
  if (o.status === "delivering") {
    return { tab: "ongoing", label: pickup ? "Prête à retirer" : "En livraison", cls: ONGOING };
  }
  if (!pickup && o.ready_at) return { tab: "ongoing", label: "Attend un livreur", cls: ONGOING };
  return { tab: "todo", label: "À préparer", cls: TODO };
}

const FILTERS = [
  { key: "todo", label: "À préparer" },
  { key: "ongoing", label: "En cours" },
  { key: "done", label: "Terminées" },
];

// Commandes reçues par la boutique : préparer le colis, le remettre (retrait) ou refuser
export default function SellerOrders() {
  const { reload } = useOutletContext();
  const { currency } = useShop();
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState("todo");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    api
      .get("/my/orders")
      .then(setOrders)
      .catch(() => setOrders((list) => list || []));

  useEffect(() => {
    load();
  }, []);
  usePolling(load, 20000);

  const act = async (order, action) => {
    if (
      action === "cancel" &&
      !window.confirm(`Annuler la commande ${order.reference} ? Les articles seront remis en stock.`)
    )
      return;
    setBusy(order.id);
    setError("");
    try {
      const updated = await api.put(`/my/orders/${order.id}`, { action });
      setOrders((list) => list.map((o) => (o.id === updated.id ? updated : o)));
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (!orders) return <div className="skeleton h-40" />;

  const counts = orders.reduce((c, o) => ({ ...c, [sellerStep(o).tab]: (c[sellerStep(o).tab] || 0) + 1 }), {});
  const shown = orders.filter((o) => sellerStep(o).tab === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              filter === f.key
                ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                : "border-gray-200 text-gray-600 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {f.label}
            {counts[f.key] > 0 && <span className="ml-1.5 opacity-70">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

      {shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <ShoppingBag size={32} className="text-gray-300 dark:text-slate-600" />
          <p className="text-sm muted">
            {filter === "todo"
              ? "Aucune commande à préparer. Les nouvelles commandes apparaissent ici."
              : "Aucune commande ici pour l'instant."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} currency={currency} busy={busy === o.id} onAction={act} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order: o, currency, busy, onAction }) {
  const step = sellerStep(o);
  const pickup = o.delivery_method === "pickup";
  const cancellable = !o.courier_name && (o.status === "pending" || (pickup && o.status === "delivering"));
  const itemsTotal = o.subtotal - (o.discount || 0);

  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          {pickup ? <Store size={20} /> : <Bike size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold tracking-wide">{o.reference}</p>
          <p className="text-xs muted">
            {timeAgo(o.created_at)} · {pickup ? "Retrait en boutique" : `Livraison · ${o.zone}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${step.cls}`}>{step.label}</span>
      </div>

      <ul className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3 text-sm dark:border-slate-700">
        {o.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-2">
            <span className="min-w-0">
              <b>{i.quantity} ×</b> {i.product_name}
              {i.variant_name && <span className="muted"> ({i.variant_name})</span>}
            </span>
            <span className="shrink-0">{formatPrice(i.line_total, currency)}</span>
          </li>
        ))}
        {o.discount > 0 && (
          <li className="flex justify-between gap-2 text-green-700 dark:text-green-300">
            <span>Remise ({o.promo_code})</span>
            <span>−{formatPrice(o.discount, currency)}</span>
          </li>
        )}
        <li className="flex justify-between gap-2 font-bold">
          <span>Total articles</span>
          <span>{formatPrice(itemsTotal, currency)}</span>
        </li>
      </ul>

      <div className="mt-3 flex flex-col gap-1 text-sm">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">{o.customer_name}</span>
          <a href={`tel:${o.customer_phone}`} className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
            <Phone size={14} /> {formatPhone(o.customer_phone)}
          </a>
          <a
            href={whatsappUrl(o.customer_phone, `Bonjour, à propos de votre commande ${o.reference}`)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-brand-600 dark:text-brand-400"
          >
            <WhatsAppIcon size={14} /> WhatsApp
          </a>
        </p>
        {!pickup && o.customer_address && (
          <div className="flex items-start gap-1.5">
            <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
            <span className="min-w-0">
              {o.customer_address} <span className="muted">({o.zone})</span>
              {o.landmark && <span className="block text-xs muted">Repère : {o.landmark}</span>}
              <a
                href={mapsUrl({ latitude: o.latitude, longitude: o.longitude, address: o.customer_address, zone: o.zone })}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex w-fit items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400"
              >
                {hasCoords(o) ? "Position du client sur Google Maps" : "Chercher l'adresse sur Google Maps"}
                <ExternalLink size={12} />
              </a>
            </span>
          </div>
        )}
        {o.note && (
          <p className="flex items-start gap-1.5 rounded-lg bg-gray-50 p-2 text-xs text-gray-600 dark:bg-slate-900 dark:text-slate-300">
            <StickyNote size={13} className="mt-0.5 shrink-0" /> {o.note}
          </p>
        )}
        {!pickup && o.courier_name && (
          <p className="flex items-center gap-1.5 text-xs muted">
            <Bike size={13} /> Livreur : {o.courier_name}
          </p>
        )}
        {!pickup && step.tab === "todo" && (
          <p className="flex items-start gap-1.5 text-xs muted">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            Préparez le colis puis indiquez qu'il est prêt : un livreur viendra le chercher à votre adresse
            de retrait.
          </p>
        )}
      </div>

      {(step.tab === "todo" || (pickup && o.status === "delivering") || cancellable) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {step.tab === "todo" && (
            <button
              onClick={() => onAction(o, "ready")}
              disabled={busy}
              className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2.5"
            >
              <Check size={17} /> {pickup ? "Prête à retirer" : "Colis prêt"}
            </button>
          )}
          {pickup && o.status === "delivering" && (
            <button
              onClick={() => onAction(o, "picked_up")}
              disabled={busy}
              className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2.5"
            >
              <Hand size={17} /> Remise au client
            </button>
          )}
          {cancellable && (
            <button
              onClick={() => onAction(o, "cancel")}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              <X size={16} /> Annuler
            </button>
          )}
        </div>
      )}
    </li>
  );
}
