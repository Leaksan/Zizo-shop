import { Link } from "react-router-dom";
import { Flame, Heart } from "lucide-react";
import { formatPrice } from "../format";
import { useShop } from "../context/ShopContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductVisual from "./ProductVisual";
import Rating from "./Rating";

export default function ProductCard({ product }) {
  const { currency } = useShop();
  const { isFavorite, toggle } = useFavorites();
  const outOfStock = product.total_stock === 0;
  const fav = isFavorite(product.id);

  const badgeLabel = product.clearance
    ? "Liquidation"
    : product.badge === "Promo" && product.promo_percent
      ? `-${product.promo_percent} %`
      : product.badge;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <button
        onClick={() => toggle(product.id)}
        title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
        className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition hover:scale-125 dark:bg-slate-700"
      >
        <Heart
          size={16}
          className={`transition ${fav ? "fill-red-500 text-red-500" : "text-gray-400"}`}
        />
      </button>
      <Link to={`/products/${product.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden">
          <ProductVisual
            product={product}
            size="text-6xl"
            width={320}
            className="transition duration-500 group-hover:scale-110"
          />
          {badgeLabel && (
            <span
              className={`absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white ${
                product.clearance
                  ? "bg-orange-500"
                  : product.badge === "Promo"
                    ? "bg-red-600"
                    : "bg-indigo-600"
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
        <div className="flex flex-1 flex-col gap-1 p-4">
          {product.category && (
            <span className="text-xs font-medium tracking-wide text-indigo-500 uppercase">
              {product.category}
            </span>
          )}
          <h3 className="font-semibold text-gray-900 transition group-hover:text-indigo-600 dark:text-gray-100">
            {product.name}
          </h3>
          {(product.real_reviews_count > 0 || product.rating > 0) && (
            <Rating
              value={product.real_reviews_count > 0 ? product.real_rating : product.rating}
              count={
                product.real_reviews_count > 0 ? product.real_reviews_count : product.reviews_count
              }
            />
          )}
          <div className="mt-auto flex items-baseline gap-2 pt-2">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {product.price_min === product.price_max
                ? formatPrice(product.price_min, currency)
                : `${formatPrice(product.price_min, currency)} – ${formatPrice(product.price_max, currency)}`}
            </span>
          </div>
          {product.variants.length > 1 && (
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {product.variants.length} variantes
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
