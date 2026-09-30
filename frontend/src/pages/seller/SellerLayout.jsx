import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import { Clock, ExternalLink, Newspaper, Package, ShoppingBag, Store, XCircle } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import ShopAvatar from "../../components/ShopAvatar";
import { SHOP_STATUS } from "../../shopStatus";
import { usePolling } from "../../hooks";

const TABS = [
  { to: "/vendeur/produits", icon: Package, label: "Produits" },
  { to: "/vendeur/commandes", icon: ShoppingBag, label: "Commandes", badge: "orders_to_prepare" },
  { to: "/vendeur/publications", icon: Newspaper, label: "Publications" },
  { to: "/vendeur/boutique", icon: Store, label: "Ma boutique" },
];

// Espace vendeur : sa boutique et ses produits (la boutique peut être en attente de validation)
export default function SellerLayout() {
  const { user, loading } = useAuth();
  const [shop, setShop] = useState(null);
  const [counts, setCounts] = useState({});

  const reload = useCallback(
    () =>
      api
        .get("/my/shop")
        .then((r) => {
          setShop(r.shop);
          setCounts({ orders_to_prepare: r.orders_to_prepare || 0 });
        })
        .catch(() => {}),
    []
  );

  useEffect(() => {
    if (user?.shop) reload();
  }, [user?.shop, reload]);
  // Nouvelles commandes : le compteur de l'onglet se met à jour tout seul
  usePolling(() => user?.shop && reload(), 30000, [user?.shop]);

  if (loading) return <div className="skeleton h-40" />;
  if (!user) return <Navigate to="/compte?suite=/vendeur" replace />;
  if (!user.shop) return <Navigate to="/vendeur/ouvrir" replace />;
  if (!shop) return <div className="skeleton h-40" />;

  const status = SHOP_STATUS[shop.status];
  const tabCls = ({ isActive }) =>
    `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
      isActive
        ? "bg-brand-600 text-white"
        : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <ShopAvatar shop={shop} className="h-12 w-12 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{shop.name}</h1>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>
            {status.label}
          </span>
        </div>
        <Link
          to={`/b/${shop.slug}`}
          className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Ma page <ExternalLink size={14} />
        </Link>
      </div>

      {shop.status === "pending" && (
        <p className="flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-900 dark:bg-accent-950/50 dark:text-accent-200">
          <Clock size={18} className="mt-0.5 shrink-0" />
          Votre boutique est en attente de validation par notre équipe. Ajoutez vos produits dès
          maintenant : ils seront visibles dès qu'elle sera validée.
        </p>
      )}
      {shop.status === "rejected" && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <span>
            Votre boutique n'a pas été validée{shop.status_note ? ` : ${shop.status_note}` : "."} Corrigez
            ses informations dans « Ma boutique » et enregistrez : elle repassera en validation.
          </span>
        </p>
      )}

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Espace vendeur">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={tabCls}>
            <t.icon size={16} /> {t.label}
            {counts[t.badge] > 0 && (
              <span className="rounded-full bg-accent-500 px-1.5 text-xs font-bold text-gray-950">
                {counts[t.badge]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ shop, reload }} />
    </div>
  );
}
