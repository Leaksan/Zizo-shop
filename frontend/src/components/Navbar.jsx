import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Banknote,
  Bike,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  Menu,
  Moon,
  Package,
  Search,
  ShoppingCart,
  Store,
  Sun,
  Truck,
  X,
} from "lucide-react";
import { api } from "../api";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import { useFavorites } from "../context/FavoritesContext";
import { useShop } from "../context/ShopContext";
import { formatPrice } from "../format";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";
import Logo from "./Logo";

// Pages de détail : la barre d'onglets y est masquée, un bouton retour la remplace (mobile)
const SUB_PAGES = /^\/(products|checkout|order-confirmation)(\/|$)/;

const iconBtnCls =
  "relative rounded-xl p-3 text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800";

export default function Navbar() {
  const { count } = useCart();
  const { count: favCount } = useFavorites();
  const { theme, toggle } = useTheme();
  const { clearanceCount } = useShop();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Ordinateur : liens texte. Mobile : barre d'onglets en bas + menu ☰ (sans doublons)
  const links = [
    { to: "/boutique", icon: Store, label: "Boutique" },
    clearanceCount > 0 && { to: "/liquidation", icon: Flame, label: "Liquidation" },
    { to: "/suivi", icon: Package, label: "Mes commandes" },
  ].filter(Boolean);

  const linkCls = ({ isActive }) =>
    `hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:flex sm:items-center sm:gap-1.5 ${
      isActive
        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        : "text-gray-600 hover:bg-gray-100 hover:text-brand-600 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  // Ouvert depuis un lien partagé (pas d'historique) : retour à la boutique plutôt qu'hors du site
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/boutique"));

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg dark:border-slate-700/80 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-1 px-4 sm:gap-4">
        <div className="flex min-w-0 items-center">
          {SUB_PAGES.test(pathname) && (
            <button onClick={goBack} aria-label="Retour" title="Retour" className={`${iconBtnCls} -ml-3 sm:hidden`}>
              <ChevronLeft size={24} />
            </button>
          )}
          <Link to="/" className="min-w-0 shrink" aria-label="Accueil">
            <Logo />
          </Link>
        </div>
        <nav className="flex items-center gap-0.5 sm:gap-2">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              <l.icon size={16} /> {l.label}
            </NavLink>
          ))}
          <Link
            to="/boutique?focus=1"
            title="Rechercher"
            aria-label="Rechercher un produit"
            className={`${iconBtnCls} sm:hidden`}
          >
            <Search size={21} />
          </Link>
          <button
            onClick={toggle}
            title="Changer de thème"
            aria-label="Changer de thème"
            className={`${iconBtnCls} hidden sm:block`}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/favoris" title="Mes favoris" aria-label="Mes favoris" className={`${iconBtnCls} hidden sm:block`}>
            <Heart size={20} />
            {favCount > 0 && (
              <span className="animate-pop absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link to="/cart" title="Mon panier" aria-label="Mon panier" className={`${iconBtnCls} hidden sm:block`}>
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
      {menuOpen && createPortal(<MobileMenu onClose={() => setMenuOpen(false)} />, document.body)}
    </header>
  );
}

// Rayons gardés en mémoire : le menu s'ouvre instantanément la fois suivante
let categoriesCache = null;

// Menu ☰ mobile : ce que la barre d'onglets n'offre pas (rayons, aide, réglages)
function MobileMenu({ onClose }) {
  const { theme, toggle } = useTheme();
  const { shopPhone, clearanceCount, freeShippingThreshold, currency } = useShop();
  const { pathname, search } = useLocation();
  const [categories, setCategories] = useState(categoriesCache);
  const activeCat = pathname === "/boutique" ? new URLSearchParams(search).get("cat") : null;

  useEffect(() => {
    api
      .get("/categories")
      .then((list) => {
        categoriesCache = list;
        setCategories(list);
      })
      .catch(() => setCategories((c) => c || []));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const itemCls = (active) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition ${
      active
        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
        : "text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-700"
    }`;
  const sectionCls = "px-3 pb-1 text-xs font-bold tracking-wide text-gray-400 uppercase dark:text-slate-500";

  return (
    <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute top-0 right-0 flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-slate-700">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="rounded-lg p-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto p-3">
          <p className={sectionCls}>Rayons</p>
          {categories === null
            ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton mx-3 my-2 h-8" />)
            : categories
                .filter((c) => c.product_count > 0)
                .map((c) => (
                  <Link
                    key={c.id}
                    to={`/boutique?cat=${c.id}`}
                    onClick={onClose}
                    className={itemCls(activeCat === String(c.id))}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg dark:bg-brand-950">
                      {c.emoji || c.name.charAt(0)}
                    </span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{c.product_count}</span>
                  </Link>
                ))}
          <Link to="/boutique" onClick={onClose} className={itemCls(pathname === "/boutique" && !activeCat)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              <Store size={20} />
            </span>
            <span className="flex-1">Toute la boutique</span>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
          {clearanceCount > 0 && (
            <Link to="/liquidation" onClick={onClose} className={itemCls(pathname === "/liquidation")}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-orange-500">
                <Flame size={20} />
              </span>
              <span className="flex-1">Liquidation</span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                {clearanceCount}
              </span>
            </Link>
          )}

          <p className={`${sectionCls} mt-5`}>Aide</p>
          {shopPhone && (
            <a
              href={whatsappUrl(shopPhone, "Bonjour, j'ai une question 👋")}
              target="_blank"
              rel="noopener noreferrer"
              className={itemCls(false)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#1faa53]">
                <WhatsAppIcon size={20} />
              </span>
              Nous écrire sur WhatsApp
            </a>
          )}
          <p className="flex items-center gap-3 px-3 py-2 text-sm muted">
            <span className="flex w-8 shrink-0 justify-center">
              <Truck size={18} />
            </span>
            {freeShippingThreshold > 0
              ? `Livraison offerte dès ${formatPrice(freeShippingThreshold, currency)}`
              : "Livraison partout à Libreville"}
          </p>
          <p className="flex items-center gap-3 px-3 py-2 text-sm muted">
            <span className="flex w-8 shrink-0 justify-center">
              <Banknote size={18} />
            </span>
            Paiement à la livraison
          </p>

          <div className="mt-auto border-t border-gray-200 pt-3 dark:border-slate-700">
            <button onClick={toggle} className={`${itemCls(false)} w-full`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </span>
              {theme === "dark" ? "Mode clair" : "Mode sombre"}
            </button>
            <Link
              to="/livreur"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 text-sm muted transition hover:text-brand-600"
            >
              <span className="flex w-8 shrink-0 justify-center">
                <Bike size={16} />
              </span>
              Espace livreur
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
