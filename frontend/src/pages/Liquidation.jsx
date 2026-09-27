import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Store } from "lucide-react";
import { api } from "../api";
import ProductCard from "../components/ProductCard";

export default function Liquidation() {
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
    () =>
      products
        .filter((p) => p.clearance)
        .sort((a, b) => a.price_min - b.price_min),
    [products]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-950/40">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
          <Flame size={26} className="fill-orange-400" />
          Liquidation
          {items.length > 0 && (
            <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-sm font-bold text-white">
              {items.length}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-orange-500 dark:text-orange-300">
          Dernières pièces à petit prix — jusqu'à épuisement des stocks !
        </p>
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
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/50">
            <Flame size={30} className="text-orange-400" />
          </span>
          <div>
            <p className="text-lg font-semibold">Aucun produit en liquidation</p>
            <p className="mt-1 text-sm muted">
              Revenez bientôt — les bonnes affaires partent vite !
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
