import { LogoMark } from "./Logo";

// Logo d'une boutique ; à défaut, son initiale (la boutique officielle garde le sac 241)
export default function ShopAvatar({ shop, className = "h-10 w-10 text-base" }) {
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`;
  if (shop?.logo_url) {
    return <img src={shop.logo_url} alt="" loading="lazy" className={`${base} object-cover`} />;
  }
  if (shop?.official) {
    return (
      <span className={`${base} bg-brand-50 dark:bg-brand-950`}>
        <LogoMark className="h-3/4 w-3/4" />
      </span>
    );
  }
  return (
    <span
      className={`${base} bg-brand-100 font-extrabold text-brand-700 dark:bg-brand-950 dark:text-brand-300`}
      aria-hidden="true"
    >
      {(shop?.name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}
