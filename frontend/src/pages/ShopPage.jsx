import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, Check, Eye, MapPin, Plus, Share2, Store } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useShop } from "../context/ShopContext";
import PostCard from "../components/PostCard";
import ProductCard from "../components/ProductCard";
import ShopAvatar from "../components/ShopAvatar";
import { SHOP_STATUS } from "../shopStatus";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";

export default function ShopPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { shopName } = useShop();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("produits");
  const [posts, setPosts] = useState(null);

  // Publications chargées à la première ouverture de l'onglet
  useEffect(() => {
    if (tab !== "publications" || posts !== null) return;
    api
      .get(`/shops/${slug}/posts`)
      .then((r) => setPosts(r.posts))
      .catch(() => setPosts([]));
  }, [tab, posts, slug]);

  // Autre boutique (lien depuis une publication) : repartir de l'onglet Produits
  useEffect(() => {
    setTab("produits");
    setPosts(null);
  }, [slug]);

  useEffect(() => {
    setShop(null);
    setProducts(null);
    setNotFound(false);
    api
      .get(`/shops/${slug}`)
      .then((s) => {
        setShop(s);
        // Aperçu du vendeur avant validation : ses produits ne sont pas encore publics
        const source = s.is_owner && s.status ? api.get("/my/products") : api.get(`/products?shop=${slug}`);
        return source.then((list) => setProducts(list.filter((p) => p.active)));
      })
      .catch(() => setNotFound(true));
  }, [slug, user?.id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Store size={44} className="mx-auto text-gray-300 dark:text-slate-600" strokeWidth={1.3} />
        <h1 className="mt-4 text-xl font-bold">Boutique introuvable</h1>
        <p className="mt-2 text-sm muted">Elle n'existe pas ou n'est plus en ligne.</p>
        <Link to="/boutiques" className="btn-primary mt-6 inline-block px-6 py-2.5">
          Voir les boutiques
        </Link>
      </div>
    );
  }
  if (!shop) return <div className="skeleton h-72" />;

  const toggleFollow = async () => {
    if (!user) {
      navigate(`/compte?suite=/b/${slug}`);
      return;
    }
    setBusy(true);
    try {
      const r = shop.is_following
        ? await api.del(`/shops/${slug}/follow`)
        : await api.post(`/shops/${slug}/follow`);
      setShop({ ...shop, is_following: r.following, followers_count: r.followers_count });
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: shop.name, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // copie impossible : rien à faire
    }
  };

  return (
    <div className="-mx-4 -mt-8">
      {/* Couverture */}
      <div className="h-36 bg-gradient-to-br from-brand-200 via-brand-100 to-accent-100 sm:h-56 dark:from-brand-950 dark:via-slate-800 dark:to-slate-900">
        {shop.cover_url && <img src={shop.cover_url} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="mx-auto max-w-5xl px-4">
        {shop.status && shop.status !== "active" && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-accent-50 p-3 text-sm text-accent-900 dark:bg-accent-950/50 dark:text-accent-200">
            <Eye size={16} className="shrink-0" />
            Aperçu : votre boutique n'est pas encore visible par le public ({SHOP_STATUS[shop.status]?.label.toLowerCase()}).
          </p>
        )}

        <div className="flex items-end gap-3">
          <ShopAvatar
            shop={shop}
            className="-mt-10 h-20 w-20 text-3xl ring-4 ring-gray-50 sm:-mt-12 sm:h-24 sm:w-24 dark:ring-slate-900"
          />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="flex items-center gap-1.5 text-xl font-extrabold sm:text-2xl">
              <span className="truncate">{shop.name}</span>
              {shop.official && (
                <BadgeCheck size={20} className="shrink-0 text-brand-600 dark:text-brand-400" aria-label="Boutique officielle" />
              )}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 text-sm muted">
              {shop.zone && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {shop.zone}
                </span>
              )}
              <span>
                <b className="text-gray-900 dark:text-white">{shop.followers_count}</b> abonné
                {shop.followers_count > 1 ? "s" : ""}
              </span>
              <span>
                <b className="text-gray-900 dark:text-white">{shop.products_count}</b> produit
                {shop.products_count > 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {shop.is_owner ? (
            <Link to="/vendeur" className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2.5 sm:flex-none sm:px-6">
              Gérer ma boutique
            </Link>
          ) : (
            <button
              onClick={toggleFollow}
              disabled={busy || (shop.status && shop.status !== "active")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition sm:flex-none sm:px-6 ${
                shop.is_following
                  ? "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {shop.is_following ? <Check size={16} /> : <Plus size={16} />}
              {shop.is_following ? "Abonné" : "Suivre"}
            </button>
          )}
          {shop.whatsapp && (
            <a
              href={whatsappUrl(shop.whatsapp, `Bonjour ${shop.name}, je vous contacte depuis ${shopName}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1faa53]"
              aria-label="Écrire à la boutique sur WhatsApp"
            >
              <WhatsAppIcon size={17} />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}
          <button
            onClick={share}
            className="flex items-center justify-center rounded-lg border border-gray-300 px-3 text-gray-600 transition hover:bg-gray-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Partager la boutique"
            title={copied ? "Lien copié" : "Partager"}
          >
            {copied ? <Check size={17} /> : <Share2 size={17} />}
          </button>
        </div>

        {shop.description && (
          <p className="mt-4 text-sm whitespace-pre-line text-gray-700 dark:text-slate-300">{shop.description}</p>
        )}

        <div className="mt-6 flex border-b border-gray-200 dark:border-slate-700" role="tablist">
          {[
            ["produits", `Produits (${shop.products_count})`],
            ["publications", "Publications"],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === key
                  ? "border-brand-600 text-brand-700 dark:text-brand-300"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "publications" ? (
          <section className="mx-auto mt-4 mb-8 flex max-w-xl flex-col gap-4">
            {posts === null ? (
              <div className="skeleton h-72" />
            ) : posts.length === 0 ? (
              <p className="card p-6 text-center text-sm muted">
                {shop.is_owner ? "Publiez depuis votre espace vendeur : arrivages, promos, nouveautés…" : "Aucune publication pour le moment."}
              </p>
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} onFollow={() => setShop((s) => ({ ...s, is_following: true }))} />)
            )}
          </section>
        ) : (
        <section className="mt-4 mb-8">
          {products === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton aspect-[3/4]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="card p-6 text-center text-sm muted">
              {shop.is_owner ? "Ajoutez vos premiers produits depuis votre espace vendeur." : "Aucun produit pour le moment."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
