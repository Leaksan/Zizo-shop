import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bike, Clock, KeyRound, MapPin, MessageSquarePlus, Package, Phone, Search, Store, User, XCircle } from "lucide-react";
import { api } from "../api";
import { formatDate, formatPrice } from "../format";
import { useShop } from "../context/ShopContext";
import TrackingMap from "../components/TrackingMap";
import { CourierRatingForm, ProductReviewForm } from "../components/ReviewForms";

const STATUS_INFO = {
  pending: {
    icon: Clock,
    title: "En attente d'un livreur",
    sub: "Votre commande est confirmée et attend d'être prise en charge.",
    cls: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  },
  delivering: {
    icon: Bike,
    title: "En cours de livraison",
    sub: "Votre livreur est en route vers votre adresse !",
    cls: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  },
  delivered: {
    icon: Package,
    title: "Commande livrée",
    sub: "Votre commande a été remise au destinataire. Bon usage !",
    cls: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  },
  cancelled: {
    icon: XCircle,
    title: "Commande annulée",
    sub: "Cette commande a été annulée.",
    cls: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
};

const PICKUP_STATUS_INFO = {
  pending: {
    icon: Clock,
    title: "Commande en préparation",
    sub: "Votre commande est confirmée et en cours de préparation en boutique.",
    cls: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  },
  delivering: {
    icon: Package,
    title: "Prête à retirer !",
    sub: "Votre commande vous attend en boutique. Présentez votre numéro de commande au comptoir.",
    cls: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  },
  delivered: {
    icon: Package,
    title: "Commande récupérée",
    sub: "Vous avez récupéré votre commande. Merci et à bientôt !",
    cls: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  },
  cancelled: STATUS_INFO.cancelled,
};

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const [ref, setRef] = useState(searchParams.get("ref") || "");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { currency } = useShop();

  const search = useCallback(
    async (reference, silent = false) => {
      const value = (reference ?? ref).trim().toUpperCase();
      if (!value) return;
      if (!silent) {
        setLoading(true);
        setError("");
        setOrder(null);
      }
      try {
        setOrder(await api.get(`/orders/track/${value}`));
        if (!silent) setRef(value);
      } catch (e) {
        if (!silent) setError(e.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [ref]
  );

  useEffect(() => {
    if (searchParams.get("ref")) search(searchParams.get("ref"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!order) return;
    const shouldPoll =
      order.status === "delivering" ||
      (order.delivery_method === "pickup" && order.status === "pending");
    if (!shouldPoll) return;
    const timer = setInterval(() => search(order.reference, true), 15000);
    return () => clearInterval(timer);
  }, [order, search]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
          <Package size={24} className="text-indigo-600 dark:text-indigo-400" />
          Suivre ma commande
        </h1>
        <p className="mt-1 text-sm muted">
          Entrez votre numéro de commande (ex. CMD-AB12CD) pour connaître son statut.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="mb-8 flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            placeholder="NUMÉRO DE COMMANDE"
            className="input w-full pl-9 font-semibold uppercase"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "…" : "Rechercher"}
        </button>
      </form>

      {error && (
        <div className="card p-8 text-center">
          <Search size={40} className="mx-auto text-gray-300 dark:text-slate-600" strokeWidth={1.2} />
          <h3 className="mt-3 font-bold">Commande introuvable</h3>
          <p className="mt-1 text-sm muted">Vérifiez le numéro saisi (ex. CMD-AB12CD).</p>
        </div>
      )}

      {order && <OrderTracking order={order} currency={currency} onRefresh={() => search(order.reference, true)} />}
    </div>
  );
}

function OrderTracking({ order, currency, onRefresh }) {
  const { pickupAddress } = useShop();
  const isPickup = order.delivery_method === "pickup";
  const info = (isPickup ? PICKUP_STATUS_INFO : STATUS_INFO)[order.status] || STATUS_INFO.pending;
  const rank = { pending: 1, delivering: 2, delivered: 3 }[order.status] || 0;
  const destPos =
    order.latitude != null && order.longitude != null ? [order.latitude, order.longitude] : null;
  const courierPos =
    order.courier?.lat != null && order.courier?.lng != null
      ? [order.courier.lat, order.courier.lng]
      : null;
  const steps = isPickup
    ? [
        { label: "Commande confirmée", date: order.created_at, icon: "✓", done: rank >= 1 },
        { label: "Prête en boutique", date: order.accepted_at, icon: "🛍️", done: rank >= 2 },
        { label: "Commande récupérée", date: order.delivered_at, icon: "👋", done: rank >= 3 },
      ]
    : [
        { label: "Commande confirmée", date: order.created_at, icon: "✓", done: rank >= 1 },
        {
          label: "Prise en charge par un livreur",
          date: order.accepted_at,
          icon: "🛵",
          done: rank >= 2,
          extra: order.courier ? `${order.courier.name} (${order.courier.vehicle})` : "",
        },
        { label: "Commande livrée", date: order.delivered_at, icon: "📦", done: rank >= 3 },
      ];

  return (
    <div className="card p-6">
      <div className={`mb-6 flex items-center gap-3 rounded-xl p-4 font-semibold ${info.cls}`}>
        <info.icon size={26} />
        <div>
          <p>
            {info.title} — {order.reference}
          </p>
          <p className="text-sm font-normal opacity-80">{info.sub}</p>
        </div>
      </div>

      {isPickup && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border-2 border-dashed border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/50">
          <Store size={24} className="shrink-0 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-bold">Retrait en boutique</p>
            <p className="text-sm">📍 {pickupAddress}</p>
            <p className="mt-1 text-xs muted">
              Présentez votre numéro de commande <b>{order.reference}</b> au comptoir pour récupérer
              votre article.
            </p>
          </div>
        </div>
      )}

      {!isPickup && order.status !== "delivered" && order.status !== "cancelled" && order.delivery_code && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/50">
          <KeyRound size={24} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div>
            <p className="font-bold">Code de livraison : <span className="text-xl tracking-[0.3em]">{order.delivery_code}</span></p>
            <p className="text-xs muted">Communiquez ce code au livreur uniquement à la réception de votre colis. C'est lui qui confirme la livraison.</p>
          </div>
        </div>
      )}

      <div className="mb-6 ml-2 flex flex-col">
        {steps.map((s, i) => (
          <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className={`absolute top-9 left-[17px] h-full w-0.5 ${
                  s.done ? "bg-green-500" : "bg-gray-200 dark:bg-slate-700"
                }`}
              />
            )}
            <span
              className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                s.done
                  ? "border-green-500 bg-green-500 text-white"
                  : "border-gray-300 bg-gray-50 text-gray-400 dark:border-slate-600 dark:bg-slate-800"
              }`}
            >
              {s.done ? s.icon : "○"}
            </span>
            <div>
              <p className={`font-semibold ${s.done ? "" : "muted"}`}>{s.label}</p>
              <p className="text-xs muted">
                {s.date ? formatDate(s.date) : "En attente…"}
                {s.extra ? ` · ${s.extra}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {order.status === "delivering" && (courierPos || destPos) && (
        <div className="mb-6">
          <TrackingMap courierPos={courierPos} destPos={destPos} />
          <p className="mt-2 text-center text-xs muted">
            La position du livreur se met à jour automatiquement.
          </p>
        </div>
      )}

      {order.courier && (
        <div className="mb-6 flex items-center gap-4 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-800">
            <Bike size={24} className="text-indigo-600 dark:text-indigo-400" />
          </span>
          <div>
            <p className="font-bold">{order.courier.name}</p>
            <p className="text-sm muted">Votre livreur · Zone {order.courier.zone}</p>
          </div>
          <a
            href={`tel:${order.courier.phone.replace(/\s/g, "")}`}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-700"
          >
            <Phone size={15} /> Appeler
          </a>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 text-sm dark:border-slate-700">
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5 muted">
            {isPickup ? <Store size={14} /> : <MapPin size={14} />}
            {isPickup ? "Retrait" : "Livraison"}
          </span>
          <span className="text-right font-medium">
            {isPickup ? (
              pickupAddress
            ) : (
              <>
                {order.latitude != null && order.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {order.customer_address} ↗
                  </a>
                ) : (
                  order.customer_address
                )}{" "}
                ({order.zone})
              </>
            )}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5 muted">
            <Package size={14} /> Articles
          </span>
          <span className="text-right">
            {order.items.map((a) => `${a.product_name} (${a.variant_name}) ×${a.quantity}`).join(" · ")}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5 muted">
            <User size={14} /> Paiement
          </span>
          <span>{order.payment_method === "livraison" ? "À la livraison" : "Carte bancaire"}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between gap-3 text-green-600">
            <span>Remise ({order.promo_code})</span>
            <span>−{formatPrice(order.discount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="muted">💰 Total</span>
          <span className="font-bold">{formatPrice(order.total, currency)}</span>
        </div>
      </div>

      {order.status === "delivered" && (
        <div className="mt-6 border-t border-gray-200 pt-5 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <MessageSquarePlus size={18} className="text-indigo-600 dark:text-indigo-400" />
            Votre avis compte
          </h3>
          {!isPickup && order.courier && (
            <CourierRatingForm order={order} onDone={onRefresh} />
          )}
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-300">
              Notez vos produits (avec photo si vous voulez) :
            </p>
            {order.items
              .filter((i) => i.product_id && !order.reviewed_product_ids?.includes(i.product_id))
              .map((i) => (
                <ProductReviewForm key={i.id} order={order} item={i} onDone={onRefresh} />
              ))}
            {order.items.every(
              (i) => !i.product_id || order.reviewed_product_ids?.includes(i.product_id)
            ) && (
              <p className="flex items-center gap-2 text-sm text-green-600">
                <Package size={15} /> Merci, vous avez déjà noté tous vos produits.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
