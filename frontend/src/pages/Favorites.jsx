import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Store, Trash2 } from "lucide-react";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import { useFavorites } from "../context/FavoritesContext";

export default function Favorites() {
  const { favorites, clearAll } = useFavorites();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/products")
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const items = useMemo(
    () => products.filter((p) => favorites.includes(p.id)),
    [products, favorites]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Heart size={24} className="fill-red-500 text-red-500" />
          Mes favoris
          {items.length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-600 dark:bg-red-950 dark:text-red-300">
              {items.length}
            </span>
          )}
        </h1>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/50"
          >
            <Trash2 size={15} />
            Tout retirer
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton aspect-square" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50">
            <Heart size={30} className="text-red-400" />
          </span>
          <div>
            <p className="text-lg font-semibold">Aucun favori pour l'instant</p>
            <p className="mt-1 text-sm muted">
              Touchez le cœur d'un produit pour le retrouver ici, sur tous vos appareils.
            </p>
          </div>
          <Link to="/boutique" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
            <Store size={17} />
            Parcourir la boutique
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
