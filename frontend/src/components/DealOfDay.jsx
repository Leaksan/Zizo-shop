import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Timer, Zap } from "lucide-react";
import { api } from "../api";
import { formatPrice } from "../format";
import { useShop } from "../context/ShopContext";
import ProductVisual from "./ProductVisual";

function useCountdown() {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setLeft(`${h}:${m}:${s}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return left;
}

export default function DealOfDay() {
  const [deal, setDeal] = useState(null);
  const { currency } = useShop();
  const countdown = useCountdown();

  useEffect(() => {
    api.get("/deal").then(setDeal).catch(() => {});
  }, []);

  if (!deal) return null;
  const variant = deal.variants.find((v) => v.old_price) || deal.variants[0];
  if (!variant) return null;

  // Carte compacte et entièrement cliquable, en haut de la boutique
  return (
    <Link
      to={`/products/${deal.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-3 shadow-sm transition hover:shadow-md sm:gap-5 sm:p-4 dark:border-accent-900 dark:from-accent-950/60 dark:to-slate-800"
    >
      <span className="h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28">
        <ProductVisual product={deal} width={240} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-400 px-2 py-0.5 text-[11px] font-bold tracking-wide text-gray-950 uppercase">
            <Zap size={12} className="fill-current" />
            Offre du jour
          </span>
          <span
            className="flex items-center gap-1 font-mono text-xs font-semibold text-accent-700 dark:text-accent-300"
            title="Nouvelle offre dans"
          >
            <Timer size={13} />
            {countdown}
          </span>
        </span>
        <b className="mt-1.5 line-clamp-2 block text-base leading-snug text-gray-900 sm:text-lg dark:text-white">
          {deal.name}
        </b>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-extrabold text-gray-900 dark:text-white">
            {formatPrice(variant.price, currency)}
          </span>
          {variant.old_price && (
            <span className="text-xs text-gray-400 line-through">{formatPrice(variant.old_price, currency)}</span>
          )}
          {deal.promo_percent > 0 && (
            <span className="text-xs font-bold text-accent-700 dark:text-accent-300">-{deal.promo_percent} %</span>
          )}
        </span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-gray-400 transition group-hover:translate-x-0.5" />
    </Link>
  );
}
