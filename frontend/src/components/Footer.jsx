import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Heart, Info, MapPin, Package, Truck } from "lucide-react";
import { useShop } from "../context/ShopContext";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";
import Logo from "./Logo";

export default function Footer() {
  const { shopName, shopPhone, freeShippingThreshold, currency, clearanceCount } = useShop();
  const [open, setOpen] = useState(false);

  return (
    <footer className="mt-12 border-t border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 text-sm font-semibold text-gray-600 transition hover:text-brand-600 dark:text-slate-300"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Info size={16} />
          Infos boutique, livraison &amp; contact
        </span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        className={`grid transition-all duration-300 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">
                Votre boutique de proximité en ligne. Des produits de qualité, livrés rapidement
                chez vous à Libreville.
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-bold">Boutique</h4>
              <ul className="space-y-1 text-sm text-gray-500 dark:text-slate-400">
                <li>
                  <Link to="/boutique" className="transition hover:text-brand-600">
                    Tous les produits
                  </Link>
                </li>
                {clearanceCount > 0 && (
                  <li>
                    <Link to="/liquidation" className="transition hover:text-orange-500">
                      🔥 Liquidation
                    </Link>
                  </li>
                )}
                <li>
                  <Link to="/favoris" className="transition hover:text-brand-600">
                    Mes favoris
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-bold">Aide</h4>
              <ul className="space-y-1 text-sm text-gray-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  <Package size={14} />
                  <Link to="/suivi" className="transition hover:text-brand-600">
                    Mes commandes
                  </Link>
                </li>
                <li className="flex items-center gap-1.5">
                  <Truck size={14} />
                  <Link to="/livreur" className="transition hover:text-brand-600">
                    Devenir livreur
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-bold">Contact</h4>
              <p className="flex flex-col gap-1.5 text-sm text-gray-500 dark:text-slate-400">
                {shopPhone && (
                  <a
                    href={whatsappUrl(shopPhone, "Bonjour, j'ai une question 👋")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-semibold text-[#1faa53] transition hover:text-[#25D366] dark:text-[#25D366]"
                  >
                    <WhatsAppIcon size={15} /> {shopPhone}
                    <span className="text-xs font-normal text-gray-400 dark:text-slate-500">
                      (WhatsApp privilégié)
                    </span>
                  </a>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} /> Libreville, Gabon
                </span>
                {freeShippingThreshold > 0 && (
                  <span className="text-xs">
                    🎁 Livraison offerte dès{" "}
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(
                      freeShippingThreshold
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-slate-700 dark:text-slate-500">
        © {new Date().getFullYear()} {shopName} — Fait avec{" "}
        <Heart size={11} className="inline fill-red-500 text-red-500" /> à Libreville.
        <span className="mt-1 block opacity-70">Version du {__BUILD_TIME__}</span>
      </div>
    </footer>
  );
}
