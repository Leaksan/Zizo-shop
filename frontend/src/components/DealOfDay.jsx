import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Timer, Zap } from "lucide-react";
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

  return (
    <section className="relative mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-accent-600 p-6 text-white shadow-xl shadow-orange-500/20 sm:p-8">
      <div className="animate-blob pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
      <div className="relative grid items-center gap-6 sm:grid-cols-[auto_1fr_auto]">
        <Link
          to={`/products/${deal.id}`}
          className="mx-auto h-32 w-32 shrink-0 overflow-hidden rounded-2xl shadow-lg transition hover:scale-105"
        >
          <ProductVisual product={deal} size="text-5xl" width={320} />
        </Link>
        <div className="text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            <Zap size={13} className="fill-yellow-300 text-yellow-300" />
            OFFRE DU JOUR
          </span>
          <h2 className="mt-2 text-2xl font-extrabold">{deal.name}</h2>
          <div className="mt-1 flex flex-wrap items-baseline justify-center gap-2 sm:justify-start">
            <span className="text-3xl font-black">{formatPrice(variant.price, currency)}</span>
            {variant.old_price && (
              <span className="text-lg text-white/70 line-through">
                {formatPrice(variant.old_price, currency)}
              </span>
            )}
            {deal.promo_percent > 0 && (
              <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-xs font-black text-orange-700">
                -{deal.promo_percent} %
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
            <Timer size={16} />
            Nouvelle offre dans
          </span>
          <span className="rounded-xl bg-white/15 px-4 py-2 font-mono text-2xl font-black tracking-wider backdrop-blur">
            {countdown}
          </span>
          <Link
            to={`/products/${deal.id}`}
            className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-orange-600 shadow transition hover:scale-105"
          >
            <Flame size={15} className="fill-orange-500 text-orange-500" />
            J'en profite
          </Link>
        </div>
      </div>
    </section>
  );
}
