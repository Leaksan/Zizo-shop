import { useEffect, useState } from "react";
import { BellRing, PackageSearch, Phone, Store, Trash2 } from "lucide-react";
import { api } from "../../api";
import { formatDate, formatPhone } from "../../format";
import { usePolling } from "../../hooks";

export default function AdminStockRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api
      .get("/admin/stock-requests")
      .then(setRequests)
      .catch(() => {})
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };
  useEffect(load, []);
  usePolling(() => load(true), 30000);

  const clear = async (r) => {
    if (
      !window.confirm(
        `Marquer « ${r.product_name} (${r.variant_name}) » comme traité ? Les ${r.count} demandes seront effacées.`
      )
    )
      return;
    await api.post(`/admin/stock-requests/clear-variant/${r.variant_id}`).catch(() => {});
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes de réassort</h1>
        <p className="text-sm muted">
          Produits demandés par les clients pendant une rupture de stock — à réapprovisionner en
          priorité.
        </p>
      </div>
      <div className="card">
        {loading ? (
          <p className="p-4 text-sm muted">Chargement…</p>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center">
            <PackageSearch size={40} className="mx-auto text-gray-300 dark:text-slate-600" strokeWidth={1.2} />
            <p className="mt-2 text-sm muted">Aucune demande en attente. Tout va bien !</p>
          </div>
        ) : (
          requests.map((r) => (
            <div
              key={r.variant_id}
              className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4 last:border-0 dark:border-slate-700"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-300">
                <BellRing size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {r.product_name} <span className="font-normal muted">({r.variant_name})</span>
                </p>
                {r.shop && (
                  <p className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-slate-300">
                    <Store size={12} /> {r.shop.name}
                  </p>
                )}
                <p className="text-xs muted">
                  Stock actuel : {r.current_stock} · dernière demande {formatDate(r.last_at)}
                </p>
                {r.phones.length > 0 && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <Phone size={13} className="shrink-0 text-gray-400" />
                    {[...new Set(r.phones)].map((phone) => (
                      <a key={phone} href={`tel:${phone}`} className="font-semibold text-brand-600 dark:text-brand-400">
                        {formatPhone(phone)}
                      </a>
                    ))}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-accent-100 px-3 py-1 text-sm font-bold text-accent-900 dark:bg-accent-950 dark:text-accent-200">
                {r.count} demande{r.count > 1 ? "s" : ""}
              </span>
              <button onClick={() => clear(r)} className="btn-outline flex items-center gap-1.5">
                <Trash2 size={13} />
                Traitée
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
