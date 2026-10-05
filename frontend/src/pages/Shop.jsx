import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownNarrowWide,
  Check,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
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
  { value: 3, label: "3 et +" },
  { value: 4, label: "4 et +" },
  { value: 4.5, label: "4,5 et +" },
];

const EMPTY_FILTERS = {
  minPrice: "",
  maxPrice: "",
  inStock: false,
  promoOnly: false,
  minRating: 0,
};

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  // Le rayon vit dans l'adresse (?cat=) : le menu ☰, les puces et le bouton
  // retour restent synchronisés, même quand on change de rayon depuis cette page.
  const category = Number(searchParams.get("cat")) || null;
  const setCategory = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("cat", id);
    else next.delete("cat");
    next.delete("focus");
    setSearchParams(next, { replace: true });
  };
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("q") || "",
  );
  const [sort, setSortState] = useState(() =>
    SORTS.some((s) => s.value === searchParams.get("tri"))
      ? searchParams.get("tri")
      : "pop",
  );
  const updateQuery = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("focus");
    setSearchParams(next, { replace: true });
  };
  const setSort = (value) => {
    setSortState(value);
    updateQuery("tri", value === "pop" ? "" : value);
  };
  const urlSearch = searchParams.get("q") || "";
  const urlSort = searchParams.get("tri");
  useEffect(() => {
    setSearch(urlSearch);
    setSortState(SORTS.some((s) => s.value === urlSort) ? urlSort : "pop");
  }, [urlSearch, urlSort]);
  const requestId = useRef(0);
  const searchInput = useRef(null);
  const wantsFocus = searchParams.get("focus") === "1";
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Loupe de l'en-tête (?focus=1) : placer le curseur dans la recherche, même si on
  // était déjà sur cette page
  useEffect(() => {
    if (wantsFocus) searchInput.current?.focus();
  }, [wantsFocus]);

  const currentCategory = categories.find((c) => c.id === category);

  // Éviter une requête API à chaque frappe : attendre 300 ms de pause
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = (silent = false) => {
    const currentRequest = ++requestId.current;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (debouncedSearch) params.set("search", debouncedSearch);
    api
      .get(`/products?${params}`)
      .then((list) => {
        if (currentRequest === requestId.current) {
          setProducts(list);
          setError("");
        }
      })
      .catch((e) => {
        if (!silent && currentRequest === requestId.current)
          setError(e.message);
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
  };

  useEffect(load, [category, debouncedSearch]);
  usePolling(() => load(true), 30000, [category, debouncedSearch]);

  // (la catégorie a sa propre rangée toujours visible : pas comptée ici)
  const activeFilterCount =
    (filters.minPrice !== "" ? 1 : 0) +
    (filters.maxPrice !== "" ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.promoOnly ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0);

  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setSort("pop");
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
          (p.real_reviews_count > 0 ? p.real_rating : p.rating) >=
          filters.minRating,
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
      label: (
        <span className="flex items-center gap-1">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          {filters.minRating.toString().replace(".", ",")} et +
        </span>
      ),
      clear: () => setFilters((f) => ({ ...f, minRating: 0 })),
    });
  if (filters.inStock)
    activeChips.push({
      key: "stock",
      label: "En stock",
      clear: () => setFilters((f) => ({ ...f, inStock: false })),
    });
  if (filters.promoOnly)
    activeChips.push({
      key: "promo",
      label: "Promos",
      clear: () => setFilters((f) => ({ ...f, promoOnly: false })),
    });

  const toggleCls = (active) =>
    `flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
      active
        ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950 dark:text-brand-300"
        : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-slate-600 dark:text-slate-300"
    }`;

  const catCls = (active) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-brand-700 text-white"
        : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-700"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {currentCategory ? currentCategory.name : "Boutique"}
          </h1>
          <p className="mt-2 text-sm muted">
            Trouvez ce qui vous plaît. Commandez simplement.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchInput}
              type="search"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                updateQuery("q", e.target.value);
              }}
              aria-label="Rechercher un produit"
              className="input w-full pl-9 sm:max-w-xs"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            aria-controls="catalogue-filtres"
            className={`relative flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filtersOpen || activeFilterCount > 0
                ? "bg-brand-700 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>Affiner</span>
            {activeFilterCount > 0 && (
              <span className="animate-pop absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-gray-950">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Catégories toujours visibles, défilables au doigt sur mobile */}
      {categories.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <button
            onClick={() => setCategory(null)}
            className={`shrink-0 ${catCls(category === null)}`}
          >
            Tout
          </button>
          {categories
            .filter((c) => c.product_count > 0)
            .map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
                className={`shrink-0 ${catCls(category === c.id)}`}
              >
                {c.name}
              </button>
            ))}
        </div>
      )}

      {/* Panneau de filtres : fermé par défaut, la page reste épurée tant que
          le client ne demande pas à filtrer. */}
      <div hidden={!filtersOpen} id="catalogue-filtres">
        <div className="overflow-hidden">
          <div className="card mb-1 flex flex-col gap-5 p-5">
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="label">Prix (FCFA)</p>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={(e) =>
                      setFilters({ ...filters, minPrice: e.target.value })
                    }
                    className="input"
                    aria-label="Prix minimum"
                  />
                  <span className="muted">—</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    aria-label="Prix maximum"
                    value={filters.maxPrice}
                    onChange={(e) =>
                      setFilters({ ...filters, maxPrice: e.target.value })
                    }
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
                      onClick={() =>
                        setFilters({ ...filters, minRating: r.value })
                      }
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        filters.minRating === r.value
                          ? "bg-amber-400 text-amber-950"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {r.value > 0 && (
                        <Star size={11} className="fill-current" />
                      )}
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="label">Disponibilité</p>
                <button
                  onClick={() =>
                    setFilters({ ...filters, inStock: !filters.inStock })
                  }
                  className={toggleCls(filters.inStock)}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
                      filters.inStock
                        ? "border-brand-600 bg-brand-600 text-white"
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
                  onClick={() =>
                    setFilters({ ...filters, promoOnly: !filters.promoOnly })
                  }
                  className={toggleCls(filters.promoOnly)}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
                      filters.promoOnly
                        ? "border-brand-600 bg-brand-600 text-white"
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

      {/* Les critères actifs restent visibles et faciles à retirer. */}
      {(activeChips.length > 0 || sort !== "pop") && (
        <div className="flex flex-wrap items-center gap-2">
          {sort !== "pop" && (
            <button
              onClick={() => setSort("pop")}
              className="btn-outline flex items-center gap-1"
            >
              {SORTS.find((s) => s.value === sort)?.label}
              <X size={14} />
              <span className="sr-only">Effacer le tri</span>
            </button>
          )}
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.clear}
              className="flex items-center gap-1.5 rounded-full bg-brand-50 py-1.5 pr-2 pl-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900"
            >
              {chip.label}
              <X size={14} className="rounded-full bg-brand-600/15 p-0.5" />
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
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          <p>{error}</p>
          <button onClick={() => load()} className="mt-2 underline">
            Réessayer
          </button>
        </div>
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
            Aucun produit trouvé. Essayez un autre mot ou un autre rayon.
          </p>
          {search && (
            <button
              onClick={() => {
                setSearch("");
                updateQuery("q", "");
              }}
              className="btn-outline mt-4"
            >
              Effacer la recherche
            </button>
          )}
          {(activeFilterCount > 0 || sort !== "pop") && (
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
          {displayed.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
