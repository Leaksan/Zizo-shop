import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, Bike, CheckCircle2, ChevronDown, MapPin, Package, Store } from "lucide-react";
import { api } from "../api";
import { play } from "../sounds";
import { formatPrice } from "../format";
import { computeCart, feeForZone } from "../cartMath";
import { useCart } from "../context/CartContext";
import { useShop } from "../context/ShopContext";
import AddressInput from "../components/AddressInput";
import LocationPicker from "../components/LocationPicker";
import ShopAvatar from "../components/ShopAvatar";
import { normalize } from "../libreville";
import { rememberOrder } from "../myOrders";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";

const STORAGE_KEY = "shop_client";

export default function Checkout() {
  const { items, promo, clearCart } = useCart();
  const shop = useShop();
  const { currency, zones, shopPhone, pickupAddress } = shop;
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");
  const [form, setForm] = useState(() => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      saved = {};
    }
    return {
      customer_name: saved.customer_name || "",
      customer_phone: saved.customer_phone || "",
      customer_email: saved.customer_email || "",
      customer_address: saved.customer_address || "",
      landmark: saved.landmark || "",
      zone: saved.zone || zones[0] || "",
      note: "",
      payment_method: "livraison",
    };
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Récapitulatif replié sur mobile (le total reste visible), ouvert sur grand écran
  const [wide] = useState(() => window.matchMedia("(min-width: 768px)").matches);

  // Les zones arrivent de façon asynchrone : sélectionner la première par défaut
  // si le client n'en a pas déjà une d'enregistrée, sinon la valeur soumise est vide.
  useEffect(() => {
    if (zones.length > 0 && !zones.includes(form.zone)) {
      setForm((f) => ({ ...f, zone: zones.includes(f.zone) ? f.zone : zones[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones.length]);

  // Une commande par boutique, chacune avec ses frais (même calcul que le serveur)
  const cart = computeCart(
    items,
    promo,
    deliveryMethod === "pickup"
      ? { deliveryFee: 0, freeShippingThreshold: 0 }
      : { ...shop, deliveryFee: feeForZone(shop, form.zone) }
  );
  // Un code sans effet (pas de produit officiel, minimum non atteint) n'est pas envoyé :
  // le serveur refuserait toute la commande
  const usablePromo = promo && !cart.promoNotApplicable && !cart.promoBlocked ? promo : null;

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-gray-600 dark:text-slate-300">Votre panier est vide.</p>
        <Link to="/boutique" className="mt-4 inline-flex items-center gap-1.5 text-brand-600 hover:underline">
          <ArrowLeft size={16} />
          Retour à la boutique
        </Link>
      </div>
    );
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const matchZone = (zoneText) => {
    if (!zoneText) return null;
    const n = normalize(zoneText).trim();
    if (!n) return null;
    return (
      zones.find((z) => normalize(z) === n) ||
      zones.find((z) => n.includes(normalize(z)) || normalize(z).includes(n)) ||
      null
    );
  };

  // Suggestion choisie : elle complète l'adresse et le quartier (la position, elle, vient du
  // téléphone : une suggestion ne dit pas où est la porte)
  const handlePickPlace = (place) => {
    setForm((f) => ({
      ...f,
      customer_address: place.name,
      zone: matchZone(place.zone) || f.zone,
    }));
  };

  // Position du téléphone : si l'adresse est encore vide, on propose celle du lieu
  const pickPosition = async (pos) => {
    setPosition(pos);
    if (!pos || form.customer_address.trim()) return;
    try {
      const result = await api.get(`/geocode/reverse?lat=${pos.latitude}&lng=${pos.longitude}`);
      if (result.name) {
        setForm((f) => ({
          ...f,
          customer_address: f.customer_address.trim() ? f.customer_address : result.name,
          zone: matchZone(result.zone) || f.zone,
        }));
      }
    } catch {
      // pas d'adresse trouvée : le client l'écrit lui-même
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { orders } = await api.post("/orders", {
        ...form,
        delivery_method: deliveryMethod,
        latitude: deliveryMethod === "delivery" ? (position?.latitude ?? null) : null,
        longitude: deliveryMethod === "delivery" ? (position?.longitude ?? null) : null,
        promo_code: usablePromo?.code || null,
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      });
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email,
          customer_address: form.customer_address,
          landmark: form.landmark,
          zone: form.zone,
        })
      );
      orders.forEach(rememberOrder);
      clearCart();
      play("commande");
      navigate(`/order-confirmation/${orders.map((o) => o.reference).join(",")}`);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
          <Package size={24} className="text-brand-600 dark:text-brand-400" />
          Finaliser ma commande
        </h1>
        <p className="mb-5 text-sm muted">Remplissez vos informations de livraison.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Nom complet *</span>
              <input required autoComplete="name" value={form.customer_name} onChange={set("customer_name")} className="input" placeholder="Ex. Awa Mba" />
            </label>
            <label className="block">
              <span className="label">Téléphone *</span>
              <input required type="tel" inputMode="tel" autoComplete="tel" value={form.customer_phone} onChange={set("customer_phone")} className="input" placeholder="Ex. 077 12 34 56" />
            </label>
          </div>
          <label className="block">
            <span className="label">Email (optionnel)</span>
            <input type="email" inputMode="email" autoComplete="email" value={form.customer_email} onChange={set("customer_email")} className="input" placeholder="Pour recevoir un récapitulatif" />
          </label>
          <div>
            <span className="label">Comment souhaitez-vous récupérer votre commande ? *</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "delivery", icon: Bike, label: "Livraison à domicile", sub: "Partout à Libreville" },
                { value: "pickup", icon: Store, label: "Retrait en boutique", sub: "Gratuit" },
              ].map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition ${
                    deliveryMethod === m.value
                      ? "border-brand-600 bg-brand-50 dark:bg-brand-950"
                      : "border-gray-200 dark:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery_method"
                    value={m.value}
                    checked={deliveryMethod === m.value}
                    onChange={() => setDeliveryMethod(m.value)}
                    className="accent-brand-600"
                  />
                  <m.icon
                    size={20}
                    className={deliveryMethod === m.value ? "text-brand-600" : "text-gray-400"}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{m.label}</span>
                    <span className="text-xs muted">{m.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {deliveryMethod === "pickup" ? (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
              <p className="flex items-center gap-2 font-semibold">
                <Store size={16} />
                Retrait gratuit en boutique
              </p>
              {/* Chaque vendeur remet ses articles : son adresse s'affiche dans le suivi */}
              {cart.groups.map((group) => (
                <p key={group.shop?.id ?? 0} className="mt-1 flex items-start gap-1.5">
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  <span>
                    {cart.groups.length > 1 && group.shop && <b>{group.shop.name} : </b>}
                    {!group.shop || group.shop.official
                      ? pickupAddress
                      : "adresse de la boutique indiquée dans le suivi de la commande"}
                  </span>
                </p>
              ))}
              <p className="mt-1 text-xs opacity-80">
                {cart.groups.length > 1
                  ? "Vous recevrez un numéro par boutique : présentez-le au vendeur lors du retrait."
                  : "Vous recevrez votre numéro de commande : présentez-le lors du retrait."}
              </p>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="label">Adresse de livraison * (Libreville)</span>
                <AddressInput
                  value={form.customer_address}
                  onChange={(v) => setForm({ ...form, customer_address: v })}
                  onPick={handlePickPlace}
                  required={deliveryMethod === "delivery"}
                />
                <span className="mt-1 block text-xs muted">
                  Commencez à taper pour voir des suggestions de quartiers et lieux de Libreville.
                </span>
              </label>
              <div>
                <span className="label">Votre position (conseillé)</span>
                <LocationPicker
                  value={position}
                  onChange={pickPosition}
                  hint="Le livreur et la boutique l'ouvrent dans Google Maps pour vous trouver. Votre téléphone vous demande l'autorisation."
                />
              </div>
              <label className="block">
                <span className="label">Quartier / zone de livraison *</span>
                <select value={form.zone} onChange={set("zone")} className="input">
                  {zones.length === 0 && <option value="">—</option>}
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z} — {formatPrice(feeForZone(shop, z), currency)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Point de repère (conseillé)</span>
                <input
                  value={form.landmark}
                  onChange={set("landmark")}
                  maxLength={300}
                  className="input"
                  placeholder="Ex. Derrière la pharmacie X, portail bleu, après le carrefour Y"
                />
                <span className="mt-1 block text-xs muted">
                  Aide le livreur à vous trouver rapidement.
                </span>
              </label>
            </>
          )}
          <label className="block">
            <span className="label">
              {deliveryMethod === "pickup"
                ? "Note pour la boutique (optionnel)"
                : "Note pour le livreur (optionnel)"}
            </span>
            <input value={form.note} onChange={set("note")} className="input" placeholder="Ex. Code porte 1234, sonner 2 fois…" />
          </label>

          <div>
            <span className="label">Mode de paiement *</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  value: "livraison",
                  label: deliveryMethod === "pickup" ? "Au retrait en boutique" : "À la livraison",
                },
                // Pas encore de paiement en ligne branché : pas d'option carte.
              ].map((p) => (
                <label
                  key={p.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition ${
                    form.payment_method === p.value
                      ? "border-brand-600 bg-brand-50 dark:bg-brand-950"
                      : "border-gray-200 dark:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={p.value}
                    checked={form.payment_method === p.value}
                    onChange={set("payment_method")}
                    className="accent-brand-600"
                  />
                  <Banknote size={17} className="text-brand-600 dark:text-brand-400" />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary flex items-center justify-center gap-2 py-3">
            <CheckCircle2 size={18} />
            {submitting ? "Envoi…" : `Confirmer la commande — ${formatPrice(cart.total, currency)}`}
          </button>
          <p className="-mt-1 flex items-center justify-center gap-1.5 text-xs muted">
            <Banknote size={14} /> Aucun paiement maintenant : vous payez à la réception.
          </p>
        </form>
        {shopPhone && (
          <a
            href={whatsappUrl(shopPhone, "Bonjour, j'ai besoin d'aide pour ma commande.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-green-700 hover:underline dark:text-green-400"
          >
            <WhatsAppIcon size={18} /> Besoin d'aide ? Écrivez-nous sur WhatsApp
          </a>
        )}
      </div>

      <details open={wide} className="card group order-first h-fit p-4 md:order-none">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            Récapitulatif{" "}
            <span className="font-normal muted">
              ({items.reduce((n, i) => n + i.quantity, 0)} article
              {items.reduce((n, i) => n + i.quantity, 0) > 1 ? "s" : ""})
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            {formatPrice(cart.total, currency)}
            <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {cart.groups.map((group) => (
            <div key={group.shop?.id ?? 0}>
              {cart.groups.length > 1 && group.shop && (
                <p className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <ShopAvatar shop={group.shop} className="h-5 w-5 text-[10px]" />
                    {group.shop.name}
                  </span>
                  <span className="font-normal muted">
                    Livraison : {group.deliveryFee === 0 ? "offerte" : formatPrice(group.deliveryFee, currency)}
                  </span>
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {group.items.map((i) => (
                  <li key={i.variant_id} className="flex justify-between gap-2">
                    <span className="text-gray-600 dark:text-slate-300">
                      {i.product_name} ({i.variant_name}) × {i.quantity}
                    </span>
                    <span className="font-medium">{formatPrice(i.unit_price * i.quantity, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {cart.groups.length > 1 && (
            <p className="text-xs muted">
              {cart.groups.length} commandes, une par boutique : chacune a sa référence et son suivi.
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t border-gray-200 pt-3 text-sm dark:border-slate-700">
          <div className="flex justify-between muted">
            <span>Sous-total</span>
            <span>{formatPrice(cart.subtotal, currency)}</span>
          </div>
          {cart.promoNotApplicable && (
            <p className="text-xs text-accent-700 dark:text-accent-400">
              Code {promo.code} : valable seulement sur les produits de la boutique officielle (non appliqué).
            </p>
          )}
          {cart.promoBlocked && (
            <p className="text-xs text-accent-700 dark:text-accent-400">
              Code {promo.code} : valable dès {formatPrice(promo.min_order, currency)} d'achat dans la boutique officielle (non appliqué).
            </p>
          )}
          {cart.discount > 0 && (
            <div className="flex justify-between font-semibold text-green-600">
              <span>Remise ({promo.code})</span>
              <span>−{formatPrice(cart.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between muted">
            <span>Livraison</span>
            <span>
              {cart.deliveryFee === 0 ? "Offerte" : formatPrice(cart.deliveryFee, currency)}
            </span>
          </div>
          <div className="flex justify-between border-t border-dashed border-gray-300 pt-2 text-base font-bold dark:border-slate-600">
            <span>Total à payer</span>
            <span>{formatPrice(cart.total, currency)}</span>
          </div>
        </div>
      </details>
    </div>
  );
}
