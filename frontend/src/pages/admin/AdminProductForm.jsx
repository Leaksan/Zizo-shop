import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Flame, FolderOpen, ImagePlus, X } from "lucide-react";
import { api } from "../../api";
import CropFileInput from "../../components/CropFileInput";

const emptyVariant = () => ({ name: "", price: "", old_price: "", stock: 0, sku: "" });
const BADGES = ["", "Promo", "Nouveau", "Top vente"];

// Même formulaire pour l'admin (tous les produits) et pour un vendeur (sa boutique).
// Un vendeur ne crée pas de rayon (liste commune) et ne saisit pas de note ni d'avis.
const MODES = {
  admin: {
    api: "/admin/products",
    categories: "/admin/categories",
    upload: "/admin/upload",
    back: "/admin/products",
    demoFields: true,
    newCategory: true,
  },
  vendeur: {
    api: "/my/products",
    categories: "/categories",
    upload: "/me/upload",
    back: "/vendeur/produits",
    demoFields: false,
    newCategory: false,
  },
};

export default function AdminProductForm({ mode = "admin" }) {
  const cfg = MODES[mode];
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    image_url: "",
    badge: "",
    rating: "",
    reviews_count: 0,
    category_id: "",
    clearance: false,
    active: true,
  });
  const [variants, setVariants] = useState([emptyVariant()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Photo déjà recadrée au carré par CropFileInput
  const handleFile = async ([file]) => {
    setUploading(true);
    setError("");
    try {
      const res = await api.upload(cfg.upload, file);
      setForm((f) => ({ ...f, image_url: res.url }));
    } catch (e2) {
      setError(e2.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    api.get(cfg.categories).then(setCategories).catch(() => {});
    if (isEdit) {
      api
        .get(cfg.api)
        .then((products) => {
          const p = products.find((x) => x.id === Number(id));
          if (!p) throw new Error("Produit introuvable");
          setForm({
            name: p.name,
            description: p.description,
            image_url: p.image_url,
            badge: p.badge,
            rating: p.rating || "",
            reviews_count: p.reviews_count,
            category_id: p.category_id || "",
            clearance: p.clearance,
            active: p.active,
          });
          setVariants(
            p.variants.length
              ? p.variants.map((v) => ({
                  ...v,
                  price: String(v.price),
                  old_price: v.old_price ? String(v.old_price) : "",
                }))
              : [emptyVariant()]
          );
        })
        .catch((e) => setError(e.message));
    }
  }, [id, isEdit, cfg.api, cfg.categories]);

  const setVariant = (index, key, value) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [key]: value } : v)));
  };

  const handleCategoryChange = async (e) => {
    const value = e.target.value;
    if (value !== "__new" || !cfg.newCategory) {
      setForm({ ...form, category_id: value });
      return;
    }
    const name = window.prompt("Nom de la nouvelle catégorie :");
    if (!name?.trim()) return;
    try {
      const cat = await api.post("/admin/categories", { name: name.trim() });
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ ...form, category_id: cat.id });
    } catch (e2) {
      setError(e2.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const cleaned = variants.filter((v) => v.name.trim());
    if (cleaned.length === 0) {
      setError("Ajoutez au moins une variante.");
      return;
    }
    for (const v of cleaned) {
      const price = parseFloat(v.price);
      if (Number.isNaN(price) || price < 0) {
        setError(`Prix invalide pour la variante « ${v.name} ».`);
        return;
      }
      if (v.old_price !== "" && (Number.isNaN(parseFloat(v.old_price)) || parseFloat(v.old_price) <= 0)) {
        setError(`Ancien prix invalide pour la variante « ${v.name} ».`);
        return;
      }
    }
    const { rating, reviews_count, ...fields } = form;
    const payload = {
      ...fields,
      ...(cfg.demoFields
        ? { rating: rating === "" ? 0 : parseFloat(rating), reviews_count: parseInt(reviews_count, 10) || 0 }
        : {}),
      category_id: form.category_id ? Number(form.category_id) : null,
      variants: cleaned.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name.trim(),
        price: parseFloat(v.price),
        old_price: v.old_price === "" ? null : parseFloat(v.old_price),
        stock: parseInt(v.stock, 10) || 0,
        sku: v.sku || "",
      })),
    };
    setSaving(true);
    try {
      if (isEdit) await api.put(`${cfg.api}/${id}`, payload);
      else await api.post(cfg.api, payload);
      navigate(cfg.back);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">
        {isEdit ? "Modifier le produit" : "Nouveau produit"}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="card flex flex-col gap-4 p-6">
          <label className="block">
            <span className="label">Nom *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
            />
          </label>
          <div>
            <span className="label">Image du produit</span>
            <div className="flex items-start gap-4">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-slate-600 dark:bg-slate-700">
                {form.image_url ? (
                  <img src={form.image_url} alt="Aperçu" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus size={36} strokeWidth={1.5} className="text-gray-300 dark:text-slate-500" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label className="btn-outline inline-flex w-fit cursor-pointer items-center gap-2 px-4 py-2 text-sm">
                  {!uploading && <FolderOpen size={16} />}
                  {uploading ? "Envoi en cours…" : "Choisir une image"}
                  <CropFileInput aspect={1} disabled={uploading} onCropped={handleFile} />
                </label>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="…ou collez une URL d'image"
                  className="input"
                />
                <p className="text-xs muted">
                  Vous recadrez la photo au carré avant l'envoi : c'est ainsi qu'elle s'affiche sur
                  les cartes produit. Elle est aussi allégée (900 px max).
                </p>
              </div>
            </div>
          </div>
          <div className={`grid gap-4 ${cfg.demoFields ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
            <label className="block">
              <span className="label">Catégorie</span>
              <select
                value={form.category_id}
                onChange={handleCategoryChange}
                className="input"
              >
                <option value="">— Aucune —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {cfg.newCategory && <option value="__new">+ Nouvelle catégorie…</option>}
              </select>
            </label>
            <label className="block">
              <span className="label">Badge</span>
              <select
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                className="input"
              >
                {BADGES.map((b) => (
                  <option key={b} value={b}>
                    {b || "— Aucun —"}
                  </option>
                ))}
              </select>
            </label>
            {cfg.demoFields && (
              <>
                <label className="block">
                  <span className="label">Note (0-5)</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="label">Nb d'avis</span>
                  <input
                    type="number"
                    min="0"
                    value={form.reviews_count}
                    onChange={(e) => setForm({ ...form, reviews_count: e.target.value })}
                    className="input"
                  />
                </label>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 accent-brand-600"
              />
              Produit visible dans la boutique
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-accent-700 dark:text-accent-400">
              <input
                type="checkbox"
                checked={form.clearance}
                onChange={(e) => setForm({ ...form, clearance: e.target.checked })}
                className="h-4 w-4 accent-accent-500"
              />
              <Flame size={15} />
              Liquidation (petit prix, à écouler)
            </label>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Variantes (prix et stock par variante)</h2>
            <button
              type="button"
              onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
              className="btn-outline"
            >
              + Ajouter une variante
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="hidden grid-cols-[2fr_1fr_1fr_0.8fr_1fr_auto] gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 lg:grid">
              <span>Nom (ex. Rouge / M, 500 g…)</span>
              <span>Prix *</span>
              <span>Ancien prix</span>
              <span>Stock</span>
              <span>Réf. (SKU)</span>
              <span />
            </div>
            {variants.map((v, i) => (
              <div
                key={i}
                className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 p-3 lg:grid-cols-[2fr_1fr_1fr_0.8fr_1fr_auto] lg:rounded-none lg:border-0 lg:p-0 dark:border-slate-700"
              >
                <input
                  required
                  placeholder="Nom (Standard)"
                  value={v.name}
                  onChange={(e) => setVariant(i, "name", e.target.value)}
                  className="input col-span-2 lg:col-span-1"
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Prix *"
                  value={v.price}
                  onChange={(e) => setVariant(i, "price", e.target.value)}
                  className="input"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ancien prix"
                  value={v.old_price}
                  onChange={(e) => setVariant(i, "old_price", e.target.value)}
                  className="input"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Stock"
                  value={v.stock}
                  onChange={(e) => setVariant(i, "stock", e.target.value)}
                  className="input"
                />
                <input
                  placeholder="SKU"
                  value={v.sku}
                  onChange={(e) => setVariant(i, "sku", e.target.value)}
                  className="input"
                />
                <button
                  type="button"
                  disabled={variants.length === 1}
                  onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}
                  className="btn-danger col-span-2 inline-flex items-center justify-center gap-1 disabled:opacity-30 lg:col-span-1"
                  title="Retirer"
                >
                  <X size={14} />
                  Retirer
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5">
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le produit"}
          </button>
          <button
            type="button"
            onClick={() => navigate(cfg.back)}
            className="btn-outline px-6 py-2.5 text-sm"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
