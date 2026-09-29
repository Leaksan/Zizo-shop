import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BadgeCheck, ExternalLink, MapPin, UserRound } from "lucide-react";
import { api } from "../../api";
import ShopAvatar from "../../components/ShopAvatar";
import { formatDate, formatPhone } from "../../format";
import { SHOP_STATUS } from "../../shopStatus";
import { whatsappUrl, WhatsAppIcon } from "../../whatsapp";

const FILTERS = [
  { key: "pending", label: "En attente" },
  { key: "active", label: "En ligne" },
  { key: "closed", label: "Refusées / suspendues" },
  { key: "all", label: "Toutes" },
];

// Validation des boutiques : une boutique n'est visible qu'une fois validée ici
export default function AdminShops() {
  const { refreshCounts } = useOutletContext() || {};
  const [shops, setShops] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");

  const load = () => api.get("/admin/shops").then(setShops).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const update = async (shop, changes) => {
    setError("");
    try {
      const updated = await api.put(`/admin/shops/${shop.id}`, changes);
      setShops((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      refreshCounts?.();
    } catch (e) {
      setError(e.message);
    }
  };

  const withReason = (shop, status, question) => {
    const reason = window.prompt(question);
    if (reason === null) return;
    update(shop, { status, status_note: reason.trim() });
  };

  const giveTo = (shop) => {
    const phone = window.prompt("Numéro du compte qui gérera cette boutique :");
    if (phone?.trim()) update(shop, { owner_phone: phone.trim() });
  };

  const count = (key) => (shops || []).filter((s) => matches(s, key)).length;
  const shown = (shops || []).filter((s) => matches(s, filter));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Boutiques</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              filter === f.key
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
            }`}
          >
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {shops === null ? (
        <div className="skeleton h-40" />
      ) : shown.length === 0 ? (
        <p className="card p-6 text-center text-sm muted">
          {filter === "pending" ? "Aucune boutique en attente de validation." : "Aucune boutique."}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((s) => (
            <div key={s.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <ShopAvatar shop={s} className="h-12 w-12 text-lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-bold">
                    <span className="truncate">{s.name}</span>
                    {s.official && <BadgeCheck size={16} className="shrink-0 text-brand-600" />}
                  </p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SHOP_STATUS[s.status]?.cls}`}>
                    {SHOP_STATUS[s.status]?.label}
                  </span>
                  <span className="ml-2 text-xs muted">créée le {formatDate(s.created_at)}</span>
                </div>
                <Link
                  to={`/b/${s.slug}`}
                  target="_blank"
                  className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Voir <ExternalLink size={13} />
                </Link>
              </div>

              {s.description && <p className="line-clamp-3 text-sm text-gray-600 dark:text-slate-300">{s.description}</p>}

              <div className="flex flex-col gap-1 text-sm">
                {s.owner ? (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <UserRound size={14} className="text-gray-400" />
                    {s.owner.name} · {formatPhone(s.owner.phone)}
                    <a
                      href={whatsappUrl(s.owner.phone, `Bonjour ${s.owner.name}, au sujet de votre boutique « ${s.name} »…`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline dark:text-green-400"
                    >
                      <WhatsAppIcon size={13} /> Écrire
                    </a>
                  </p>
                ) : (
                  <p className="flex items-center gap-2 muted">
                    <UserRound size={14} /> Aucun compte vendeur (gérée depuis l'admin)
                  </p>
                )}
                {(s.zone || s.address) && (
                  <p className="flex items-center gap-2 muted">
                    <MapPin size={14} className="shrink-0" />
                    {[s.zone, s.address].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="text-xs muted">
                  {s.products_count} produit{s.products_count > 1 ? "s" : ""} · {s.followers_count} abonné
                  {s.followers_count > 1 ? "s" : ""}
                </p>
                {s.status_note && s.status !== "active" && (
                  <p className="text-xs text-red-600">Motif : {s.status_note}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
                {s.status !== "active" && (
                  <button onClick={() => update(s, { status: "active", status_note: "" })} className="btn-primary">
                    {s.status === "pending" ? "Valider" : "Remettre en ligne"}
                  </button>
                )}
                {s.status === "pending" && (
                  <button
                    onClick={() => withReason(s, "rejected", "Motif du refus (le vendeur le verra) :")}
                    className="btn-danger"
                  >
                    Refuser
                  </button>
                )}
                {s.status === "active" && !s.official && (
                  <button
                    onClick={() => withReason(s, "suspended", "Motif de la suspension (le vendeur le verra) :")}
                    className="btn-danger"
                  >
                    Suspendre
                  </button>
                )}
                {!s.owner && (
                  <button onClick={() => giveTo(s)} className="btn-outline">
                    Confier à un compte
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function matches(shop, key) {
  if (key === "all") return true;
  if (key === "closed") return shop.status === "rejected" || shop.status === "suspended";
  return shop.status === key;
}
