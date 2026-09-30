import { NavLink, useLocation } from "react-router-dom";
import { Compass, Newspaper, Package, ShoppingCart, UserRound } from "lucide-react";
import { useCart } from "../context/CartContext";

// Pages qui ont leur propre barre d'action en bas, ou qu'on garde sans distraction
const HIDDEN_ON = [/^\/products\//, /^\/checkout/, /^\/livreur/];

// Barre d'onglets mobile : les actions principales toujours à portée de pouce.
// Pas d'onglet « Accueil » : l'accueil n'est vu qu'une fois, le fil d'actu est la page principale.
const TABS = [
  { to: "/fil", icon: Newspaper, label: "Fil" },
  // Explorer : les produits et l'annuaire des boutiques
  { to: "/boutique", icon: Compass, label: "Explorer", also: /^\/boutiques/ },
  { to: "/cart", icon: ShoppingCart, label: "Panier", cart: true },
  { to: "/suivi", icon: Package, label: "Commandes" },
  // L'espace vendeur, les favoris et les notifications font partie du compte : l'onglet reste allumé
  { to: "/compte", icon: UserRound, label: "Compte", also: /^\/(vendeur|favoris|notifications)/ },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { count } = useCart();
  if (HIDDEN_ON.some((r) => r.test(pathname))) return null;

  return (
    <>
      <div className="h-16 md:hidden" aria-hidden="true" />
      <nav
        aria-label="Navigation principale"
        className="bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-700 dark:bg-slate-900/95"
      >
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
                isActive || t.also?.test(pathname) ? "text-brand-600 dark:text-brand-400" : "text-gray-500 dark:text-slate-400"
              }`
            }
          >
            <span className="relative">
              <t.icon size={22} strokeWidth={2} />
              {t.cart && count > 0 && (
                <span className="animate-pop absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-gray-950">
                  {count}
                </span>
              )}
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
