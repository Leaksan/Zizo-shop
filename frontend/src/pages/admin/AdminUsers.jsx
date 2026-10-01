import { useEffect, useState } from "react";
import { KeyRound, Search, Store } from "lucide-react";
import { api } from "../../api";
import { formatDate, formatPhone } from "../../format";
import { SHOP_STATUS } from "../../shopStatus";

// Comptes clients et vendeurs : blocage, et nouveau mot de passe en cas d'oubli
export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get(`/admin/users${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`)
        .then(setUsers)
        .catch(() => setUsers([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const update = async (user, changes, done) => {
    setMessage(null);
    try {
      const updated = await api.put(`/admin/users/${user.id}`, changes);
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      if (done) setMessage({ ok: true, text: done });
    } catch (e) {
      setMessage({ ok: false, text: e.message });
    }
  };

  const resetPassword = (user) => {
    const password = window.prompt(`Nouveau mot de passe pour ${user.name} (6 caractères minimum) :`);
    if (!password) return;
    update(user, { new_password: password }, `Mot de passe de ${user.name} changé : communiquez-le lui.`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Comptes</h1>
        <div className="relative sm:w-72">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou téléphone…"
            aria-label="Rechercher un compte"
            className="input pl-9"
          />
        </div>
      </div>

      {message && (
        <p className={`rounded-lg p-3 text-sm ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}

      {users === null ? (
        <div className="skeleton h-40" />
      ) : users.length === 0 ? (
        <p className="card p-6 text-center text-sm muted">Aucun compte.</p>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-slate-700">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {u.name}
                  {!u.active && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                      Bloqué
                    </span>
                  )}
                </p>
                <p className="text-sm muted">
                  {formatPhone(u.phone)} · inscrit le {formatDate(u.created_at)}
                </p>
                {u.shop && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs">
                    <Store size={13} className="text-gray-400" />
                    {u.shop.name}
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${SHOP_STATUS[u.shop.status]?.cls}`}>
                      {SHOP_STATUS[u.shop.status]?.label}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => resetPassword(u)} className="btn-outline inline-flex items-center gap-1">
                  <KeyRound size={14} /> Mot de passe
                </button>
                <button
                  onClick={() =>
                    (!u.active ||
                      window.confirm(
                        `Bloquer le compte de ${u.name} ? Il ne pourra plus se connecter${u.shop ? " ni gérer sa boutique" : ""}.`
                      )) &&
                    update(u, { active: !u.active })
                  }
                  className={u.active ? "btn-danger" : "btn-outline"}
                >
                  {u.active ? "Bloquer" : "Débloquer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
