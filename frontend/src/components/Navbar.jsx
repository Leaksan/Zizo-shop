import { Link, NavLink } from "react-router-dom";
import { Bike, Heart, Moon, Package, ShoppingCart, Store, Sun } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useFavorites } from "../context/FavoritesContext";
import Logo from "./Logo";

export default function Navbar() {
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const { theme, toggle } = useTheme();

  const linkCls = ({ isActive }) =>
    `hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:flex sm:items-center sm:gap-1.5 ${
      isActive
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
        : "text-gray-600 hover:bg-gray-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg dark:border-slate-700/80 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/boutique" className={linkCls}>
            <Store size={16} /> Boutique
          </NavLink>
          <NavLink to="/suivi" className={linkCls}>
            <Package size={16} /> Suivi
          </NavLink>
          <NavLink to="/livreur" className={linkCls}>
            <Bike size={16} /> Livreur
          </NavLink>
          <button
            onClick={toggle}
            title="Changer de thème"
            className="rounded-lg p-2.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <Link
            to="/?favoris=1"
            title="Mes favoris"
            className="relative rounded-lg p-2.5 text-gray-500 transition hover:bg-gray-100 hover:text-red-500 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Heart size={19} />
            {favCount > 0 && (
              <span className="animate-pop absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link
            to="/cart"
            title="Mon panier"
            className="relative rounded-lg p-2.5 text-gray-500 transition hover:bg-gray-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ShoppingCart size={19} />
            {count > 0 && (
              <span className="animate-pop absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
