import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, Plus, Sparkles, Tag, Trash2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useShop } from "../context/ShopContext";
import { formatPrice, timeAgo } from "../format";
import ProductVisual from "./ProductVisual";
import ReportButton from "./ReportButton";
import ShopAvatar from "./ShopAvatar";

// Texte des nouveautés automatiques (le vendeur n'a rien écrit)
function autoText(post) {
  const n = post.products.length;
  if (post.kind === "new_product") return n > 1 ? `a ajouté ${n} nouveaux produits` : "a ajouté un nouveau produit";
  if (post.kind === "promo") return n > 1 ? `a lancé des promotions sur ${n} produits` : "a lancé une promotion";
  return "";
}

/**
 * Publication du fil d'actu.
 * onFollow(slug) : appelé après un abonnement (le fil met à jour toutes les publications
 * de la boutique). onDelete : bouton de suppression (espace vendeur).
 */
export default function PostCard({ post, onFollow, onDelete }) {
  const { user } = useAuth();
  const { currency } = useShop();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const shop = post.shop;
  const isMine = user?.shop?.id === shop.id;
  const long = post.text.length > 280;

  const follow = async () => {
    if (!user) {
      navigate("/compte?suite=/fil");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/shops/${shop.slug}/follow`);
      onFollow?.(shop.slug);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 p-3">
        <Link to={`/b/${shop.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          <ShopAvatar shop={shop} className="h-10 w-10 text-base" />
          <span className="min-w-0">
            <b className="flex items-center gap-1 text-sm">
              <span className="truncate">{shop.name}</span>
              {shop.official && <BadgeCheck size={15} className="shrink-0 text-brand-600 dark:text-brand-400" />}
            </b>
            <small className="flex items-center gap-1.5 text-xs muted">
              {post.kind === "new_product" && (
                <span className="flex items-center gap-0.5 font-semibold text-brand-600 dark:text-brand-400">
                  <Sparkles size={12} /> Nouveauté
                </span>
              )}
              {post.kind === "promo" && (
                <span className="flex items-center gap-0.5 font-semibold text-accent-700 dark:text-accent-400">
                  <Tag size={12} /> Promo
                </span>
              )}
              {timeAgo(post.created_at)}
            </small>
          </span>
        </Link>
        {onDelete ? (
          <button onClick={onDelete} className="btn-danger p-2" aria-label="Supprimer la publication">
            <Trash2 size={15} />
          </button>
        ) : (
          !isMine && (
            <>
              {!post.following && (
                <button
                  onClick={follow}
                  disabled={busy}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300"
                >
                  <Plus size={14} /> Suivre
                </button>
              )}
              <ReportButton
                target="post"
                targetId={post.id}
                className="-mr-1 shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              />
            </>
          )
        )}
      </header>

      {post.kind === "post" ? (
        post.text && (
          <div className="px-3 pb-3">
            <p className={`text-sm whitespace-pre-line ${long && !expanded ? "line-clamp-6" : ""}`}>{post.text}</p>
            {long && (
              <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
                {expanded ? "Voir moins" : "Voir plus"}
              </button>
            )}
          </div>
        )
      ) : (
        <p className="px-3 pb-3 text-sm text-gray-700 dark:text-slate-300">
          <b>{shop.name}</b> {autoText(post)}
        </p>
      )}

      {post.images.length > 0 && (
        <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
          {post.images.map((src, i) => (
            <div key={src} className="relative aspect-square w-full shrink-0 snap-center bg-gray-100 dark:bg-slate-700">
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              {post.images.length > 1 && (
                <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                  {i + 1}/{post.images.length}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {post.products.length > 0 && (
        <div className="flex snap-x gap-2 overflow-x-auto p-3 [scrollbar-width:none]">
          {post.products.map((p) => {
            const cheapest = p.variants.find((v) => v.price === p.price_min);
            const oldPrice = cheapest?.old_price > cheapest?.price ? cheapest.old_price : null;
            return (
              <Link
                key={p.id}
                to={`/products/${p.id}`}
                className="w-36 shrink-0 snap-start overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="aspect-square">
                  <ProductVisual product={p} width={320} className={p.total_stock === 0 ? "opacity-50 grayscale" : ""} />
                </div>
                <div className="p-2">
                  <p className="line-clamp-2 text-xs leading-snug font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-sm font-extrabold">
                    {p.price_min !== p.price_max && <span className="mr-0.5 text-[10px] font-medium muted">dès</span>}
                    {formatPrice(p.price_min, currency)}
                  </p>
                  {oldPrice && <p className="text-[11px] text-gray-400 line-through">{formatPrice(oldPrice, currency)}</p>}
                  {p.total_stock === 0 && <p className="text-[11px] font-semibold text-red-600">Épuisé</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}
