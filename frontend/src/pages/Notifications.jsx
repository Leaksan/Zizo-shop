import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Bell, Package, ShieldAlert, Star, Store } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { timeAgo } from "../format";

const KIND_ICONS = { order: Package, shop: Store, review: Star, moderation: ShieldAlert };

// Notifications du compte : suivi des commandes, commandes de la boutique, décisions de l'admin
export default function Notifications() {
  const { user, loading, setUnread } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!user) return;
    api
      .get("/me/notifications")
      .then((r) => {
        setItems(r.items);
        // Ouvrir la page vaut lecture : la pastille disparaît, les nouvelles restent en évidence
        if (r.unread > 0) {
          api
            .post("/me/notifications/read")
            .then(() => setUnread(0))
            .catch(() => {});
        }
      })
      .catch(() => setItems([]));
  }, [user, setUnread]);

  if (loading) return <div className="skeleton h-40" />;
  if (!user) return <Navigate to="/compte?suite=/notifications" replace />;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
        <Bell size={24} className="text-brand-600 dark:text-brand-400" /> Notifications
      </h1>
      {items === null ? (
        <div className="skeleton h-40" />
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <Bell size={32} className="text-gray-300 dark:text-slate-600" />
          <p className="text-sm muted">
            Rien de nouveau pour l'instant. Le suivi de vos commandes
            {user.shop ? ", les commandes de votre boutique" : ""} et les messages de la plateforme
            s'afficheront ici.
          </p>
        </div>
      ) : (
        <ul className="card divide-y divide-gray-100 overflow-hidden dark:divide-slate-700">
          {items.map((n) => {
            const Icon = KIND_ICONS[n.kind] || Bell;
            const content = (
              <>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    n.read
                      ? "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300"
                      : "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400"
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? "text-gray-600 dark:text-slate-300" : "font-semibold"}`}>
                    {n.text}
                  </span>
                  <span className="text-xs muted">{timeAgo(n.created_at)}</span>
                </span>
                {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" aria-label="Nouvelle" />}
              </>
            );
            const cls = `flex items-start gap-3 p-4 ${n.read ? "" : "bg-brand-50/40 dark:bg-brand-950/20"}`;
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link to={n.link} className={`${cls} transition hover:bg-gray-50 dark:hover:bg-slate-700/50`}>
                    {content}
                  </Link>
                ) : (
                  <div className={cls}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
