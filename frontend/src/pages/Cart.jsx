import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Gift, Info, ShoppingCart, Tag, Truck, X, XCircle } from "lucide-react";
import { formatPrice } from "../format";
import { computeCart, feeRange } from "../cartMath";
import { useCart } from "../context/CartContext";
import { useShop } from "../context/ShopContext";
import ProductVisual from "../components/ProductVisual";
import ShopAvatar from "../components/ShopAvatar";

export default function Cart() {
  const { items, updateQuantity, removeItem, promo, applyPromo, clearPromo } = useCart();
  const settings = useShop();
  const { currency } = settings;
  const [code, setCode] = useState(promo?.code || "");
  const [promoMsg, setPromoMsg] = useState(null);
  const [checking, setChecking] = useState(false);

  // La zone n'est connue qu'à la commande : on calcule avec le plus petit tarif
  // et on l'indique (« dès … ») quand les tarifs varient selon le quartier.
  const range = feeRange(settings);
  const feeVaries = range.min !== range.max;
  const cart = computeCart(items, promo, { ...settings, deliveryFee: range.min });
  // Offerte quel que soit le quartier (seuils atteints ou code « livraison offerte »)
  const freeForAll = computeCart(items, promo, { ...settings, deliveryFee: range.max }).deliveryFee === 0;
  const threshold = settings.freeShippingThreshold;

  const handleApply = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setPromoMsg(null);
    try {
      const p = await applyPromo(code.trim().toUpperCase());
      setPromoMsg({ ok: true, text: `Code appliqué : ${p.label}` });
    } catch (e) {
      clearPromo();
      setPromoMsg({ ok: false, text: e.message });
    } finally {
      setChecking(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingCart size={56} className="mx-auto text-gray-300 dark:text-slate-600" strokeWidth={1.2} />
        <p className="mt-4 text-lg text-gray-600 dark:text-slate-300">Votre panier est vide.</p>
        <Link to="/boutique" className="btn-primary mt-6 inline-block px-6 py-2.5">
          Découvrir les produits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-20 md:pb-0">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
        <ShoppingCart size={24} className="text-brand-600 dark:text-brand-400" />
        Mon panier
      </h1>

      {cart.groups.length > 1 && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-950/50 dark:text-brand-200">
          <Info size={17} className="mt-0.5 shrink-0" />
          Vos articles viennent de {cart.groups.length} boutiques : une commande et une livraison par
          boutique (le livreur passe chez chaque vendeur).
        </p>
      )}

      <div className="flex flex-col gap-4">
        {cart.groups.map((group) => {
          const afterDiscount = group.subtotal - group.discount;
          const missing = threshold > 0 ? Math.max(0, threshold - afterDiscount) : 0;
          const progress = threshold > 0 ? Math.min(100, (afterDiscount / threshold) * 100) : 0;
          return (
            <section key={group.shop?.id ?? 0} className="card overflow-hidden">
              {group.shop && (
                <Link
                  to={`/b/${group.shop.slug}`}
                  className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-sm font-semibold hover:text-brand-600 dark:border-slate-700"
                >
                  <ShopAvatar shop={group.shop} className="h-6 w-6 text-[11px]" />
                  {group.shop.name}
                </Link>
              )}
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {group.items.map((item) => (
                  <div
                    key={item.variant_id}
                    className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 p-4 sm:flex sm:gap-4"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                      <ProductVisual product={item} width={160} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.product_name}</p>
                      <p className="text-sm muted">{item.variant_name}</p>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                        {formatPrice(item.unit_price, currency)} / unité
                      </p>
                    </div>
                    <div className="col-span-2 col-start-1 row-start-2 flex items-center justify-self-start rounded-lg border border-gray-300 sm:col-auto sm:row-auto dark:border-slate-600">
                      <button
                        onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                        className="px-3 py-1.5 font-bold text-gray-600 hover:text-brand-600 dark:text-slate-300"
                        aria-label="Retirer un"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variant_id, Math.min(item.stock, item.quantity + 1))}
                        className="px-3 py-1.5 font-bold text-gray-600 hover:text-brand-600 dark:text-slate-300"
                        aria-label="Ajouter un"
                      >
                        +
                      </button>
                    </div>
                    <p className="col-span-2 col-start-2 row-start-2 justify-self-end font-bold sm:col-auto sm:row-auto sm:w-24 sm:justify-self-auto sm:text-right">
                      {formatPrice(item.unit_price * item.quantity, currency)}
                    </p>
                    <button
                      onClick={() => removeItem(item.variant_id)}
                      className="col-start-3 row-start-1 text-gray-400 transition hover:scale-110 hover:text-red-600 sm:col-auto sm:row-auto"
                      title="Retirer"
                      aria-label={`Retirer ${item.product_name}`}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
              {threshold > 0 && (
                <div className="border-t border-gray-100 px-4 py-3 dark:border-slate-700">
                  <p className="flex items-center gap-2 text-xs font-semibold">
                    {missing > 0 ? (
                      <>
                        <Truck size={15} className="text-brand-600 dark:text-brand-400" />
                        <span>
                          Plus que <b className="text-brand-600 dark:text-brand-400">{formatPrice(missing, currency)}</b>
                          {cart.groups.length > 1 ? " dans cette boutique" : ""} pour la livraison offerte
                        </span>
                      </>
                    ) : (
                      <>
                        <Gift size={15} className="text-green-600" />
                        <span className="text-green-700 dark:text-green-400">Livraison offerte !</span>
                      </>
                    )}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${missing > 0 ? "bg-brand-500" : "bg-green-500"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="card mt-6 flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE PROMO"
            aria-label="Code promo"
            className="input flex-1 font-semibold uppercase"
          />
          <button onClick={handleApply} disabled={checking} className="btn-outline px-4 py-2">
            {checking ? "…" : "Appliquer"}
          </button>
        </div>
        {promoMsg && (
          <p className={`flex items-center gap-1.5 text-sm font-medium ${promoMsg.ok ? "text-green-600" : "text-red-600"}`}>
            {promoMsg.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {promoMsg.text}
          </p>
        )}
        {!promo && !promoMsg && (
          <p className="flex items-center gap-1.5 text-xs muted">
            <Tag size={13} /> Les codes promo s'appliquent aux produits de la boutique officielle.
          </p>
        )}

        <div className="flex flex-col gap-1 border-t border-gray-200 pt-3 text-sm dark:border-slate-700">
          <div className="flex justify-between muted">
            <span>Sous-total</span>
            <span>{formatPrice(cart.subtotal, currency)}</span>
          </div>
          {cart.promoNotApplicable && (
            <p className="text-xs text-accent-700 dark:text-accent-400">
              Code {promo.code} : valable seulement sur les produits de la boutique officielle.
            </p>
          )}
          {cart.promoBlocked && (
            <p className="text-xs text-accent-700 dark:text-accent-400">
              Code {promo.code} : valable dès {formatPrice(promo.min_order, currency)} d'achat dans la boutique officielle.
            </p>
          )}
          {cart.discount > 0 && (
            <div className="flex justify-between font-semibold text-green-600">
              <span>Remise ({promo.code})</span>
              <span>−{formatPrice(cart.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between muted">
            <span>Livraison{cart.groups.length > 1 ? ` (${cart.groups.length} boutiques)` : ""}</span>
            <span className={freeForAll ? "flex items-center gap-1 font-semibold text-green-600" : ""}>
              {freeForAll ? (
                <>
                  <Gift size={14} /> Offerte
                </>
              ) : feeVaries ? (
                `Dès ${formatPrice(cart.deliveryFee, currency)}`
              ) : (
                formatPrice(cart.deliveryFee, currency)
              )}
            </span>
          </div>
          <div className="flex justify-between border-t border-dashed border-gray-300 pt-2 text-lg font-bold dark:border-slate-600">
            <span>{feeVaries && !freeForAll ? "Total estimé" : "Total"}</span>
            <span>{formatPrice(cart.total, currency)}</span>
          </div>
        </div>
        <Link to="/checkout" className="btn-primary mt-2 flex items-center justify-center gap-2 py-3">
          Passer la commande
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* Mobile : total et bouton de commande toujours visibles, au-dessus des onglets */}
      <div className="cart-cta fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden dark:border-slate-700 dark:bg-slate-900/95">
        <div className="min-w-0 flex-1">
          <p className="text-xs muted">{feeVaries && !freeForAll ? "Total estimé" : "Total"}</p>
          <p className="text-lg leading-tight font-extrabold">{formatPrice(cart.total, currency)}</p>
        </div>
        <Link to="/checkout" className="btn-primary shrink-0 px-6 py-3 text-base">
          Commander
        </Link>
      </div>
    </div>
  );
}
