import { NavLink, useLocation } from "react-router-dom";
import { Package, ShoppingCart, Store } from "lucide-react";
import { useCart } from "../context/CartContext";

// Pages qui ont leur propre barre d'action en bas, ou qu'on garde sans distraction
const HIDDEN_ON = [/^\/products\//, /^\/checkout/, /^\/livreur/];

// Barre d'onglets mobile : les actions principales toujours à portée de pouce
export default function BottomNav() {
  const { pathname } = useLocation();
  const { count } = useCart();
  if (HIDDEN_ON.some((r) => r.test(pathname))) return null;

  // Trois destinations : découvrir, acheter et suivre sa commande.
  const tabs = [
    { to: "/boutique", icon: Store, label: "Boutique" },
    { to: "/cart", icon: ShoppingCart, label: "Panier", badge: count },
    { to: "/suivi", icon: Package, label: "Commandes" },
  ];

  return (
    <>
      <div className="h-16 md:hidden" aria-hidden="true" />
      <nav
        aria-label="Navigation principale"
        className="bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-700 dark:bg-slate-900/95"
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
                isActive
                  ? "text-brand-700 dark:text-brand-400"
                  : "text-gray-500 dark:text-slate-400"
              }`
            }
          >
            <span className="relative">
              <t.icon size={22} strokeWidth={2} />
              {t.badge > 0 && (
                <span className="animate-pop absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-gray-950">
                  {t.badge}
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
