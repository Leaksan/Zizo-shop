import { ShoppingBag } from "lucide-react";
import { useShop } from "../context/ShopContext";

export default function Logo({ compact = false }) {
  const { shopName } = useShop();
  const words = shopName.trim().split(/\s+/);
  const lastWord = words.length > 1 ? words.pop() : "";
  return (
    <span className="flex items-center gap-2.5">
      <span className="animate-gradient flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/30 transition-transform hover:rotate-6 hover:scale-110">
        <ShoppingBag className="h-5 w-5 text-white" strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {words.join(" ")}
          {words.length > 0 && " "}
          <span className="text-gradient">{lastWord || shopName}</span>
        </span>
      )}
    </span>
  );
}
