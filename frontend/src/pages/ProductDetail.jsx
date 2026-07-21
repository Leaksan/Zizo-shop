import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BellRing, CheckCircle2, Flame, Heart, ShoppingCart, XCircle, Zap } from "lucide-react";
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
  const { currency } = useShop();
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
        <Link to="/boutique" className="mt-4 inline-block text-indigo-600 hover:underline">
          ← Retour à la boutique
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
    <div className="mx-auto max-w-5xl">
      <Link to="/boutique" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Retour à la boutique
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="card overflow-hidden">
          <ProductVisual product={product} size="text-8xl" className="aspect-square" />
        </div>

        <div className="flex flex-col gap-4">
          {product.category && (
            <span className="text-xs font-medium uppercase tracking-wide text-indigo-500">
              {product.category}
            </span>
          )}
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
              className={`w-fit rounded-full px-3 py-1 text-xs font-bold text-white ${
                product.badge === "Promo" ? "bg-red-600" : "bg-indigo-600"
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
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                        : disabled
                          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 line-through dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600"
                          : "border-gray-300 bg-white text-gray-700 hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
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
                          ? "text-orange-600 dark:text-orange-400"
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
                      className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-indigo-600 dark:text-slate-300"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-semibold">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                      className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-indigo-600 dark:text-slate-300"
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
                    <ShoppingCart size={17} />
                    {added ? "Ajouté au panier ✓" : "Ajouter au panier"}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/30 active:scale-95"
                  >
                    <Zap size={17} className="fill-white" />
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
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
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

          <ShareButtons product={product} />
        </div>
      </div>

      <ReviewsSection productId={product.id} />
    </div>
  );
}
