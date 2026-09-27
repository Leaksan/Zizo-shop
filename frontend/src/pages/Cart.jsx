import { useState } from "react";
import { Link } from "react-router-dom";
import { Gift, ShoppingCart, Tag, X } from "lucide-react";
import { formatPrice } from "../format";
import { computeTotals, feeRange } from "../cartMath";
import { useCart } from "../context/CartContext";
import { useShop } from "../context/ShopContext";
import ProductVisual from "../components/ProductVisual";

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal, promo, applyPromo, clearPromo } = useCart();
  const shop = useShop();
  const { currency } = shop;
  const [code, setCode] = useState(promo?.code || "");
  const [promoMsg, setPromoMsg] = useState(null);
  const [checking, setChecking] = useState(false);

  // La zone n'est connue qu'à la commande : on calcule avec le plus petit tarif
  // et on l'indique (« dès … ») quand les tarifs varient selon le quartier.
  const range = feeRange(shop);
  const feeVaries = range.min !== range.max;
  const totals = computeTotals(subtotal, promo, { ...shop, deliveryFee: range.min });
  // Offerte quel que soit le quartier (seuil atteint ou code « livraison offerte »)
  const freeForAll =
    computeTotals(subtotal, promo, { ...shop, deliveryFee: range.max }).deliveryFee === 0;

  const handleApply = async () => {
    if (!code.trim()) return;
    setChecking(true);
    setPromoMsg(null);
    try {
      const p = await applyPromo(code.trim().toUpperCase());
      setPromoMsg({ ok: true, text: `🎉 Code appliqué : ${p.label}` });
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
          Découvrir la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <ShoppingCart size={24} className="text-indigo-600 dark:text-indigo-400" />
        Mon panier
      </h1>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div
            key={item.variant_id}
            className="card grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 p-4 sm:flex sm:gap-4"
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
              <ProductVisual product={item} size="text-3xl" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.product_name}</p>
              <p className="text-sm muted">{item.variant_name}</p>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {formatPrice(item.unit_price, currency)} / unité
              </p>
            </div>
            <div className="col-start-1 row-start-2 flex items-center justify-self-start rounded-lg border border-gray-300 sm:col-auto sm:row-auto dark:border-slate-600">
              <button
                onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                className="px-3 py-1.5 font-bold text-gray-600 hover:text-indigo-600 dark:text-slate-300"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
              <button
                onClick={() =>
                  updateQuantity(item.variant_id, Math.min(item.stock, item.quantity + 1))
                }
                className="px-3 py-1.5 font-bold text-gray-600 hover:text-indigo-600 dark:text-slate-300"
              >
                +
              </button>
            </div>
            <p className="col-start-2 row-start-2 text-left font-bold sm:col-auto sm:row-auto sm:w-24 sm:text-right">
              {formatPrice(item.unit_price * item.quantity, currency)}
            </p>
            <button
              onClick={() => removeItem(item.variant_id)}
              className="col-start-3 row-start-1 text-gray-400 transition hover:scale-110 hover:text-red-600 sm:col-auto sm:row-auto"
              title="Retirer"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-6 flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE PROMO"
            className="input flex-1 font-semibold uppercase"
          />
          <button onClick={handleApply} disabled={checking} className="btn-outline px-4 py-2">
            {checking ? "…" : "Appliquer"}
          </button>
        </div>
        {promoMsg && (
          <p className={`text-sm font-medium ${promoMsg.ok ? "text-green-600" : "text-red-600"}`}>
            {promoMsg.text}
          </p>
        )}
        {!promo && !promoMsg && (
          <p className="flex items-center gap-1.5 text-xs muted">
            <Tag size={13} /> Essayez BIENVENUE10 pour -10 %
          </p>
        )}

        <div className="flex flex-col gap-1 border-t border-gray-200 pt-3 text-sm dark:border-slate-700">
          <div className="flex justify-between muted">
            <span>Sous-total</span>
            <span>{formatPrice(totals.subtotal, currency)}</span>
          </div>
          {totals.promoBlocked && (
            <p className="text-xs text-amber-600">
              Code {promo.code} : valable dès {formatPrice(promo.min_order, currency)} d'achat.
            </p>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between font-semibold text-green-600">
              <span>Remise ({promo.code})</span>
              <span>−{formatPrice(totals.discount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between muted">
            <span>Livraison</span>
            <span className={freeForAll ? "flex items-center gap-1 font-semibold text-green-600" : ""}>
              {freeForAll ? (
                <><Gift size={14} /> Offerte</>
              ) : feeVaries ? (
                `Dès ${formatPrice(range.min, currency)}`
              ) : (
                formatPrice(totals.deliveryFee, currency)
              )}
            </span>
          </div>
          <div className="flex justify-between border-t border-dashed border-gray-300 pt-2 text-lg font-bold dark:border-slate-600">
            <span>{feeVaries && !freeForAll ? "Total estimé" : "Total"}</span>
            <span>{formatPrice(totals.total, currency)}</span>
          </div>
        </div>
        <Link to="/checkout" className="btn-primary mt-2 py-3 text-center">
          Passer la commande →
        </Link>
      </div>
    </div>
  );
}
