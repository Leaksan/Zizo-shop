import { Link } from "react-router-dom";
import { Bike, Banknote, Package, ShieldCheck, ShoppingBag, Truck, Zap } from "lucide-react";
import { useShop } from "../context/ShopContext";
import { formatPrice } from "../format";
import ProductVisual from "./ProductVisual";
import Reveal from "./Reveal";

export default function Hero({ products }) {
  const { freeShippingThreshold, currency } = useShop();
  const spotlight = [...products].sort((a, b) => b.reviews_count - a.reviews_count).slice(0, 3);

  return (
    <section className="relative -mx-4 -mt-8 mb-6 overflow-hidden bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4 pt-8 pb-8 sm:pt-14 sm:pb-10 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950">
      <div className="animate-blob pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-400/25 blur-3xl" />
      <div className="animate-blob-2 pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-xs font-bold text-brand-700 shadow-sm backdrop-blur dark:border-brand-800 dark:bg-slate-800/80 dark:text-brand-300">
              <Zap size={14} className="fill-amber-400 text-amber-400" />
              Livraison rapide partout à Libreville
            </span>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="mt-4 text-3xl leading-[1.1] font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
              Vos produits préférés,
              <br />
              livrés <span className="text-gradient animate-gradient bg-gradient-to-r from-brand-500 via-accent-500 to-accent-500">chez vous</span>.
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-3 max-w-xl text-base text-gray-600 sm:mt-5 sm:text-lg dark:text-slate-300">
              Commandez en quelques clics parmi notre sélection de produits de qualité. Paiement à
              la livraison, et suivez votre livreur en temps réel sur la carte.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-5 flex flex-wrap gap-3 sm:mt-7">
              <Link
                to="/boutique"
                className="btn-primary group inline-flex items-center gap-2 px-6 py-3 text-base"
              >
                <ShoppingBag size={18} className="transition-transform group-hover:-rotate-12" />
                Découvrir la boutique
              </Link>
            </div>
          </Reveal>
          <Reveal delay={400}>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 sm:mt-9 sm:gap-8">
              <Stat icon={<Package size={16} />} value={`${products.length}+`} label="Produits en stock" />
              <Stat
                icon={<Truck size={16} />}
                value={
                  freeShippingThreshold > 0
                    ? formatPrice(freeShippingThreshold, currency)
                    : "7j/7"
                }
                label={freeShippingThreshold > 0 ? "Livraison offerte dès" : "Livraison rapide"}
              />
              <Stat icon={<Banknote size={16} />} value="À la livraison" label="Paiement" />
            </div>
          </Reveal>
        </div>

        <div className="relative hidden h-[380px] justify-center lg:flex">
          <div className="animate-float absolute top-1/2 left-1/2 flex h-64 w-64 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 shadow-2xl shadow-brand-500/40">
            <ShoppingBag className="h-24 w-24 text-white/90" strokeWidth={1.2} />
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
                  <ProductVisual product={p} size="text-2xl" width={160} />
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
      </div>

    </section>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-600 shadow dark:bg-slate-800 dark:text-brand-400">
        {icon}
      </span>
      <span>
        <b className="block text-lg leading-tight font-extrabold text-gray-900 dark:text-white">
          {value}
        </b>
        <small className="text-xs text-gray-500 dark:text-slate-400">{label}</small>
      </span>
    </div>
  );
}

export function TrustBar() {
  const items = [
    { icon: <Truck size={22} />, title: "Livraison rapide", sub: "Partout à Libreville, 7j/7" },
    { icon: <ShieldCheck size={22} />, title: "Paiement à la livraison", sub: "Vous payez à la réception" },
    { icon: <Package size={22} />, title: "Suivi en temps réel", sub: "Position du livreur en direct" },
    { icon: <Bike size={22} />, title: "Livreurs locaux", sub: "De votre quartier" },
  ];
  return (
    <div className="mb-10 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {items.map((it, i) => (
        <Reveal key={it.title} delay={i * 100}>
          <div className="card flex h-full flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              {it.icon}
            </span>
            <span>
              <b className="block text-sm">{it.title}</b>
              <small className="text-xs muted">{it.sub}</small>
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
