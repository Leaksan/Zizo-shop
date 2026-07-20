import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BellRing,
  Bike,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  TicketPercent,
  X,
} from "lucide-react";
import { api } from "../../api";
import { useShop } from "../../context/ShopContext";

const LINKS = [
  { to: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
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
  const navigate = useNavigate();
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
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`
            }
          >
            <l.icon size={17} />
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3 dark:border-slate-700">
        <NavLink
          to="/boutique"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Store size={17} />
          Voir la boutique
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
          <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">{shopName}</p>
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
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{shopName}</p>
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
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{shopName}</p>
          <p className="text-xs muted">Administration</p>
        </div>
        {navContent}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
