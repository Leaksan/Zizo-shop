import { ShoppingBag } from "lucide-react";
import { useShop } from "../context/ShopContext";

export default function Logo({ compact = false, compactOnMobile = false }) {
  const { shopName } = useShop();
  const words = shopName.trim().split(/\s+/);
  // Nom en un seul mot : l'afficher une seule fois (évite « MaBoutique MaBoutique »)
  const head = words.length > 1 ? words.slice(0, -1).join(" ") + " " : "";
  const tail = words.length > 1 ? words[words.length - 1] : shopName;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="animate-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-accent-500 to-accent-500 shadow-lg shadow-brand-500/30 transition-transform hover:rotate-6 hover:scale-110">
        <ShoppingBag className="h-5 w-5 text-white" strokeWidth={2.2} />
      </span>
      {!compact && (
        <span
          className={`${compactOnMobile ? "hidden sm:inline" : ""} truncate text-xl font-extrabold tracking-tight text-gray-900 dark:text-white`}
        >
          {head}
          <span className="text-gradient">{tail}</span>
        </span>
      )}
    </span>
  );
}
