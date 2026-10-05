import { useEffect, useRef } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, MoreHorizontal, Moon, Sun } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useShop } from "../context/ShopContext";
import Logo from "./Logo";

const SUB_PAGES = /^\/(products|checkout|order-confirmation)(\/|$)/;

export default function Navbar() {
  const { count } = useCart();
  const { theme, toggle } = useTheme();
  const { clearanceCount } = useShop();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const menu = useRef(null);
  const isCheckout = pathname === "/checkout";

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname, search]);

  useEffect(() => {
    const close = (e) => {
      if (menu.current && !menu.current.contains(e.target))
        menu.current.open = false;
    };
    const escape = (e) => {
      if (e.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary").focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium ${
      isActive
        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;
  const secondaryClass =
    "block rounded-lg px-3 py-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800";
  const goBack = () => {
    if (isCheckout) navigate("/cart");
    else if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/boutique");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {SUB_PAGES.test(pathname) && (
            <button
              onClick={goBack}
              aria-label="Retour"
              className="-ml-2 rounded-lg p-2 text-gray-600 dark:text-slate-300"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <Link to="/boutique" aria-label="Boutique" className="min-w-0">
            <Logo />
          </Link>
        </div>
        {isCheckout ? (
          <span className="text-sm muted">Votre commande</span>
        ) : (
          <div className="flex items-center gap-2">
            <nav
              aria-label="Navigation principale sur ordinateur"
              className="hidden items-center gap-1 md:flex"
            >
              <NavLink to="/boutique" className={linkClass}>
                Boutique
              </NavLink>
              <NavLink to="/cart" className={linkClass}>
                Panier{count > 0 ? ` (${count})` : ""}
              </NavLink>
              <NavLink to="/suivi" className={linkClass}>
                Commandes
              </NavLink>
            </nav>
            <details ref={menu} className="relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
                <MoreHorizontal size={20} /> Plus
              </summary>
              <nav
                aria-label="Options supplémentaires"
                className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <Link to="/favoris" className={secondaryClass}>
                  Mes favoris
                </Link>
                {clearanceCount > 0 && (
                  <Link to="/liquidation" className={secondaryClass}>
                    Les offres
                  </Link>
                )}
                <a
                  href="#infos-boutique"
                  className={secondaryClass}
                  onClick={() => {
                    menu.current.open = false;
                    const info = document.getElementById("infos-boutique");
                    if (info) {
                      info.open = true;
                      info.querySelector("summary").focus();
                    }
                  }}
                >
                  Informations et aide
                </a>
                <button
                  onClick={toggle}
                  className={`${secondaryClass} flex w-full items-center gap-2 text-left`}
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === "dark" ? "Mode clair" : "Mode sombre"}
                </button>
              </nav>
            </details>
          </div>
        )}
      </div>
    </header>
  );
}
