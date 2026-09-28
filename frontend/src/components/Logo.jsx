import { useShop } from "../context/ShopContext";

// Le sac émeraude marqué 241 avec une étiquette ambre (même dessin que public/favicon.svg
// et les icônes de l'appli). L'étiquette reste dans le coin, à l'écart du « 1 » (sinon on lit « 24i »).
export function LogoMark({ className = "h-9 w-9" }) {
  return (
    <svg viewBox="6 9 88 88" aria-hidden="true" className={className}>
      <path
        d="M35 36V30a15 15 0 0 1 30 0v6"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        className="stroke-brand-700 dark:stroke-brand-400"
      />
      <path d="M16 36h68l-5 50a9 9 0 0 1-9 8H30a9 9 0 0 1-9-8Z" className="fill-brand-600" />
      <text
        x="50"
        y="77"
        textAnchor="middle"
        fontSize="29"
        fontWeight="900"
        letterSpacing="-0.5"
        className="fill-white"
      >
        241
      </text>
      <circle cx="76.5" cy="45" r="4.8" className="fill-accent-500" />
    </svg>
  );
}

// Logo « 241 Shop » : le sac suivi du nom réglé dans l'admin
export default function Logo() {
  const { shopName } = useShop();
  const words = shopName.trim().split(/\s+/);
  // Dernier mot en couleur de marque (« 241 Shop » → « 241 » + « Shop »)
  const head = words.length > 1 ? words.slice(0, -1).join(" ") + " " : "";
  const tail = words.length > 1 ? words[words.length - 1] : shopName;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LogoMark className="h-9 w-9 shrink-0 transition-transform hover:-rotate-6 hover:scale-105" />
      <span className="truncate text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
        {head}
        <span className="text-brand-600 dark:text-brand-400">{tail}</span>
      </span>
    </span>
  );
}
