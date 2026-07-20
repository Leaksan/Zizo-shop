import { useEffect, useState } from "react";
import { api } from "../../api";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => api.get("/admin/categories").then(setCategories).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/admin/categories", { name: newName });
      setNewName("");
      load();
    } catch (e2) {
      setError(e2.message);
    }
  };

  const save = async (cat) => {
    try {
      await api.put(`/admin/categories/${cat.id}`, { name: editing.name });
      setEditing(null);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  };

  const remove = async (cat) => {
    if (
      !window.confirm(
        `Supprimer la catégorie « ${cat.name} » ? Les produits associés seront sans catégorie.`
      )
    )
      return;
    await api.del(`/admin/categories/${cat.id}`);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Catégories</h1>
      <form onSubmit={create} className="mb-6 flex gap-2">
        <input
          required
          placeholder="Nouvelle catégorie…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input flex-1"
        />
        <button type="submit" className="btn-primary">
          Ajouter
        </button>
      </form>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="card">
        {categories.length === 0 ? (
          <p className="p-4 text-sm muted">Aucune catégorie.</p>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b border-gray-100 p-4 last:border-0 dark:border-slate-700"
            >
              {editing?.id === c.id ? (
                <>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="input flex-1"
                    autoFocus
                  />
                  <button onClick={() => save(c)} className="btn-primary text-xs">
                    Enregistrer
                  </button>
                  <button onClick={() => setEditing(null)} className="btn-outline">
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm muted">
                    {c.product_count} produit{c.product_count > 1 ? "s" : ""}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => setEditing({ id: c.id, name: c.name })}
                      className="btn-outline"
                    >
                      Renommer
                    </button>
                    <button onClick={() => remove(c)} className="btn-danger">
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
