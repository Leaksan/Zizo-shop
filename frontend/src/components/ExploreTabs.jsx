import { NavLink } from "react-router-dom";
import { ShoppingBag, Store } from "lucide-react";

// « Explorer » : les produits de toutes les boutiques, ou l'annuaire des boutiques
export default function ExploreTabs() {
  const cls = ({ isActive }) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
      isActive ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300" : "text-gray-500"
    }`;
  return (
    <nav aria-label="Explorer" className="flex gap-1 rounded-xl bg-gray-100 p-1 sm:max-w-sm dark:bg-slate-800">
      <NavLink to="/boutique" className={cls}>
        <ShoppingBag size={16} /> Produits
      </NavLink>
      <NavLink to="/boutiques" className={cls}>
        <Store size={16} /> Boutiques
      </NavLink>
    </nav>
  );
}
