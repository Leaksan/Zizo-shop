import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bike,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  ExternalLink,
  Hand,
  KeyRound,
  MapPin,
  MessageSquarePlus,
  Package,
  PackageCheck,
  Phone,
  Ship,
  Search,
  ShoppingBag,
  Store,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { api } from "../api";
import { formatDate, formatPrice, parseDate, timeAgo } from "../format";
import { directionsUrl, distanceKm, hasCoords, mapsUrl } from "../maps";
import { getMyOrders, rememberOrder } from "../myOrders";
import { useAuth } from "../context/AuthContext";
import { useShop } from "../context/ShopContext";
import ShopAvatar from "../components/ShopAvatar";
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

// Livraison : tant que la boutique n'a pas préparé le colis, aucun livreur ne le voit
const PREPARING_INFO = {
  icon: ShoppingBag,
  title: "En préparation",
  sub: "La boutique prépare votre colis, puis un livreur viendra le chercher.",
  cls: STATUS_INFO.pending.cls,
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

// Statut en un mot, pour la liste « Mes commandes »
const STATUS_CHIP = {
  pending: { delivery: "En attente", pickup: "En préparation", cls: STATUS_INFO.pending.cls },
  delivering: { delivery: "En route", pickup: "Prête", cls: STATUS_INFO.delivering.cls },
  delivered: { delivery: "Livrée", pickup: "Récupérée", cls: STATUS_INFO.delivered.cls },
  cancelled: { delivery: "Annulée", pickup: "Annulée", cls: STATUS_INFO.cancelled.cls },
  preparing: { delivery: "En préparation", pickup: "En préparation", cls: STATUS_INFO.pending.cls },
};

// Commandes de ce téléphone + celles du compte (passées depuis un autre appareil), sans doublon
function mergeOrders(local, account) {
  const known = new Set(local.map((o) => o.reference));
  const extra = account
    .filter((o) => !known.has(o.reference))
    .map((o) => ({
      reference: o.reference,
      created_at: o.created_at,
      total: o.total,
      items_count: (o.items || []).reduce((n, i) => n + i.quantity, 0),
      delivery_method: o.delivery_method,
      shop_name: o.shop?.name || "",
    }));
  return [...local, ...extra].sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at));
}

