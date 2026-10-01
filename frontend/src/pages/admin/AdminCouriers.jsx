import { useEffect, useState } from "react";
import { Bike, Coins, Phone, ShieldCheck, Star, Trash2 } from "lucide-react";
import { api } from "../../api";
import { formatPhone, formatPrice } from "../../format";
import { useShop } from "../../context/ShopContext";
import { usePolling } from "../../hooks";
import { whatsappUrl, WhatsAppIcon } from "../../whatsapp";
import ZoneOptions from "../../components/ZoneOptions";

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "verify", label: "À vérifier" },
  { key: "online", label: "En ligne" },
];

// Livreurs : vérification (indispensable avant toute course), zone, primes. En cartes, pour
// rester lisible sur téléphone ; ceux à vérifier d'abord.
export default function AdminCouriers() {
  const [couriers, setCouriers] = useState(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const { currency, zones } = useShop();

  const load = () =>
    api
      .get("/admin/couriers")
      .then(setCouriers)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  usePolling(load, 30000);

  const update = async (c, changes) => {
    setError("");
    try {
      await api.put(`/admin/couriers/${c.id}`, changes);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const addBonus = (c) => {
    const input = window.prompt(`Prime pour ${c.name} (montant en FCFA) :`, "5000");
    if (!input) return;
    const amount = parseFloat(input);
    if (Number.isNaN(amount) || amount <= 0) return;
    update(c, { bonus_add: amount });
  };

  const remove = async (c) => {
    if (!window.confirm(`Supprimer le livreur « ${c.name} » ? Ses livraisons en cours repasseront en attente.`)) return;
    setError("");
    try {
      await api.del(`/admin/couriers/${c.id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const tests = { verify: (c) => !c.verified, online: (c) => c.available };
  const list = (couriers || [])
    .filter((c) => !filter || tests[filter](c))
    .sort((a, b) => a.verified - b.verified || a.name.localeCompare(b.name, "fr"));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Livreurs</h1>

      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const n = (couriers || []).filter((c) => !f.key || tests[f.key](c)).length;
          return (
            <button
              key={f.key || "tous"}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                filter === f.key
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "border-gray-200 text-gray-600 dark:border-slate-600 dark:text-slate-300"
              }`}
            >
              {f.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

      {couriers === null ? (
        <div className="skeleton h-40" />
      ) : list.length === 0 ? (
        <p className="card p-6 text-center text-sm muted">
          {couriers.length === 0
            ? "Aucun livreur inscrit. Les livreurs s'inscrivent depuis la page « Espace livreur » du site."
            : "Aucun livreur ici."}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((c) => (
            <li key={c.id} className={`card flex flex-col gap-3 p-4 ${c.verified ? "" : "ring-2 ring-accent-300 dark:ring-accent-800"}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <Bike size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
                      <Phone size={13} /> {formatPhone(c.phone)}
                    </a>
                    <a
                      href={whatsappUrl(c.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-brand-600 dark:text-brand-400"
                    >
                      <WhatsAppIcon size={13} /> WhatsApp
                    </a>
                    <span className="muted">{c.vehicle}</span>
                  </p>
                </div>
                <button
                  onClick={() => update(c, { available: !c.available })}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    c.available
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                  title="Mettre en ligne ou hors ligne"
                >
                  {c.available ? "En ligne" : "Hors ligne"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-gray-50 p-2 dark:bg-slate-900">
                  <p className="font-bold">{c.delivered_count}</p>
                  <p className="text-xs muted">livrées</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 dark:bg-slate-900">
                  <p className="flex items-center justify-center gap-1 font-bold">
                    {c.rating_avg ? (
                      <>
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        {c.rating_avg.toFixed(1).replace(".", ",")}
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className="text-xs muted">{c.rating_count} note{c.rating_count > 1 ? "s" : ""}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 dark:bg-slate-900">
                  <p className="truncate font-bold text-green-700 dark:text-green-400">{formatPrice(c.earnings, currency)}</p>
                  <p className="text-xs muted">gains{c.bonus_total > 0 ? " + primes" : ""}</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <span className="muted">Zone</span>
                <select value={c.zone} onChange={(e) => update(c, { zone: e.target.value })} className="input flex-1 py-1.5">
                  {!zones.includes(c.zone) && c.zone && <option>{c.zone}</option>}
                  <ZoneOptions zones={zones} />
                </select>
              </label>

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
                {c.verified ? (
                  <button
                    onClick={() => update(c, { verified: false })}
                    className="btn-outline flex items-center gap-1.5 text-sm"
                    title="Retirer la vérification : il ne verra plus les courses"
                  >
                    <ShieldCheck size={15} className="text-green-600" /> Vérifié
                  </button>
                ) : (
                  <button onClick={() => update(c, { verified: true })} className="btn-primary flex items-center gap-1.5 text-sm">
                    <ShieldCheck size={15} /> Vérifier ce livreur
                  </button>
                )}
                <button onClick={() => addBonus(c)} className="btn-outline flex items-center gap-1.5 text-sm">
                  <Coins size={15} /> Prime
                </button>
                <button onClick={() => remove(c)} className="btn-danger ml-auto flex items-center gap-1.5 text-sm" aria-label={`Supprimer ${c.name}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
