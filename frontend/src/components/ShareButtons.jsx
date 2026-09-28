import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";
import { formatPrice } from "../format";
import { useShop } from "../context/ShopContext";

export default function ShareButtons({ product }) {
  const [copied, setCopied] = useState(false);
  const { shopName, currency } = useShop();
  const url = window.location.href;
  const text = `${product.name} — dès ${formatPrice(product.price_min, currency)} chez ${shopName} : ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text, url });
      } catch {}
    } else {
      copy();
    }
  };

  const btnCls =
    "flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-300";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-semibold muted">
        <Share2 size={13} /> Partager :
      </span>
      <a
        href={whatsappUrl("", text)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1fb857]"
      >
        <WhatsAppIcon size={14} />
        WhatsApp
      </a>
      <button onClick={nativeShare} className={btnCls}>
        <Share2 size={13} />
        Autres
      </button>
      <button onClick={copy} className={btnCls}>
        {copied ? <Check size={13} className="text-green-600" /> : <Link2 size={13} />}
        {copied ? "Copié !" : "Copier le lien"}
      </button>
    </div>
  );
}