export default function TrackOrder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const refParam = (searchParams.get("ref") || "").trim().toUpperCase();
  const [ref, setRef] = useState(refParam);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  // Ouvert avec ?ref= : afficher le chargement tout de suite, sans montrer la liste un instant
  const [loading, setLoading] = useState(() => Boolean(refParam));
  const [localOrders, setLocalOrders] = useState(getMyOrders);
  const [accountOrders, setAccountOrders] = useState([]);
  const { user } = useAuth();
  const { currency } = useShop();
  const myOrders = useMemo(() => mergeOrders(localOrders, accountOrders), [localOrders, accountOrders]);

  useEffect(() => {
    if (!user) {
      setAccountOrders([]);
      return;
    }
    api
      .get("/me/orders")
      .then(setAccountOrders)
      .catch(() => {});
  }, [user]);

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
        const found = await api.get(`/orders/track/${value}`);
        setOrder(found);
        if (!silent) {
          setRef(value);
          rememberOrder(found);
          setLocalOrders(getMyOrders());
        }
      } catch (e) {
        if (!silent) setError(e.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [ref]
  );

  // L'adresse (?ref=) décide de ce qui est affiché : le bouton retour du
  // téléphone ramène de la commande ouverte à la liste « Mes commandes ».
  useEffect(() => {
    if (refParam) {
      search(refParam);
    } else {
      setOrder(null);
      setError("");
      setRef("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refParam]);

  useEffect(() => {
    if (!order) return;
    // En préparation, en attente d'un livreur ou en route : le suivi se met à jour tout seul
    if (order.status !== "pending" && order.status !== "delivering") return;
    const timer = setInterval(() => search(order.reference, true), 15000);
    return () => clearInterval(timer);
  }, [order, search]);

  const open = (reference) => {
    const value = reference.trim().toUpperCase();
    if (!value) return;
    if (value === refParam) search(value);
    else setSearchParams({ ref: value });
  };

  if (refParam && (order || loading)) {
    return (
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => setSearchParams({})}
          className="mb-4 flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          <ChevronLeft size={18} />
          {myOrders.length > 0 ? "Mes commandes" : "Suivre une autre commande"}
        </button>
        {loading ? (
          <div className="skeleton h-64" />
        ) : (
          <OrderTracking order={order} currency={currency} onRefresh={() => search(order.reference, true)} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold">
          <Package size={24} className="text-brand-600 dark:text-brand-400" />
          {myOrders.length > 0 ? "Mes commandes" : "Suivre ma commande"}
        </h1>
        <p className="mt-1 text-sm muted">
          {myOrders.length > 0
            ? user
              ? "Vos commandes (ce téléphone et votre compte). Touchez-en une pour la suivre."
              : "Vos commandes passées sur ce téléphone. Touchez-en une pour la suivre."
            : "Entrez votre numéro de commande (ex. CMD-AB12CD) pour connaître son statut."}
        </p>
      </div>

      <MyOrdersList orders={myOrders} currency={currency} onOpen={open} />

      {myOrders.length > 0 && (
        <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-300">
          Un autre numéro de commande ?
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          open(ref);
        }}
        className="mb-8 flex gap-2"
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            placeholder="CMD-AB12CD"
            aria-label="Numéro de commande"
            className="input w-full pl-9 font-semibold uppercase"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "…" : "Suivre"}
        </button>
      </form>

      {error && (
        <div className="card p-8 text-center">
          <Search size={40} className="mx-auto text-gray-300 dark:text-slate-600" strokeWidth={1.2} />
          <h3 className="mt-3 font-bold">Commande introuvable</h3>
          <p className="mt-1 text-sm muted">Vérifiez le numéro saisi (ex. CMD-AB12CD).</p>
        </div>
      )}
    </div>
  );
}

function shortDate(iso) {
  return iso ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(parseDate(iso)) : "";
}

function MyOrdersList({ orders, currency, onOpen }) {
  const [live, setLive] = useState({});

  // Statut à jour de chaque commande (quelques petites requêtes, en parallèle)
  useEffect(() => {
    orders.forEach((o) =>
      api
        .get(`/orders/track/${o.reference}`)
        .then((full) => setLive((s) => ({ ...s, [o.reference]: full })))
        .catch(() => {})
    );
  }, [orders]);

  if (orders.length === 0) return null;

  return (
    <ul className="mb-8 flex flex-col gap-2">
      {orders.map((o) => {
        const full = live[o.reference];
        const method = o.delivery_method === "pickup" ? "pickup" : "delivery";
        const preparing = full?.status === "pending" && method === "delivery" && !full.ready_at;
        const chip = STATUS_CHIP[preparing ? "preparing" : full?.status];
        const shopName = full?.shop?.name || o.shop_name;
        return (
          <li key={o.reference}>
            <button
              onClick={() => onOpen(o.reference)}
              className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-brand-300 dark:hover:border-brand-700"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                {method === "pickup" ? <Store size={20} /> : <Package size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm tracking-wide">{o.reference}</b>
                <small className="block truncate text-xs muted">
                  {shopName && `${shopName} · `}
                  {shortDate(o.created_at)} · {o.items_count} article{o.items_count > 1 ? "s" : ""}
                </small>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {chip && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chip.cls}`}>
                    {chip[method]}
                  </span>
                )}
                <b className="text-sm">{formatPrice(o.total, currency)}</b>
              </span>
              <ChevronRight size={18} className="shrink-0 text-gray-400" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function OrderTracking({ order, currency, onRefresh }) {
  const { pickupAddress: platformPickup, intercityDelay } = useShop();
  // Retrait chez le vendeur de la commande (adresse de sa boutique)
  const pickupAddress = order.pickup_address || platformPickup;
  const isPickup = order.delivery_method === "pickup";
  const preparing = !isPickup && order.status === "pending" && !order.ready_at;
  // Colis envoyé d'une autre ville : prêt, mais pas encore arrivé dans la ville du client
  const travelling = order.intercity && order.status === "pending" && order.ready_at && !order.arrived_at;
  const info = preparing
    ? PREPARING_INFO
    : travelling
      ? {
          icon: Ship,
          title: `En route vers ${order.to_city}`,
          sub: `Votre colis voyage depuis ${order.from_city}${intercityDelay ? ` (comptez ${intercityDelay})` : ""}, puis un livreur vous l'apporte.`,
          cls: STATUS_INFO.pending.cls,
        }
      : (isPickup ? PICKUP_STATUS_INFO : STATUS_INFO)[order.status] || STATUS_INFO.pending;
  const rank = { pending: 1, delivering: 2, delivered: 3 }[order.status] || 0;
  // Lieux ouverts dans Google Maps : l'adresse de livraison, le livreur, la boutique (retrait)
  const destination = {
    latitude: order.latitude,
    longitude: order.longitude,
    address: order.customer_address,
    zone: order.zone,
  };
  const courierPlace = order.courier ? { latitude: order.courier.lat, longitude: order.courier.lng } : null;
  const shopPlace = {
    latitude: order.pickup_latitude,
    longitude: order.pickup_longitude,
    address: pickupAddress,
  };
  const courierKm = distanceKm(courierPlace, destination);
  const steps = isPickup
    ? [
        { label: "Commande confirmée", date: order.created_at, icon: Check, done: rank >= 1 },
        { label: "Prête en boutique", date: order.accepted_at, icon: ShoppingBag, done: rank >= 2 },
        { label: "Commande récupérée", date: order.delivered_at, icon: Hand, done: rank >= 3 },
      ]
    : [
        { label: "Commande confirmée", date: order.created_at, icon: Check, done: rank >= 1 },
        // Hub : le vendeur prépare le colis avant qu'un livreur vienne le chercher
        {
          label: "Préparée par la boutique",
          date: order.ready_at,
          icon: ShoppingBag,
          done: Boolean(order.ready_at) || rank >= 2,
        },
        ...(order.intercity
          ? [
              {
                label: `Arrivée à ${order.to_city}`,
                date: order.arrived_at,
                icon: Ship,
                done: Boolean(order.arrived_at) || rank >= 2,
              },
            ]
          : []),
        {
          label: "Prise en charge par un livreur",
          date: order.accepted_at,
          icon: Bike,
          done: rank >= 2,
          extra: order.courier ? `${order.courier.name} (${order.courier.vehicle})` : "",
        },
        { label: "Commande livrée", date: order.delivered_at, icon: PackageCheck, done: rank >= 3 },
      ];

  return (
    <div className="card p-6">
      {order.shop && (
        <Link
          to={`/b/${order.shop.slug}`}
          className="mb-4 flex items-center gap-2 text-sm font-semibold hover:text-brand-600"
        >
          <ShopAvatar shop={order.shop} className="h-7 w-7 text-xs" />
          Commande chez {order.shop.name}
        </Link>
      )}
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
            <p className="flex items-start gap-1.5 text-sm">
              <MapPin size={15} className="mt-0.5 shrink-0" />
              {pickupAddress}
            </p>
            {directionsUrl(shopPlace) && (
              <a
                href={directionsUrl(shopPlace)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Itinéraire dans Google Maps <ExternalLink size={13} />
              </a>
            )}
            <p className="mt-1 text-xs muted">
              Présentez votre numéro de commande <b>{order.reference}</b> au comptoir pour récupérer
              votre article.
            </p>
          </div>
        </div>
      )}

      {!isPickup && order.status !== "delivered" && order.status !== "cancelled" && order.delivery_code && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950/50">
          <KeyRound size={24} className="shrink-0 text-brand-600 dark:text-brand-400" />
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
              {s.done ? <s.icon size={18} strokeWidth={2.4} /> : <Circle size={10} />}
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

      {/* Livreur en route : sa position s'ouvre dans Google Maps */}
      {!isPickup && order.status === "delivering" && (
        <div className="mb-6 flex flex-col items-center gap-1.5">
          {hasCoords(courierPlace) ? (
            <>
              <a
                href={mapsUrl(courierPlace)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex w-full items-center justify-center gap-2 py-3 sm:w-auto sm:px-6"
              >
                <Bike size={18} /> Voir mon livreur sur Google Maps
              </a>
              <p className="text-center text-xs muted">
                Position {order.courier.position_at ? timeAgo(order.courier.position_at) : "récente"}
                {courierKm != null && ` · à environ ${courierKm.toFixed(1).replace(".", ",")} km de chez vous`}
              </p>
            </>
          ) : (
            <p className="text-center text-sm muted">Le livreur n'a pas encore partagé sa position.</p>
          )}
        </div>
      )}

      {order.courier && (
        <div className="mb-6 flex items-center gap-4 rounded-xl bg-brand-50 p-4 dark:bg-brand-950">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-800">
            <Bike size={24} className="text-brand-600 dark:text-brand-400" />
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
                <a
                  href={mapsUrl(destination)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  {order.customer_address}
                  <ExternalLink size={13} className="ml-1 inline align-[-2px]" />
                </a>{" "}
                ({order.zone})
                {order.landmark && (
                  <span className="mt-0.5 flex items-center justify-end gap-1 text-xs muted">
                    <Compass size={12} />
                    {order.landmark}
                  </span>
                )}
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
          <span>{order.payment_method === "livraison" ? (isPickup ? "Au retrait" : "À la livraison") : "Carte bancaire (à régler)"}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between gap-3 text-green-600">
            <span>Remise ({order.promo_code})</span>
            <span>−{formatPrice(order.discount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5 muted">
            <Wallet size={14} /> Total
          </span>
          <span className="font-bold">{formatPrice(order.total, currency)}</span>
        </div>
      </div>

      {order.status === "delivered" && (
        <div className="mt-6 border-t border-gray-200 pt-5 dark:border-slate-700">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <MessageSquarePlus size={18} className="text-brand-600 dark:text-brand-400" />
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
