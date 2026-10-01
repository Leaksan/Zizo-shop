import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Banknote, MapPin, Truck } from "lucide-react";
import { api } from "../api";
import { categoryIcon } from "../categoryIcons";
import Logo, { LogoMark } from "../components/Logo";
import ProductVisual from "../components/ProductVisual";
import { useShop } from "../context/ShopContext";
import { citiesLabel } from "../cities";
import { formatPrice } from "../format";
import { markWelcomeSeen } from "../welcome";

// Page d'arrivée « à vue unique » : un seul écran de bienvenue à la première visite,
// sans barre de navigation. Ensuite l'adresse / mène directement à la boutique (App.jsx).
export default function Landing() {
  const { freeShippingThreshold, currency, zones } = useShop();
  const [categories, setCategories] = useState([]);
  const [spotlight, setSpotlight] = useState([]);

  useEffect(() => {
    markWelcomeSeen();
    api.get("/categories").then(setCategories).catch(() => {});
    // Vitrine (grand écran) : les produits disponibles les plus appréciés
    api
      .get("/products")
      .then((list) =>
        setSpotlight(
          list
            .filter((p) => p.total_stock > 0)
            .sort((a, b) => b.reviews_count - a.reviews_count)
            .slice(0, 3)
        )
      )
      .catch(() => {});
  }, []);

  const perks = [
    {
      icon: Truck,
      title: "Livraison rapide",
      sub:
        freeShippingThreshold > 0
          ? `${citiesLabel(zones)}, offerte dès ${formatPrice(freeShippingThreshold, currency)}`
          : `${citiesLabel(zones)}, 7j/7`,
    },
    { icon: Banknote, title: "Paiement à la livraison", sub: "Vous payez à la réception du colis" },
    { icon: MapPin, title: "Suivi en temps réel", sub: "Votre livreur sur la carte jusqu'à votre porte" },
  ];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-brand-50 via-white to-accent-50 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950">
      {/* Taches de couleur animées : coûteuses sur les petits téléphones, réservées aux grands écrans */}
      <div className="animate-blob pointer-events-none absolute -top-24 -right-24 hidden h-96 w-96 rounded-full bg-brand-400/25 blur-3xl sm:block" />
      <div className="animate-blob-2 pointer-events-none absolute -bottom-32 left-1/4 hidden h-80 w-80 rounded-full bg-accent-400/20 blur-3xl sm:block" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-5">
        <Logo />
        <Link
          to="/boutique"
          className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-brand-950"
        >
          Passer
        </Link>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="text-3xl leading-[1.1] font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Vos produits préférés,
            <br />
            livrés <span className="text-gradient animate-gradient">chez vous</span>.
          </h1>
          <p className="mt-4 max-w-xl text-base text-gray-600 sm:text-lg dark:text-slate-300">
            Commandez en quelques clics, payez à la livraison et suivez votre livreur jusqu'à votre
            porte.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {perks.map((p) => (
              <li key={p.title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400">
                  <p.icon size={20} />
                </span>
                <span>
                  <b className="block text-sm">{p.title}</b>
                  <small className="text-xs muted">{p.sub}</small>
                </span>
              </li>
            ))}
          </ul>

          {categories.some((c) => c.product_count > 0) && (
            <div className="mt-7">
              <p className="mb-2 text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-slate-400">
                Aller directement à un rayon
              </p>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter((c) => c.product_count > 0)
                  .map((c) => {
                    const Icon = categoryIcon(c.name);
                    return (
                      <Link
                        key={c.id}
                        to={`/boutique?cat=${c.id}`}
                        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:ring-brand-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                      >
                        <Icon size={15} className="text-brand-600 dark:text-brand-400" />
                        {c.name}
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}

          <Link
            to="/boutique"
            className="btn-primary group mt-8 flex w-full items-center justify-center gap-2 py-3.5 text-base sm:inline-flex sm:w-auto sm:px-8"
          >
            Découvrir les produits
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Grand écran : le sac 241 et quelques produits en vitrine */}
        <div className="relative hidden h-[400px] lg:block">
          <div className="animate-float absolute top-1/2 left-1/2 flex h-64 w-64 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-2xl shadow-brand-500/20 dark:bg-slate-800">
            <LogoMark className="h-36 w-36" />
          </div>
          {spotlight.map((p, i) => {
            const positions = [
              "top-0 left-2 animate-float",
              "top-32 right-0 animate-float-slow",
              "bottom-0 left-10 animate-float",
            ];
            return (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className={`absolute ${positions[i]} flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/90 p-3 pr-5 shadow-xl backdrop-blur transition hover:scale-105 dark:border-slate-700 dark:bg-slate-800/90`}
                style={{ animationDelay: `${i * 1.4}s` }}
              >
                <span className="h-12 w-12 overflow-hidden rounded-xl">
                  <ProductVisual product={p} width={160} />
                </span>
                <span>
                  <b className="block max-w-[130px] truncate text-sm text-gray-900 dark:text-white">
                    {p.name}
                  </b>
                  <small className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                    {formatPrice(p.price_min, currency)}
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
