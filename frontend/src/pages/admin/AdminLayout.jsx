import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BellRing,
  Bike,
  ExternalLink,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  TicketPercent,
  Users,
  X,
} from "lucide-react";
import { api } from "../../api";
import { useShop } from "../../context/ShopContext";
import { LogoMark } from "../../components/Logo";
import { usePolling } from "../../hooks";
import { play } from "../../sounds";

// Commandes encore en cours de traitement (préparation, attente d'un livreur, retrait)
const openOrders = (c) => (c.pending_orders || 0) + (c.pickup_pending || 0);

// Menu rangé par rubrique ; la pastille compte ce qui attend une action
const GROUPS = [
  { links: [{ to: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard }] },
  {
    title: "Ventes",
    links: [
      { to: "/admin/orders", label: "Commandes", icon: Package, badge: openOrders },
      { to: "/admin/couriers", label: "Livreurs", icon: Bike, badge: (c) => c.couriers_to_verify },
      { to: "/admin/promos", label: "Codes promo", icon: TicketPercent },
    ],
  },
  {
    title: "Hub vendeurs",
    links: [
      { to: "/admin/shops", label: "Boutiques", icon: Store, badge: (c) => c.pending_shops },
      { to: "/admin/users", label: "Comptes", icon: Users },
      { to: "/admin/reports", label: "Signalements", icon: Flag, badge: (c) => c.open_reports },
    ],
  },
  {
    title: "Catalogue",
    links: [
      { to: "/admin/products", label: "Produits", icon: ShoppingBag },
      { to: "/admin/categories", label: "Catégories", icon: Tag },
      { to: "/admin/stock-requests", label: "Demandes de stock", icon: BellRing, badge: (c) => c.stock_requests },
    ],
  },
  { title: "Réglages", links: [{ to: "/admin/settings", label: "Paramètres", icon: Settings }] },
];

export default function AdminLayout() {
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const lastOrders = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { shopName } = useShop();

  useEffect(() => {
    api
      .get("/admin/me")
      .then((res) => {
        if (!res.admin) navigate("/admin/login", { replace: true });
        else setChecked(true);
      })
      .catch(() => navigate("/admin/login", { replace: true }));
  }, [navigate]);

  // Pastilles du menu, rafraîchies à chaque changement de page, chaque minute, et par les pages
  // qui les font changer (validation d'une boutique…). Nouvelle commande : petit son « vente ».
  const refreshCounts = useCallback(() => {
    api
      .get("/admin/stats")
      .then((stats) => {
        const open = openOrders(stats);
        if (lastOrders.current !== null && open > lastOrders.current) play("vente");
        lastOrders.current = open;
        setCounts(stats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (checked) refreshCounts();
  }, [checked, pathname, refreshCounts]);
  usePolling(() => checked && refreshCounts(), 60000, [checked]);

  const logout = async () => {
    await api.post("/admin/logout").catch(() => {});
    navigate("/admin/login");
  };

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-500 dark:bg-slate-900">
        Chargement…
      </div>
    );
  }

  const brand = (
    <div className="flex min-w-0 items-center gap-2.5">
      <LogoMark className="h-9 w-9 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-brand-700 dark:text-brand-400">{shopName}</p>
        <p className="text-xs muted">Administration</p>
      </div>
    </div>
  );

  const navContent = (
    <>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {GROUPS.map((group, i) => (
          <div key={group.title || i} className="flex flex-col gap-0.5">
            {group.title && (
              <p className="px-3 pb-1 text-[11px] font-bold tracking-wider text-gray-400 uppercase dark:text-slate-500">
                {group.title}
              </p>
            )}
            {group.links.map((l) => {
              const badge = l.badge ? l.badge(counts) : 0;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                        : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`
                  }
                >
                  <l.icon size={17} />
                  <span className="flex-1">{l.label}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-accent-400 px-1.5 text-xs font-bold text-gray-950">{badge}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3 dark:border-slate-700">
        <NavLink
          to="/boutique"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ExternalLink size={17} />
          Voir le site
        </NavLink>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <LogOut size={17} />
          Déconnexion
        </button>
      </div>
    </>
  );

  // Téléphone : total de ce qui attend une action, sur le bouton du menu
  const todo =
    (counts.pending_shops || 0) +
    (counts.open_reports || 0) +
    (counts.couriers_to_verify || 0) +
    (counts.stock_requests || 0);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 lg:flex-row dark:bg-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden dark:border-slate-700 dark:bg-slate-800">
        {brand}
        <button
          onClick={() => setMenuOpen(true)}
          className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Menu admin"
        >
          <Menu size={22} />
          {todo > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-gray-950">
              {todo}
            </span>
          )}
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="absolute top-0 left-0 flex h-full w-72 flex-col bg-white shadow-2xl dark:bg-slate-800">
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 p-4 dark:border-slate-700">
              {brand}
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-gray-200 p-5 dark:border-slate-700">{brand}</div>
        {navContent}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet context={{ refreshCounts, counts }} />
      </main>
    </div>
  );
}
