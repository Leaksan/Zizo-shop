import { useEffect, useState } from "react";
import { api } from "../../api";

const EMPTY = { code: "", type: "percent", value: 10, label: "", active: true };

export default function AdminPromos() {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get("/admin/promos")
      .then(setPromos)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) await api.put(`/admin/promos/${editingId}`, form);
      else await api.post("/admin/promos", form);
      setForm(EMPTY);
      setEditingId(null);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  };

  const edit = (p) => {
    setEditingId(p.id);
    setForm({ code: p.code, type: p.type, value: p.value, label: p.label, active: p.active });
  };

  const toggle = async (p) => {
    await api.put(`/admin/promos/${p.id}`, { active: !p.active });
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Supprimer le code « ${p.code} » ?`)) return;
    await api.del(`/admin/promos/${p.id}`);
    load();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Codes promo</h1>

      <form onSubmit={submit} className="card mb-6 flex flex-col gap-4 p-5">
        <h2 className="font-semibold">{editingId ? "Modifier le code" : "Nouveau code"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Code *</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="input font-semibold uppercase"
              placeholder="Ex. PROMO20"
            />
          </label>
          <label className="block">
            <span className="label">Type *</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="input"
            >
              <option value="percent">Pourcentage (-X %)</option>
              <option value="freeship">Livraison offerte</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {form.type === "percent" && (
            <label className="block">
              <span className="label">Valeur (%) *</span>
              <input
                required
                type="number"
                min="1"
                max="100"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="input"
              />
            </label>
          )}
          <label className="block">
            <span className="label">Libellé affiché</span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="input"
              placeholder="Ex. -20 % sur votre commande"
            />
          </label>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            {editingId ? "Enregistrer" : "Créer le code"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
              className="btn-outline px-4 py-2 text-sm"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="card">
        {loading ? (
          <p className="p-4 text-sm muted">Chargement…</p>
        ) : promos.length === 0 ? (
          <p className="p-4 text-sm muted">Aucun code promo.</p>
        ) : (
          promos.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4 last:border-0 dark:border-slate-700"
            >
              <span className="rounded-lg bg-indigo-50 px-3 py-1 font-mono text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {p.code}
              </span>
              <span className="text-sm">
                {p.type === "percent" ? `-${p.value} %` : "Livraison offerte"}
              </span>
              <span className="text-sm muted">{p.label}</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => toggle(p)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    p.active
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {p.active ? "Actif" : "Inactif"}
                </button>
                <button onClick={() => edit(p)} className="btn-outline">
                  Modifier
                </button>
                <button onClick={() => remove(p)} className="btn-danger">
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
