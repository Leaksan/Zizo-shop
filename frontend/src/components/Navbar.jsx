import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Bike, Flame, Heart, Menu, Moon, Package, ShoppingCart, Store, Sun, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useFavorites } from "../context/FavoritesContext";
import Logo from "./Logo";

const LINKS = [
  { to: "/boutique", icon: Store, label: "Boutique" },
  { to: "/favoris", icon: Heart, label: "Mes favoris" },
  { to: "/liquidation", icon: Flame, label: "Liquidation 🔥" },
  { to: "/suivi", icon: Package, label: "Suivi commande" },
  { to: "/livreur", icon: Bike, label: "Espace livreur" },
];

export default function Navbar() {
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const linkCls = ({ isActive }) =>
    `hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:flex sm:items-center sm:gap-1.5 ${
      isActive
        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        : "text-gray-600 hover:bg-gray-100 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  const iconBtnCls =
    "relative rounded-xl p-3 text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800";

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg dark:border-slate-700/80 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-1 px-4 sm:gap-4">
        <Link to="/" className="shrink-0">
          <Logo compactOnMobile />
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-2">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              <l.icon size={16} /> {l.label}
            </NavLink>
          ))}
          <button
            onClick={toggle}
            title="Changer de thème"
            aria-label="Changer de thème"
            className={iconBtnCls}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/favoris" title="Mes favoris" aria-label="Mes favoris" className={iconBtnCls}>
            <Heart size={20} />
            {favCount > 0 && (
              <span className="animate-pop absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link to="/cart" title="Mon panier" aria-label="Mon panier" className={iconBtnCls}>
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="animate-pop absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen(true)}
            title="Menu"
            aria-label="Ouvrir le menu"
            className={`${iconBtnCls} sm:hidden`}
          >
            <Menu size={22} />
          </button>
        </nav>
      </div>

      {/* Drawer rendu via portail : le backdrop-blur du header crée un bloc
          conteneur qui emprisonnerait un descendant position:fixed (bug menu
          de 64px de haut). Sur body, il couvre toujours tout l'écran. */}
      {menuOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 sm:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute top-0 right-0 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-slate-700">
                <Logo compactOnMobile />
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Fermer le menu"
                  className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                {LINKS.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition ${
                        isActive
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                          : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`
                    }
                  >
                    <l.icon size={20} />
                    {l.label}
                  </NavLink>
                ))}
              </nav>
              <p className="border-t border-gray-200 p-4 text-center text-xs muted dark:border-slate-700">
                Paiement à la livraison · Libreville 7j/7
              </p>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
