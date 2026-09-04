import { useEffect, useMemo, useState } from "react";
import { ArrowDownNarrowWide, Check, RotateCcw, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import Reveal from "../components/Reveal";
import { usePolling } from "../hooks";

const SORTS = [
  { value: "pop", label: "Populaire" },
  { value: "prix-asc", label: "Prix croissant" },
  { value: "prix-desc", label: "Prix décroissant" },
  { value: "promos", label: "Promotions" },
  { value: "nouveautes", label: "Nouveautés" },
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

  const activeFilterCount =
    (category ? 1 : 0) +
    (filters.minPrice !== "" ? 1 : 0) +
    (filters.maxPrice !== "" ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.promoOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0);

  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setCategory(null);
  };

  const displayed = useMemo(() => {
    let list = [...products];

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
  }, [products, sort, filters]);

  // Puces récapitulatives des filtres actifs (faciles à retirer d'un clic)
  const activeChips = [];
  if (category) {
    const c = categories.find((x) => x.id === category);
    activeChips.push({ key: "cat", label: c?.name || "Catégorie", clear: () => setCategory(null) });
  }
  if (filters.minPrice !== "")
    activeChips.push({
      key: "min",
      label: `≥ ${Number(filters.minPrice).toLocaleString("fr-FR")}`,
      clear: () => setFilters((f) => ({ ...f, minPrice: "" })),
    });
  if (filters.maxPrice !== "")
    activeChips.push({
      key: "max",
      label: `≤ ${Number(filters.maxPrice).toLocaleString("fr-FR")}`,
      clear: () => setFilters((f) => ({ ...f, maxPrice: "" })),
    });
  if (filters.minRating > 0)
    activeChips.push({
      key: "rating",
      label: `${filters.minRating.toString().replace(".", ",")}★ et +`,
      clear: () => setFilters((f) => ({ ...f, minRating: 0 })),
    });
  if (filters.inStock)
    activeChips.push({ key: "stock", label: "En stock", clear: () => setFilters((f) => ({ ...f, inStock: false })) });
  if (filters.promoOnly)
    activeChips.push({ key: "promo", label: "Promos", clear: () => setFilters((f) => ({ ...f, promoOnly: false })) });

  const toggleCls = (active) =>
    `flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
      active
        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
        : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-slate-600 dark:text-slate-300"
    }`;

  const catCls = (active) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-indigo-600 text-white"
        : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-700"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            aria-expanded={filtersOpen}
            className={`relative flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filtersOpen || activeFilterCount > 0
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
            }`}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterCount > 0 && (
              <span className="animate-pop absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Panneau de filtres : fermé par défaut, la page reste épurée tant que
          le client ne demande pas à filtrer. */}
      <div
        className={`grid transition-all duration-300 ${
          filtersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="card mb-1 flex flex-col gap-5 p-5">
            {categories.length > 0 && (
              <div>
                <p className="label">Catégories</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setCategory(null)} className={catCls(category === null)}>
                    Tout
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className={catCls(category === c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                onClick={resetAll}
                className="flex w-fit items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline"
              >
                <RotateCcw size={13} />
                Réinitialiser les filtres ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Récapitulatif compact hors du panneau : tri + filtres actifs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Trier les produits"
            className="cursor-pointer appearance-none rounded-full bg-white py-1.5 pr-8 pl-4 text-sm font-medium text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ArrowDownNarrowWide
            size={13}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
          />
        </div>
        {activeChips.map((chip) => (
          <button
            key={chip.key}
            onClick={chip.clear}
            className="flex items-center gap-1.5 rounded-full bg-indigo-50 py-1.5 pr-2 pl-3.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
          >
            {chip.label}
            <X size={14} className="rounded-full bg-indigo-600/15 p-0.5" />
          </button>
        ))}
        {activeChips.length > 1 && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
          >
            <RotateCcw size={12} />
            Tout effacer
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

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
          <p className="muted">Aucun produit ne correspond à vos filtres.</p>
          {activeFilterCount > 0 && (
            <button
              onClick={resetAll}
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
