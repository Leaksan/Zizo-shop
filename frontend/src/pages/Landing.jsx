import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame } from "lucide-react";
import { api } from "../api";
import Hero, { TrustBar } from "../components/Hero";
import DealOfDay from "../components/DealOfDay";
import ProductCard from "../components/ProductCard";
import { usePolling } from "../hooks";

export default function Landing() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get("/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get("/products")
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  usePolling(() => {
    api.get("/products").then(setProducts).catch(() => {});
  }, 60000);

  // L'accueil ne met en avant que des produits qu'on peut commander
  const inStock = products.filter((p) => p.total_stock > 0);
  const popular = [...inStock].sort((a, b) => b.reviews_count - a.reviews_count).slice(0, 4);
  const clearance = inStock.filter((p) => p.clearance).slice(0, 4);
  // L'API renvoie les produits du plus récent au plus ancien
  const shown = new Set([...popular, ...clearance].map((p) => p.id));
  const newest = inStock.filter((p) => !shown.has(p.id)).slice(0, 4);

  return (
    <div>
      <Hero products={products} />

      {/* Rayons : accès direct, tous visibles sur une ligne en mobile, défilables au-delà */}
      {categories.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold">Rayons</h2>
          <div className="-mx-4 flex justify-between gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:justify-start sm:gap-5">
            {categories
              .filter((c) => c.product_count > 0)
              .map((c) => {
                const sample = products.find((p) => p.category_id === c.id);
                return (
                  <Link
                    key={c.id}
                    to={`/boutique?cat=${c.id}`}
                    className="flex min-w-14 shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl ring-1 ring-brand-100 transition hover:scale-105 sm:h-16 sm:w-16 sm:text-3xl dark:bg-brand-950 dark:ring-brand-900">
                      {c.emoji || sample?.emoji || c.name.charAt(0)}
                    </span>
                    <span className="text-xs font-semibold whitespace-nowrap text-gray-700 dark:text-slate-300">
                      {c.name}
                    </span>
                  </Link>
                );
              })}
          </div>
        </section>
      )}

      <DealOfDay />

      <ProductSection title="Les plus populaires" to="/boutique" products={popular} loading={loading} />

      {clearance.length > 0 && (
        <section className="mb-8 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-4 sm:p-5 dark:border-orange-800 dark:bg-orange-950/40">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-orange-600 sm:text-xl dark:text-orange-400">
                <Flame size={20} className="fill-orange-400" />
                Liquidation
              </h2>
              <p className="text-sm text-orange-500 dark:text-orange-300">
                Dernières pièces à petit prix, jusqu'à épuisement des stocks !
              </p>
            </div>
            <Link
              to="/liquidation"
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange-600 hover:underline dark:text-orange-400"
            >
              Tout voir <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {clearance.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {newest.length > 0 && (
        <ProductSection title="Nouveautés" to="/boutique?tri=nouveautes" products={newest} />
      )}

      <TrustBar />
    </div>
  );
}

function ProductSection({ title, to, products, loading = false }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold sm:text-2xl">{title}</h2>
        <Link
          to={to}
          className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Tout voir <ArrowRight size={15} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton aspect-square" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            ))
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
