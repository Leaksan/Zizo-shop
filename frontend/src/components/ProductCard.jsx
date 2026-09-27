import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Flame, Heart, Plus, Star } from "lucide-react";
import { formatPrice } from "../format";
import { useShop } from "../context/ShopContext";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductVisual from "./ProductVisual";

const LOW_STOCK = 5;

export default function ProductCard({ product }) {
  const { currency } = useShop();
  const { addItem } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const [added, setAdded] = useState(false);
  const outOfStock = product.total_stock === 0;
  const fav = isFavorite(product.id);

  // Ajout direct possible seulement s'il n'y a pas de variante à choisir
  const single = product.variants.length === 1 ? product.variants[0] : null;
  const canQuickAdd = single && single.stock > 0;
  // Prix barré : celui de la variante la moins chère, si elle est en promo
  const cheapest = product.variants.find((v) => v.price === product.price_min);
  const oldPrice = cheapest?.old_price > cheapest?.price ? cheapest.old_price : null;
  const lowStock = !outOfStock && product.total_stock <= LOW_STOCK;
  const rating = product.real_reviews_count > 0 ? product.real_rating : product.rating;
  const ratingCount =
    product.real_reviews_count > 0 ? product.real_reviews_count : product.reviews_count;

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
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <button
        onClick={() => toggle(product.id)}
        aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow transition hover:scale-110 dark:bg-slate-700"
      >
        <Heart
          size={17}
          className={`transition ${fav ? "fill-red-500 text-red-500" : "text-gray-400"}`}
        />
      </button>
      <Link to={`/products/${product.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden">
          <ProductVisual
            product={product}
            size="text-6xl"
            width={320}
            className={`transition duration-500 group-hover:scale-105 ${outOfStock ? "opacity-50 grayscale" : ""}`}
          />
          {badgeLabel && (
            <span
              className={`absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white ${
                product.clearance
                  ? "bg-orange-500"
                  : product.badge === "Promo"
                    ? "bg-red-600"
                    : "bg-brand-600"
              }`}
            >
              {product.clearance && <Flame size={12} className="fill-white" />}
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
          {rating > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <b className="font-semibold text-gray-700 dark:text-slate-200">
                {rating.toFixed(1).replace(".", ",")}
              </b>
              {ratingCount > 0 && `(${ratingCount})`}
            </span>
          )}
          <div className="mt-auto pt-1 pr-10">
            <p className="text-base leading-tight font-extrabold text-gray-900 dark:text-white">
              {product.price_min !== product.price_max && (
                <span className="mr-1 text-xs font-medium text-gray-500 dark:text-slate-400">dès</span>
              )}
              {formatPrice(product.price_min, currency)}
            </p>
            {oldPrice && (
              <p className="text-xs text-gray-400 line-through dark:text-slate-500">
                {formatPrice(oldPrice, currency)}
              </p>
            )}
            {lowStock && (
              <p className="mt-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
                Plus que {product.total_stock} en stock
              </p>
            )}
          </div>
        </div>
      </Link>
      {canQuickAdd && (
        <button
          onClick={quickAdd}
          aria-label={`Ajouter ${product.name} au panier`}
          className={`absolute right-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md transition active:scale-90 ${
            added ? "bg-green-600" : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {added ? <Check size={18} /> : <Plus size={20} />}
        </button>
      )}
    </div>
  );
}
