import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Flame, Store } from "lucide-react";
import { api } from "../api";
import Hero, { TrustBar } from "../components/Hero";
import DealOfDay from "../components/DealOfDay";
import ProductCard from "../components/ProductCard";
import Reveal from "../components/Reveal";
import { usePolling } from "../hooks";

const SEEN_KEY = "mb_seen_landing";

export default function Landing() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) {
      navigate("/boutique", { replace: true });
    } else {
      localStorage.setItem(SEEN_KEY, "1");
    }
  }, [navigate]);

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

  const popular = [...products].sort((a, b) => b.reviews_count - a.reviews_count).slice(0, 4);
  const clearance = products.filter((p) => p.clearance).slice(0, 4);

  return (
    <div>
      <Hero products={products} />
      <TrustBar />
      <DealOfDay />

      {clearance.length > 0 && (
        <Reveal className="mb-10">
          <section className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-5 dark:border-orange-800 dark:bg-orange-950/40">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-orange-600 dark:text-orange-400">
                  <Flame size={22} className="fill-orange-400" />
                  Liquidation
                </h2>
                <p className="text-sm text-orange-500 dark:text-orange-300">
                  Dernières pièces à petit prix — jusqu'à épuisement des stocks !
                </p>
              </div>
              <Link
                to="/liquidation"
                className="flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline dark:text-orange-400"
              >
                Tout voir <ArrowRight size={15} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {clearance.map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <section className="mb-10">
        <Reveal>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold">Les plus populaires</h2>
            <Link
              to="/boutique"
              className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <Store size={16} />
              Toute la boutique <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="skeleton aspect-square" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {popular.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
