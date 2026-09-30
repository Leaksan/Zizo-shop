import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Ban, Check, ExternalLink, EyeOff, Flag, RotateCcw, X } from "lucide-react";
import { api } from "../../api";
import ShopAvatar from "../../components/ShopAvatar";
import { formatPhone, timeAgo } from "../../format";
import { SHOP_STATUS } from "../../shopStatus";

const FILTERS = [
  { key: "open", label: "À traiter" },
  { key: "done", label: "Traités" },
];

// Signalements des clients, regroupés par contenu (publication ou boutique)
export default function AdminReports() {
  const { refreshCounts } = useOutletContext() || {};
  const [filter, setFilter] = useState("open");
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState("");

  const load = (status = filter) =>
    api
      .get(`/admin/reports?status=${status}`)
      .then(setGroups)
      .catch((e) => setError(e.message));

  useEffect(() => {
    setGroups(null);
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const act = async (group, action, note = "") => {
    setError("");
    try {
      await api.put("/admin/reports", { target: group.target, target_id: group.target_id, action, note });
      await load();
      refreshCounts?.();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Flag size={22} className="text-brand-600 dark:text-brand-400" /> Signalements
        </h1>
        <p className="mt-1 text-sm muted">
          Publications et boutiques signalées par les clients. Le vendeur est prévenu d'une décision, jamais
          de qui a signalé.
        </p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              filter === f.key
                ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                : "border-gray-200 text-gray-600 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

      {groups === null ? (
        <div className="skeleton h-40" />
      ) : groups.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <Check size={32} className="text-green-600" />
          <p className="text-sm muted">{filter === "open" ? "Aucun signalement à traiter." : "Aucun signalement traité."}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((g) => (
            <ReportGroup key={`${g.target}-${g.target_id}`} group={g} open={filter === "open"} onAct={act} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportGroup({ group, open, onAct }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { post, shop, reports } = group;

  const run = async (action, question) => {
    if (question && !window.confirm(question)) return;
    setBusy(true);
    await onAct(group, action, note.trim());
    setBusy(false);
  };

  return (
    <li className="card overflow-hidden">
      {/* Contenu signalé */}
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-slate-700">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase muted">
          {group.target === "post" ? "Publication" : "Boutique"}
          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-accent-900 normal-case dark:bg-accent-950 dark:text-accent-200">
            Signalé {reports.length} fois
          </span>
          {post?.hidden && (
            <span className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-gray-700 normal-case dark:bg-slate-700 dark:text-slate-200">
              <EyeOff size={12} /> Masquée
            </span>
          )}
          {shop && shop.status !== "active" && (
            <span className={`rounded-full px-2 py-0.5 normal-case ${SHOP_STATUS[shop.status]?.cls || ""}`}>
              {SHOP_STATUS[shop.status]?.label || shop.status}
            </span>
          )}
        </div>
        {shop && (
          <Link to={`/b/${shop.slug}`} target="_blank" className="flex items-center gap-2 font-semibold hover:text-brand-600">
            <ShopAvatar shop={shop} className="h-8 w-8 text-sm" />
            <span className="min-w-0 truncate">{shop.name}</span>
            <ExternalLink size={14} className="shrink-0 text-gray-400" />
          </Link>
        )}
        {group.target === "post" && !post && <p className="text-sm muted">Publication supprimée par le vendeur.</p>}
        {post && (
          <div className="flex gap-3">
            {post.images[0] && <img src={post.images[0]} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
            <p className="line-clamp-4 min-w-0 text-sm whitespace-pre-line text-gray-700 dark:text-slate-300">
              {post.text || (post.products.length ? `Produits : ${post.products.map((p) => p.name).join(", ")}` : "(sans texte)")}
            </p>
          </div>
        )}
      </div>

      {/* Qui a signalé, et pourquoi */}
      <ul className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
        {reports.map((r) => (
          <li key={r.id}>
            <p>
              <b>{r.reason_label}</b>
              {!open && <span className="muted"> · {r.status === "dismissed" ? "classé sans suite" : "traité"}</span>}
            </p>
            {r.details && <p className="text-gray-600 italic dark:text-slate-300">« {r.details} »</p>}
            {r.user && (
              <p className="text-xs muted">
                {r.user.name} ·{" "}
                <a href={`tel:${r.user.phone}`} className="text-brand-600 dark:text-brand-400">
                  {formatPhone(r.user.phone)}
                </a>{" "}
                · {timeAgo(r.created_at)}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Décision */}
      {open ? (
        <div className="flex flex-col gap-2 p-4">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="input"
            placeholder="Motif communiqué au vendeur (facultatif)"
          />
          <div className="flex flex-wrap gap-2">
            {post && !post.hidden && (
              <button onClick={() => run("hide_post")} disabled={busy} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
                <EyeOff size={15} /> Masquer la publication
              </button>
            )}
            {shop && !shop.official && shop.status !== "suspended" && (
              <button
                onClick={() => run("suspend_shop", `Suspendre la boutique « ${shop.name} » ? Elle ne sera plus visible.`)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                <Ban size={15} /> Suspendre la boutique
              </button>
            )}
            <button onClick={() => run("dismiss")} disabled={busy} className="btn-outline flex items-center gap-1.5 px-3 py-2 text-sm">
              <X size={15} /> Classer sans suite
            </button>
          </div>
        </div>
      ) : (
        post?.hidden && (
          <div className="p-4">
            <button onClick={() => run("restore_post")} disabled={busy} className="btn-outline flex items-center gap-1.5 px-3 py-2 text-sm">
              <RotateCcw size={15} /> Rétablir la publication
            </button>
          </div>
        )
      )}
    </li>
  );
}
