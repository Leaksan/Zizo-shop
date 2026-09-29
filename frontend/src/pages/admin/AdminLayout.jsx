import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BellRing,
  Bike,
  ExternalLink,
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

const LINKS = [
  { to: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/admin/shops", label: "Boutiques", icon: Store, badge: "pending_shops" },
  { to: "/admin/users", label: "Comptes", icon: Users },
  { to: "/admin/products", label: "Produits", icon: ShoppingBag },
  { to: "/admin/orders", label: "Commandes", icon: Package },
  { to: "/admin/stock-requests", label: "Demandes", icon: BellRing },
  { to: "/admin/couriers", label: "Livreurs", icon: Bike },
  { to: "/admin/promos", label: "Codes promo", icon: TicketPercent },
  { to: "/admin/categories", label: "Catégories", icon: Tag },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

export default function AdminLayout() {
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState({});
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

  // Pastilles du menu (boutiques à valider…), rafraîchies à chaque changement de page
  // et par les pages qui les font changer (validation d'une boutique)
  const refreshCounts = useCallback(() => {
    api.get("/admin/stats").then(setCounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (checked) refreshCounts();
  }, [checked, pathname, refreshCounts]);

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

  const navContent = (
    <>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {LINKS.map((l) => (
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
            {l.badge && counts[l.badge] > 0 && (
              <span className="rounded-full bg-accent-400 px-1.5 text-xs font-bold text-gray-950">
                {counts[l.badge]}
              </span>
            )}
          </NavLink>
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

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 lg:flex-row dark:bg-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden dark:border-slate-700 dark:bg-slate-800">
        <div>
          <p className="text-base font-bold text-brand-600 dark:text-brand-400">{shopName}</p>
          <p className="text-xs muted">Administration</p>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Menu admin"
        >
          <Menu size={22} />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute top-0 left-0 flex h-full w-72 flex-col bg-white shadow-2xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-slate-700">
              <div>
                <p className="text-lg font-bold text-brand-600 dark:text-brand-400">{shopName}</p>
                <p className="text-xs muted">Administration</p>
              </div>
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

      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-gray-200 p-5 dark:border-slate-700">
          <p className="text-lg font-bold text-brand-600 dark:text-brand-400">{shopName}</p>
          <p className="text-xs muted">Administration</p>
        </div>
        {navContent}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet context={{ refreshCounts }} />
      </main>
    </div>
  );
}
