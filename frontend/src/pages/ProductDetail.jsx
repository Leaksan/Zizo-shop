import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Banknote, BellRing, Check, CheckCircle2, ChevronRight, Flame, Heart, MapPin, ShoppingCart, Truck, XCircle, Zap } from "lucide-react";
import { feeRange } from "../cartMath";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";
import { api } from "../api";
import { formatPrice } from "../format";
import { useCart } from "../context/CartContext";
import { useShop } from "../context/ShopContext";
import { useFavorites } from "../context/FavoritesContext";
import ProductVisual from "../components/ProductVisual";
import Rating from "../components/Rating";
import ShareButtons from "../components/ShareButtons";
import ReviewsSection from "../components/ReviewsSection";
import { usePolling } from "../hooks";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const shop = useShop();
  const { currency } = shop;
  const { isFavorite, toggle } = useFavorites();
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [requestPhone, setRequestPhone] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    api
      .get(`/products/${id}`)
      .then((p) => {
        setProduct(p);
        setVariant((current) => {
          if (current) {
            const updated = p.variants.find((v) => v.id === current.id);
            if (updated) return updated;
          }
          return p.variants.find((v) => v.stock > 0) || p.variants[0] || null;
        });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  usePolling(() => {
    api
      .get(`/products/${id}`)
      .then((p) => {
        setProduct(p);
        setVariant((current) =>
          current ? p.variants.find((v) => v.id === current.id) || current : current
        );
      })
      .catch(() => {});
  }, 30000, [id]);

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-600">{error}</p>
        <Link to="/boutique" className="mt-4 inline-flex items-center gap-1.5 text-brand-600 hover:underline">
          <ArrowLeft size={16} />
          Retour à la boutique
        </Link>
      </div>
    );
  }
  if (!product) return <p className="py-16 text-center muted">Chargement…</p>;

  const maxQty = variant ? Math.min(variant.stock, 20) : 0;
  const fav = isFavorite(product.id);
  const promo = variant?.old_price
    ? Math.round((1 - variant.price / variant.old_price) * 100)
    : 0;

  const handleAdd = () => {
    if (!variant || quantity < 1) return;
    addItem(product, variant, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (!variant || variant.stock === 0 || quantity < 1) return;
    addItem(product, variant, quantity);
    navigate("/checkout");
  };

  const handleStockRequest = async (e) => {
    e.preventDefault();
    setRequestError("");
    try {
      await api.post("/stock-requests", { variant_id: variant.id, phone: requestPhone });
      setRequestSent(true);
    } catch (e2) {
      setRequestError(e2.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-20 md:pb-0">
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400">
        <Link to="/boutique" className="text-brand-600 hover:underline dark:text-brand-400">
          Boutique
        </Link>
        {product.category && (
          <>
            <ChevronRight size={14} />
            <Link
              to={`/boutique?cat=${product.category_id}`}
              className="text-brand-600 hover:underline dark:text-brand-400"
            >
              {product.category}
            </Link>
          </>
        )}
      </nav>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="card overflow-hidden">
          <ProductVisual
            product={product}
            className="aspect-[4/3] sm:aspect-square"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <button
              onClick={() => toggle(product.id)}
              title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
              className="transition hover:scale-125"
            >
              <Heart
                size={26}
                className={fav ? "fill-red-500 text-red-500" : "text-gray-300 dark:text-slate-600"}
              />
            </button>
          </div>
          {(product.real_reviews_count > 0 || product.rating > 0) && (
            <Rating
              value={product.real_reviews_count > 0 ? product.real_rating : product.rating}
              count={
                product.real_reviews_count > 0 ? product.real_reviews_count : product.reviews_count
              }
              size={18}
            />
          )}
          {product.badge && (
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                product.badge === "Promo" ? "bg-accent-400 text-gray-950" : "bg-brand-600 text-white"
              }`}
            >
              {product.badge === "Promo" && product.promo_percent
                ? `-${product.promo_percent} %`
                : product.badge}
            </span>
          )}
          <p className="text-gray-600 dark:text-slate-300">{product.description}</p>

          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-slate-300">
              Variante{product.variants.length > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => {
                const selected = variant?.id === v.id;
                const disabled = v.stock === 0;
                return (
                  <button
                    key={v.id}
                    disabled={disabled}
                    onClick={() => {
                      setVariant(v);
                      setQuantity(1);
                    }}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                        : disabled
                          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 line-through dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600"
                          : "border-gray-300 bg-white text-gray-700 hover:border-brand-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {v.name} — {formatPrice(v.price, currency)}
                  </button>
                );
              })}
            </div>
          </div>

          {variant && (
            <div className="card flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-2xl font-bold">{formatPrice(variant.price, currency)}</p>
                    {variant.old_price && (
                      <>
                        <p className="text-sm text-gray-400 line-through dark:text-slate-500">
                          {formatPrice(variant.old_price, currency)}
                        </p>
                        <span className="rounded-full bg-accent-400 px-2 py-0.5 text-xs font-bold text-gray-950">
                          -{promo} %
                        </span>
                      </>
                    )}
                  </div>
                  <p
                    className={`flex items-center gap-1.5 text-sm ${
                      variant.stock > 5
                        ? "text-green-600 dark:text-green-400"
                        : variant.stock > 0
                          ? "text-accent-700 dark:text-accent-400"
                          : "text-red-600"
                    }`}
                  >
                    {variant.stock > 5 ? (
                      <><CheckCircle2 size={16} /> En stock</>
                    ) : variant.stock > 0 ? (
                      <><Flame size={16} /> Plus que {variant.stock} en stock</>
                    ) : (
                      <><XCircle size={16} /> Rupture de stock</>
                    )}
                  </p>
                </div>
                {variant.stock > 0 && (
                  <div className="flex items-center rounded-lg border border-gray-300 dark:border-slate-600">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-brand-600 dark:text-slate-300"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                      className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-brand-600 dark:text-slate-300"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              {variant.stock > 0 ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleAdd}
                    className="btn-primary flex w-full items-center justify-center gap-2 py-2.5"
                  >
                    {added ? <Check size={17} /> : <ShoppingCart size={17} />}
                    {added ? "Ajouté au panier" : "Ajouter au panier"}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-400 py-2.5 text-sm font-semibold text-gray-950 transition hover:bg-accent-500 hover:shadow-lg hover:shadow-accent-500/30 active:scale-95"
                  >
                    <Zap size={17} className="fill-current" />
                    Commander maintenant
                  </button>
                </div>
              ) : requestSent ? (
                <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
                  <CheckCircle2 size={16} />
                  Demande enregistrée ! Nous vous contacterons dès le réassort.
                </p>
              ) : (
                <form onSubmit={handleStockRequest} className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    Cette variante est épuisée — demandez le réassort :
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="tel"
                      value={requestPhone}
                      onChange={(e) => setRequestPhone(e.target.value)}
                      placeholder="Votre n° pour être alerté (optionnel)"
                      className="input min-w-0 flex-1"
                    />
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-accent-500"
                    >
                      <BellRing size={15} />
                      Demander
                    </button>
                  </div>
                  {requestError && <p className="text-xs text-red-600">{requestError}</p>}
                </form>
              )}
            </div>
          )}

          <Guarantees shop={shop} product={product} />

          <ShareButtons product={product} />
        </div>
      </div>

      <ReviewsSection productId={product.id} />

      {/* Barre d'achat fixe sur mobile : prix + ajout panier toujours accessibles */}
      {variant && (
        <div className="mobile-cta fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur md:hidden dark:border-slate-700 dark:bg-slate-800/95">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold">{formatPrice(variant.price, currency)}</span>
              {variant.old_price && (
                <span className="text-xs text-gray-400 line-through dark:text-slate-500">
                  {formatPrice(variant.old_price, currency)}
                </span>
              )}
            </p>
          </div>
          {variant.stock > 0 ? (
            <button
              onClick={handleAdd}
              className="btn-primary flex shrink-0 items-center gap-2 px-5 py-3"
            >
              {added ? <Check size={18} /> : <ShoppingCart size={18} />}
              {added ? "Ajouté" : "Ajouter"}
            </button>
          ) : (
            <span className="shrink-0 rounded-lg bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 dark:bg-slate-700 dark:text-slate-400">
              Épuisé
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Rassurer au moment de décider : paiement, livraison, suivi, contact
function Guarantees({ shop, product }) {
  const { min } = feeRange(shop);
  const { currency, freeShippingThreshold, shopPhone } = shop;
  const rows = [
    { icon: Banknote, title: "Paiement à la livraison", sub: "Vous payez à la réception du colis" },
    {
      icon: Truck,
      title: `Livraison à Libreville dès ${formatPrice(min, currency)}`,
      sub:
        freeShippingThreshold > 0
          ? `Offerte dès ${formatPrice(freeShippingThreshold, currency)} d'achat · retrait en boutique gratuit`
          : "Retrait en boutique gratuit",
    },
    { icon: MapPin, title: "Suivi en temps réel", sub: "Suivez votre livreur sur la carte" },
  ];
  return (
    <div className="card divide-y divide-gray-100 dark:divide-slate-700">
      {rows.map((r) => (
        <div key={r.title} className="flex items-center gap-3 p-3">
          <r.icon size={20} className="shrink-0 text-brand-600 dark:text-brand-400" />
          <span>
            <b className="block text-sm">{r.title}</b>
            <small className="text-xs muted">{r.sub}</small>
          </span>
        </div>
      ))}
      {shopPhone && (
        <a
          href={whatsappUrl(shopPhone, `Bonjour, j'ai une question sur « ${product.name} »`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 text-sm font-semibold text-green-700 transition hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
        >
          <WhatsAppIcon size={20} />
          Une question sur ce produit ? Écrivez-nous
        </a>
      )}
    </div>
  );
}
