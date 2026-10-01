import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Check, EyeOff, ImagePlus, Send, X } from "lucide-react";
import { api } from "../../api";
import CropFileInput from "../../components/CropFileInput";
import PostCard from "../../components/PostCard";
import ProductVisual from "../../components/ProductVisual";

const MAX_IMAGES = 6;

// Publications du vendeur : écrire (texte, photos, produits liés) et gérer les siennes
export default function SellerPosts() {
  const { shop } = useOutletContext();
  const [posts, setPosts] = useState(null);
  const [products, setProducts] = useState([]);
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.get("/my/posts").then(setPosts).catch(() => setPosts([]));

  useEffect(() => {
    load();
    api
      .get("/my/products")
      .then((list) => setProducts(list.filter((p) => p.active)))
      .catch(() => {});
  }, []);

  // Photos déjà recadrées (carrées, comme dans les publications) par CropFileInput
  const addPhotos = async (files) => {
    setUploading(true);
    setError("");
    try {
      for (const file of files) {
        const res = await api.upload("/me/upload", file);
        setImages((list) => [...list, res.url]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleProduct = (id) =>
    setProductIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const publish = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/my/posts", { text, images, product_ids: productIds });
      setText("");
      setImages([]);
      setProductIds([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (post) => {
    if (!window.confirm("Supprimer cette publication ?")) return;
    await api.del(`/my/posts/${post.id}`);
    load();
  };

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <form onSubmit={publish} className="card flex flex-col gap-3 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Quoi de neuf ? Arrivage, promo, nouvelle collection…"
          className="input"
        />

        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {images.map((src) => (
              <div key={src} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((list) => list.filter((x) => x !== src))}
                  aria-label="Retirer la photo"
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {products.length > 0 && (
          <div>
            <p className="label">Produits à mettre en avant (touchez pour choisir)</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {products.map((p) => {
                const selected = productIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    aria-pressed={selected}
                    className={`relative w-20 shrink-0 overflow-hidden rounded-lg border-2 text-left transition ${
                      selected ? "border-brand-600" : "border-transparent"
                    }`}
                  >
                    <div className="aspect-square">
                      <ProductVisual product={p} width={160} />
                    </div>
                    <p className="truncate p-1 text-[11px] font-medium">{p.name}</p>
                    {selected && (
                      <span className="absolute top-1 right-1 rounded-full bg-brand-600 p-0.5 text-white">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

        <div className="flex items-center gap-2">
          <label
            className={`btn-outline inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm ${
              images.length >= MAX_IMAGES ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <ImagePlus size={16} />
            {uploading ? "Envoi…" : "Photos"}
            <CropFileInput
              multiple
              limit={MAX_IMAGES - images.length}
              disabled={uploading || images.length >= MAX_IMAGES}
              onCropped={addPhotos}
            />
          </label>
          <span className="flex-1 text-xs muted">{images.length}/{MAX_IMAGES}</span>
          <button type="submit" disabled={busy || uploading} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2">
            <Send size={15} /> Publier
          </button>
        </div>
        {shop.status !== "active" && (
          <p className="text-xs muted">Vos publications seront visibles dès que votre boutique sera validée.</p>
        )}
      </form>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Mes publications</h2>
        <p className="-mt-3 text-xs muted">
          Elles s'affichent sur la page de votre boutique (onglet « Publications »). Vos nouveaux
          produits et vos articles en liquidation, eux, remontent tout seuls en tête de l'Explorer.
        </p>
        {posts === null ? (
          <div className="skeleton h-40" />
        ) : posts.length === 0 ? (
          <p className="card p-6 text-center text-sm muted">Aucune publication pour l'instant.</p>
        ) : (
          posts.map((p) => (
            <div key={p.id}>
              {p.hidden && (
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                  <EyeOff size={13} /> Masquée par l'équipe de la plateforme
                </p>
              )}
              <PostCard post={p} onDelete={() => remove(p)} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
