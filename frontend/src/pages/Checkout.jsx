import { lazy, Suspense, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, CheckCircle2, MapPin } from "lucide-react";
import { api } from "../api";
import { formatPrice } from "../format";
import { computeTotals, feeForZone } from "../cartMath";
import { useCart } from "../context/CartContext";
import { useShop } from "../context/ShopContext";
import AddressInput from "../components/AddressInput";
import { normalize } from "../libreville";
import { rememberOrder } from "../myOrders";
import { whatsappUrl } from "../whatsapp";

const DeliveryMap = lazy(() => import("../components/DeliveryMap"));
const STORAGE_KEY = "shop_client";

export default function Checkout() {
  const { items, subtotal, promo, clearCart } = useCart();
  const shop = useShop();
  const { currency, zones, shopPhone, pickupAddress } = shop;
  const navigate = useNavigate();
  const submittingRef = useRef(false);
  const extrasRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");
  const [suggestedZone, setSuggestedZone] = useState("");
  const [form, setForm] = useState(() => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      /* Préremplissage facultatif. */
    }
    return {
      customer_name: saved.customer_name || "",
      customer_phone: saved.customer_phone || "",
      customer_email: saved.customer_email || "",
      customer_address: saved.customer_address || "",
      landmark: saved.landmark || "",
      zone: saved.zone || "",
      note: "",
      payment_method: "livraison",
    };
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isDelivery = deliveryMethod === "delivery";
  const zone = zones.includes(form.zone) ? form.zone : "";
  const zoneConfirmed = !isDelivery || zones.length === 0 || Boolean(zone);
  const totals = computeTotals(
    subtotal,
    promo,
    isDelivery
      ? { ...shop, deliveryFee: feeForZone(shop, zone) }
      : { deliveryFee: 0, freeShippingThreshold: 0 },
  );
  const stockProblem = items.some(
    (item) => item.stock <= 0 || item.quantity > item.stock,
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateAddress = (address) => {
    setForm((f) => ({ ...f, customer_address: address, zone: "" }));
    setPosition(null);
    setSuggestedZone("");
  };
  const handlePickPlace = (place) => {
    const match = zones.find(
      (z) => normalize(z) === normalize(place.zone || ""),
    );
    setForm((f) => ({ ...f, customer_address: place.name, zone: "" }));
    setSuggestedZone(match || "");
    setPosition(
      Number.isFinite(place.lat) && Number.isFinite(place.lng)
        ? [place.lat, place.lng]
        : null,
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (
      shop.loading ||
      shop.error ||
      !zoneConfirmed ||
      stockProblem ||
      totals.promoBlocked
    ) {
      setError(
        stockProblem
          ? "Un article n’est plus disponible dans cette quantité. Modifiez votre panier."
          : "Confirmez votre quartier pour calculer les frais de livraison.",
      );
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const order = await api.post("/orders", {
        ...form,
        zone: isDelivery ? zone : "",
        delivery_method: deliveryMethod,
        latitude: isDelivery ? (position?.[0] ?? null) : null,
        longitude: isDelivery ? (position?.[1] ?? null) : null,
        promo_code: promo?.code || null,
        items: items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
      });
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            customer_name: form.customer_name,
            customer_phone: form.customer_phone,
            customer_email: form.customer_email,
            customer_address: form.customer_address,
            landmark: form.landmark,
            zone: isDelivery ? zone : form.zone,
          }),
        );
      } catch {
        /* Une commande réussie ne dépend pas du stockage local. */
      }
      rememberOrder(order);
      clearCart();
      navigate(`/order-confirmation/${order.reference}`);
    } catch (err) {
      setError(err.message);
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (items.length === 0)
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Votre panier est vide</h1>
        <Link to="/boutique" className="btn-primary mt-6 inline-block">
          Découvrir la boutique
        </Link>
      </div>
    );
  if (shop.loading)
    return (
      <p role="status" className="py-16 text-center muted">
        Chargement des informations de livraison…
      </p>
    );
  if (shop.error)
    return (
      <div className="py-16 text-center">
        <p role="alert">{shop.error}</p>
        <button onClick={shop.reload} className="btn-primary mt-4">
          Réessayer
        </button>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/cart"
        className="text-sm text-brand-700 hover:underline dark:text-brand-300"
      >
        ← Modifier mon panier
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Votre commande</h1>
      <p className="mt-2 mb-8 muted">Vos coordonnées, puis c’est terminé.</p>
      <form
        onSubmit={handleSubmit}
        onInvalidCapture={(e) => {
          if (extrasRef.current?.contains(e.target))
            extrasRef.current.open = true;
        }}
        className="flex flex-col gap-6"
      >
        <fieldset disabled={submitting} className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Vos coordonnées</legend>
          <label>
            <span className="label">Nom complet</span>
            <input
              required
              autoComplete="name"
              value={form.customer_name}
              onChange={set("customer_name")}
              className="input"
              placeholder="Ex. Awa Mba"
            />
          </label>
          <label>
            <span className="label">Téléphone</span>
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.customer_phone}
              onChange={set("customer_phone")}
              className="input"
              placeholder="Ex. 077 12 34 56"
            />
          </label>
        </fieldset>

        <fieldset disabled={submitting} className="flex flex-col gap-5">
          <legend className="mb-3 text-lg font-semibold">
            {isDelivery ? "Livraison à domicile" : "Retrait en boutique"}
          </legend>
          <button
            type="button"
            onClick={() =>
              setDeliveryMethod(isDelivery ? "pickup" : "delivery")
            }
            className="w-fit text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            {isDelivery
              ? "Retirer en boutique gratuitement"
              : "Choisir la livraison à domicile"}
          </button>
          {isDelivery ? (
            <>
              <div>
                <label htmlFor="delivery-address" className="label">
                  Adresse de livraison
                </label>
                <AddressInput
                  id="delivery-address"
                  value={form.customer_address}
                  onChange={updateAddress}
                  onPick={handlePickPlace}
                  required
                />
              </div>
              {zones.length > 0 && (
                <label>
                  <span className="label">Confirmez votre quartier</span>
                  <select
                    required
                    value={zone}
                    onChange={set("zone")}
                    className="input"
                  >
                    <option value="">Choisir mon quartier</option>
                    {zones.map((z) => (
                      <option key={z} value={z}>
                        {z} — {formatPrice(feeForZone(shop, z), currency)}
                      </option>
                    ))}
                  </select>
                  {suggestedZone && !zone && (
                    <span className="mt-2 block text-sm muted">
                      Quartier suggéré : {suggestedZone}. Sélectionnez-le pour
                      confirmer.
                    </span>
                  )}
                </label>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => setMapOpen((v) => !v)}
                  aria-expanded={mapOpen}
                  aria-controls="delivery-map"
                  className="flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
                >
                  <MapPin size={15} />{" "}
                  {mapOpen
                    ? "Masquer la carte"
                    : "Préciser ma position (facultatif)"}
                </button>
                {mapOpen && (
                  <div id="delivery-map" className="mt-3">
                    <p className="mb-2 text-sm muted">
                      Touchez la carte pour indiquer votre emplacement. Votre
                      adresse et votre quartier restent ceux du formulaire.
                    </p>
                    <Suspense
                      fallback={<p role="status">Chargement de la carte…</p>}
                    >
                      <DeliveryMap
                        position={position}
                        onPick={(lat, lng) => setPosition([lat, lng])}
                      />
                    </Suspense>
                    {position && (
                      <button
                        type="button"
                        onClick={() => setPosition(null)}
                        className="mt-2 text-sm muted hover:underline"
                      >
                        Retirer la position enregistrée
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-gray-100 p-4 dark:bg-slate-800">
              <p className="font-medium">
                {pickupAddress ||
                  "Contactez la boutique pour connaître le lieu de retrait."}
              </p>
              <p className="mt-2 text-sm muted">
                Présentez votre numéro de commande lors du retrait.
              </p>
            </div>
          )}
        </fieldset>

        <details
          ref={extrasRef}
          className="rounded-xl border border-gray-200 p-4 dark:border-slate-700"
        >
          <summary className="cursor-pointer text-sm font-medium">
            Ajouter des précisions (facultatif)
          </summary>
          <fieldset disabled={submitting} className="mt-4 grid gap-4">
            <label>
              <span className="label">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={form.customer_email}
                onChange={set("customer_email")}
                className="input"
                placeholder="Pour recevoir un récapitulatif"
              />
            </label>
            {isDelivery && (
              <label>
                <span className="label">Point de repère</span>
                <input
                  maxLength={300}
                  value={form.landmark}
                  onChange={set("landmark")}
                  className="input"
                  placeholder="Ex. Portail bleu derrière la pharmacie"
                />
              </label>
            )}
            <label>
              <span className="label">
                {isDelivery ? "Note pour le livreur" : "Note pour la boutique"}
              </span>
              <input
                value={form.note}
                onChange={set("note")}
                className="input"
                placeholder="Une précision utile pour votre commande"
              />
            </label>
          </fieldset>
        </details>

        <section
          aria-label="Montant de la commande"
          className="card space-y-3 p-5"
        >
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Voir les articles ({items.reduce((n, i) => n + i.quantity, 0)})
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.variant_id} className="flex justify-between gap-3">
                  <span>
                    {i.product_name} ({i.variant_name}) × {i.quantity}
                  </span>
                  <span className="shrink-0">
                    {formatPrice(i.unit_price * i.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <div className="flex justify-between text-sm">
            <span>Articles</span>
            <span>{formatPrice(totals.subtotal, currency)}</span>
          </div>
          {totals.promoBlocked && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Code {promo.code} : valable dès{" "}
              {formatPrice(promo.min_order, currency)} d’achat.{" "}
              <Link to="/cart" className="underline">
                Modifier ou retirer le code
              </Link>
            </p>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-brand-700 dark:text-brand-300">
              <span>Remise ({promo.code})</span>
              <span>−{formatPrice(totals.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 text-sm">
            <span>{isDelivery ? "Livraison" : "Retrait"}</span>
            <span className="text-right">
              {!zoneConfirmed
                ? "À calculer selon votre quartier"
                : totals.deliveryFee === 0
                  ? isDelivery
                    ? "Offerte"
                    : "Gratuit"
                  : formatPrice(totals.deliveryFee, currency)}
            </span>
          </div>
          <div className="flex justify-between gap-3 border-t border-gray-200 pt-3 text-lg font-bold dark:border-slate-700">
            <span>Total à payer</span>
            <span>
              {zoneConfirmed
                ? formatPrice(totals.total, currency)
                : "Quartier à confirmer"}
            </span>
          </div>
        </section>
        <p className="flex items-center gap-2 text-sm muted">
          <Banknote size={18} className="shrink-0" />
          {isDelivery
            ? "Paiement à la livraison. Aucun paiement maintenant."
            : "Paiement au retrait. Aucun paiement maintenant."}
        </p>
        {stockProblem && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            Un article n’est plus disponible dans cette quantité.{" "}
            <Link to="/cart" className="underline">
              Modifier mon panier
            </Link>
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={
            submitting || !zoneConfirmed || stockProblem || totals.promoBlocked
          }
          className="btn-primary flex min-h-12 items-center justify-center gap-2 text-base"
        >
          <CheckCircle2 size={18} />{" "}
          {submitting
            ? "Envoi…"
            : `Confirmer ma commande${zoneConfirmed ? ` — ${formatPrice(totals.total, currency)}` : ""}`}
        </button>
        {!zoneConfirmed && (
          <p role="status" className="text-sm muted">
            Choisissez votre quartier pour connaître le total et confirmer.
          </p>
        )}
      </form>
      {shopPhone && (
        <a
          href={whatsappUrl(
            shopPhone,
            "Bonjour, j’ai besoin d’aide pour ma commande.",
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 block text-center text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          Besoin d’aide ? Écrivez-nous sur WhatsApp
        </a>
      )}
    </div>
  );
}
