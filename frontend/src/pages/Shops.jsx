import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronRight, MapPin, Search, Store } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import ShopAvatar from "../components/ShopAvatar";

// Annuaire des boutiques validées (la boutique officielle d'abord, puis les plus suivies)
export default function Shops() {
  const { user } = useAuth();
  const [shops, setShops] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/shops").then(setShops).catch(() => setShops([]));
  }, []);

  const q = search.trim().toLowerCase();
  const shown = (shops || []).filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.zone || "").toLowerCase().includes(q)
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Boutiques</h1>
        <div className="relative sm:w-72">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou quartier…"
            aria-label="Rechercher une boutique"
            className="input pl-9"
          />
        </div>
      </div>

      {shops === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="card p-8 text-center text-sm muted">Aucune boutique ne correspond à « {search} ».</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <Link key={s.id} to={`/b/${s.slug}`} className="card flex items-center gap-3 p-3 transition hover:border-brand-300">
              <ShopAvatar shop={s} className="h-14 w-14 text-xl" />
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-1">
                  <span className="truncate">{s.name}</span>
                  {s.official && <BadgeCheck size={16} className="shrink-0 text-brand-600 dark:text-brand-400" />}
                </b>
                {s.zone && (
                  <small className="flex items-center gap-1 muted">
                    <MapPin size={12} /> {s.zone}
                  </small>
                )}
                <small className="block text-xs muted">
                  {s.products_count} produit{s.products_count > 1 ? "s" : ""} · {s.followers_count} abonné
                  {s.followers_count > 1 ? "s" : ""}
                </small>
              </span>
              <ChevronRight size={18} className="shrink-0 text-gray-400" />
            </Link>
          ))}
        </div>
      )}

      {!user?.shop && (
        <Link
          to="/vendeur/ouvrir"
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 p-4 transition hover:border-brand-500 dark:border-brand-800"
        >
          <Store size={22} className="shrink-0 text-brand-600 dark:text-brand-400" />
          <span className="flex-1 text-sm">
            <b>Vous vendez en ligne ?</b> Ouvrez votre boutique sur la plateforme.
          </span>
          <ChevronRight size={18} className="text-brand-600" />
        </Link>
      )}
    </div>
  );
}
