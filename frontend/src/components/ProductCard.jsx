import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Flame, Plus } from "lucide-react";
import { formatPrice } from "../format";
import { useShop } from "../context/ShopContext";
import { useCart } from "../context/CartContext";
import ProductVisual from "./ProductVisual";

export default function ProductCard({ product }) {
  const { currency } = useShop();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const outOfStock = product.total_stock === 0;

  // Ajout direct possible seulement s'il n'y a pas de variante à choisir
  const single = product.variants.length === 1 ? product.variants[0] : null;
  const canQuickAdd = single && single.stock > 0;
  // Prix barré : celui de la variante la moins chère, si elle est en promo
  const cheapest = product.variants.find((v) => v.price === product.price_min);
  const oldPrice =
    cheapest?.old_price > cheapest?.price ? cheapest.old_price : null;
  const badgeLabel = product.clearance
    ? "Liquidation"
    : product.badge === "Promo" && product.promo_percent
      ? `-${product.promo_percent} %`
      : product.badge;

  const quickAdd = () => {
    addItem(product, single, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800">
      <Link to={`/products/${product.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden">
          <ProductVisual
            product={product}
            width={320}
            className={`transition duration-500 group-hover:scale-105 ${outOfStock ? "opacity-50 grayscale" : ""}`}
          />
          {badgeLabel && (
            <span
              className={`absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                product.clearance || product.badge === "Promo"
                  ? "bg-accent-400 text-gray-950"
                  : "bg-brand-700 text-white"
              }`}
            >
              {product.clearance && (
                <Flame size={12} className="fill-current" />
              )}
              {badgeLabel}
            </span>
          )}
          {outOfStock && (
            <span className="absolute bottom-2 left-2 rounded-full bg-gray-800 px-2 py-1 text-xs font-semibold text-white">
              Épuisé
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-gray-900 transition group-hover:text-brand-600 sm:text-base dark:text-gray-100">
            {product.name}
          </h3>
          <div className="mt-auto pt-1">
            <p className="text-base leading-tight font-extrabold text-gray-900 dark:text-white">
              {product.price_min !== product.price_max && (
                <span className="mr-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                  dès
                </span>
              )}
              {formatPrice(product.price_min, currency)}
            </p>
            {oldPrice && (
              <p className="text-xs text-gray-600 line-through dark:text-slate-400">
                {formatPrice(oldPrice, currency)}
              </p>
            )}
          </div>
        </div>
      </Link>
      {canQuickAdd ? (
        <button
          onClick={quickAdd}
          aria-label={`Ajouter ${product.name} au panier`}
          className="mx-3 mb-3 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 text-sm font-semibold text-white hover:bg-brand-800 sm:mx-4"
        >
          {added ? <Check size={16} /> : <Plus size={16} />}{" "}
          {added ? "Ajouté" : "Ajouter"}
        </button>
      ) : !outOfStock ? (
        <Link
          to={`/products/${product.id}`}
          className="btn-outline mx-3 mb-3 flex min-h-11 items-center justify-center text-sm sm:mx-4"
        >
          Choisir
        </Link>
      ) : (
        <p className="mx-3 mb-3 flex min-h-11 items-center justify-center text-sm muted">
          Indisponible
        </p>
      )}
      <span role="status" className="sr-only">
        {added ? `${product.name} ajouté au panier` : ""}
      </span>
    </div>
  );
}
