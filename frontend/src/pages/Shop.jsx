import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  BadgePercent,
  Check,
  Flame,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import Reveal from "../components/Reveal";
import { useFavorites } from "../context/FavoritesContext";
import { usePolling } from "../hooks";

const SORTS = [
  { value: "pop", label: "Populaire", icon: TrendingUp },
  { value: "prix-asc", label: "Prix croissant", icon: ArrowUpNarrowWide },
  { value: "prix-desc", label: "Prix décroissant", icon: ArrowDownNarrowWide },
  { value: "promos", label: "Promotions", icon: BadgePercent },
  { value: "nouveautes", label: "Nouveautés", icon: Sparkles },
];

const RATING_OPTIONS = [
  { value: 0, label: "Toutes notes" },
  { value: 3, label: "3★ et +" },
  { value: 4, label: "4★ et +" },
  { value: 4.5, label: "4,5★ et +" },
];

const EMPTY_FILTERS = { minPrice: "", maxPrice: "", inStock: false, promoOnly: false, minRating: 0 };

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("pop");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const showFavs = searchParams.get("favoris") === "1";
  const showClearance = searchParams.get("liquidation") === "1";
  const { favorites } = useFavorites();

  useEffect(() => {
    api.get("/categories").then(setCategories).catch(() => {});
  }, []);

  // Éviter une requête API à chaque frappe : attendre 300 ms de pause
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (debouncedSearch) params.set("search", debouncedSearch);
    api
      .get(`/products?${params}`)
      .then(setProducts)
      .catch((e) => {
        if (!silent) setError(e.message);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(load, [category, debouncedSearch]);
  usePolling(() => load(true), 30000, [category, debouncedSearch]);

  const clearanceProducts = useMemo(() => products.filter((p) => p.clearance), [products]);

  const activeFilterCount =
    (filters.minPrice !== "" ? 1 : 0) +
    (filters.maxPrice !== "" ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.promoOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0);

  const displayed = useMemo(() => {
    let list = showFavs
      ? products.filter((p) => favorites.includes(p.id))
      : showClearance
        ? products.filter((p) => p.clearance)
        : [...products];

    if (filters.inStock) list = list.filter((p) => p.total_stock > 0);
    if (filters.promoOnly) list = list.filter((p) => p.promo_percent > 0);
    if (filters.minPrice !== "")
      list = list.filter((p) => p.price_max >= Number(filters.minPrice));
    if (filters.maxPrice !== "")
      list = list.filter((p) => p.price_min <= Number(filters.maxPrice));
    if (filters.minRating > 0)
      list = list.filter(
        (p) =>
          (p.real_reviews_count > 0 ? p.real_rating : p.rating) >= filters.minRating
      );

    const comparators = {
      pop: (a, b) => b.reviews_count - a.reviews_count,
      "prix-asc": (a, b) => a.price_min - b.price_min,
      "prix-desc": (a, b) => b.price_min - a.price_min,
      promos: (a, b) => b.promo_percent - a.promo_percent,
      nouveautes: (a, b) =>
        (b.badge === "Nouveau") - (a.badge === "Nouveau") ||
        new Date(b.created_at) - new Date(a.created_at),
    };
    return list.sort(comparators[sort]);
  }, [products, sort, showFavs, showClearance, favorites, filters]);

  const noFilter =
    !showFavs && !showClearance && category === null && !search.trim() && activeFilterCount === 0;

  const pillCls = (active) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-indigo-600 text-white"
        : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-700"
    }`;

  const toggleCls = (active) =>
    `flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
      active
        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
        : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-slate-600 dark:text-slate-300"
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Catalogue</h1>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-9 sm:max-w-xs"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filtersOpen || activeFilterCount > 0
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
            }`}
          >
            <SlidersHorizontal size={16} />
            Filtres
            {activeFilterCount > 0 && (
              <span className="animate-pop absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div
        className={`grid transition-all duration-300 ${
          filtersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="card mb-1 flex flex-col gap-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="label">Prix (FCFA)</p>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                    className="input"
                  />
                  <span className="muted">—</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <p className="label">Note minimale</p>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setFilters({ ...filters, minRating: r.value })}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        filters.minRating === r.value
                          ? "bg-amber-400 text-amber-950"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {r.value > 0 && <Star size={11} className="fill-current" />}
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="label">Disponibilité</p>
                <button
                  onClick={() => setFilters({ ...filters, inStock: !filters.inStock })}
                  className={toggleCls(filters.inStock)}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
                      filters.inStock
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 dark:border-slate-500"
                    }`}
                  >
                    {filters.inStock && <Check size={13} strokeWidth={3} />}
                  </span>
                  En stock uniquement
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="label">Offres</p>
                <button
                  onClick={() => setFilters({ ...filters, promoOnly: !filters.promoOnly })}
                  className={toggleCls(filters.promoOnly)}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
                      filters.promoOnly
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 dark:border-slate-500"
                    }`}
                  >
                    {filters.promoOnly && <Check size={13} strokeWidth={3} />}
                  </span>
                  Promotions uniquement
                </button>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="flex w-fit items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline"
              >
                <RotateCcw size={13} />
                Réinitialiser les filtres ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSort(s.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition ${
              sort === s.value
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-700"
            }`}
          >
            <s.icon size={15} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setCategory(null);
            setSearchParams({});
          }}
          className={pillCls(category === null && !showFavs && !showClearance)}
        >
          Tout
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategory(c.id);
              setSearchParams({});
            }}
            className={pillCls(category === c.id && !showFavs && !showClearance)}
          >
            {c.name} ({c.product_count})
          </button>
        ))}
        <button
          onClick={() => setSearchParams(showClearance ? {} : { liquidation: "1" })}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            showClearance
              ? "bg-orange-500 text-white"
              : "bg-white text-orange-600 ring-1 ring-orange-300 hover:bg-orange-50 dark:bg-slate-800 dark:text-orange-400 dark:ring-orange-800 dark:hover:bg-slate-700"
          }`}
        >
          <Flame size={15} className={showClearance ? "fill-white" : "fill-orange-200"} />
          Liquidation
        </button>
        <button
          onClick={() => setSearchParams(showFavs ? {} : { favoris: "1" })}
          className={pillCls(showFavs)}
        >
          ❤️ Mes favoris
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {noFilter && clearanceProducts.length > 0 && (
        <Reveal>
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
              <button
                onClick={() => setSearchParams({ liquidation: "1" })}
                className="text-sm font-semibold text-orange-600 hover:underline dark:text-orange-400"
              >
                Tout voir →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {clearanceProducts.slice(0, 4).map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton aspect-square" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-16 text-center">
          <p className="muted">
            {showFavs
              ? "Aucun favori pour le moment. Touchez le cœur d'un produit pour l'ajouter."
              : showClearance
                ? "Aucun produit en liquidation pour le moment."
                : "Aucun produit ne correspond à vos filtres."}
          </p>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="btn-outline mt-4 inline-flex items-center gap-1.5 text-sm"
            >
              <RotateCcw size={14} />
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {displayed.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 7) * 60}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
