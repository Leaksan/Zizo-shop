import { useEffect, useState } from "react";
import { Coins, ShieldCheck, Star } from "lucide-react";
import { api } from "../../api";
import { formatPrice } from "../../format";
import { useShop } from "../../context/ShopContext";
import { usePolling } from "../../hooks";

export default function AdminCouriers() {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currency, zones } = useShop();

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api
      .get("/admin/couriers")
      .then(setCouriers)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };
  useEffect(load, []);
  usePolling(() => load(true), 30000);

  const toggle = async (c) => {
    await api.put(`/admin/couriers/${c.id}`, { available: !c.available });
    load();
  };

  const toggleVerified = async (c) => {
    await api.put(`/admin/couriers/${c.id}`, { verified: !c.verified });
    load();
  };

  const addBonus = async (c) => {
    const input = window.prompt(`Prime pour ${c.name} (montant en FCFA) :`, "5000");
    if (!input) return;
    const amount = parseFloat(input);
    if (Number.isNaN(amount) || amount <= 0) return;
    await api.put(`/admin/couriers/${c.id}`, { bonus_add: amount });
    load();
  };

  const changeZone = async (c, zone) => {
    await api.put(`/admin/couriers/${c.id}`, { zone });
    load();
  };

  const remove = async (c) => {
    if (
      !window.confirm(
        `Supprimer le livreur « ${c.name} » ? Ses livraisons en cours repasseront en attente.`
      )
    )
      return;
    await api.del(`/admin/couriers/${c.id}`);
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Livreurs</h1>
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm muted">Chargement…</p>
        ) : couriers.length === 0 ? (
          <p className="p-4 text-sm muted">
            Aucun livreur inscrit. Les livreurs s'inscrivent depuis la page « Livreur » de la
            boutique.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-slate-700 dark:text-slate-400">
                <th className="p-4 font-medium">Livreur</th>
                <th className="p-4 font-medium">Vérifié</th>
                <th className="p-4 font-medium">Zone</th>
                <th className="p-4 font-medium">Note</th>
                <th className="p-4 font-medium">Livrées</th>
                <th className="p-4 font-medium">Gains + primes</th>
                <th className="p-4 font-medium">En ligne</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {couriers.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 dark:border-slate-700">
                  <td className="p-4">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs muted">
                      <a href={`tel:${c.phone}`} className="text-brand-600 dark:text-brand-400">
                        {c.phone}
                      </a>
                      {" · "}
                      {c.vehicle}
                    </p>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleVerified(c)}
                      title={c.verified ? "Retirer la vérification" : "Vérifier ce livreur"}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.verified
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      <ShieldCheck size={13} />
                      {c.verified ? "Vérifié" : "À vérifier"}
                    </button>
                  </td>
                  <td className="p-4">
                    <select
                      value={c.zone}
                      onChange={(e) => changeZone(c, e.target.value)}
                      className="input w-auto py-1"
                    >
                      {!zones.includes(c.zone) && c.zone && <option>{c.zone}</option>}
                      {zones.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    {c.rating_avg ? (
                      <span className="flex items-center gap-1 font-semibold">
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                        {c.rating_avg.toFixed(1).replace(".", ",")}
                        <span className="text-xs font-normal muted">({c.rating_count})</span>
                      </span>
                    ) : (
                      <span className="text-xs muted">—</span>
                    )}
                  </td>
                  <td className="p-4">{c.delivered_count}</td>
                  <td className="p-4">
                    <p className="font-semibold text-green-600">{formatPrice(c.earnings, currency)}</p>
                    {c.bonus_total > 0 && (
                      <p className="text-xs muted">dont {formatPrice(c.bonus_total, currency)} de primes</p>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggle(c)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.available
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {c.available ? "En ligne" : "Hors ligne"}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => addBonus(c)} className="btn-outline inline-flex items-center gap-1">
                        <Coins size={14} />
                        Prime
                      </button>
                      <button onClick={() => remove(c)} className="btn-danger">
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

