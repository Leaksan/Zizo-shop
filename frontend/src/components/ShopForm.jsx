import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { api } from "../api";
import { useShop } from "../context/ShopContext";
import LocationPicker from "./LocationPicker";
import ZoneOptions from "./ZoneOptions";
import CropFileInput from "./CropFileInput";
import ShopAvatar from "./ShopAvatar";

// Informations d'une boutique : création (« Ouvrir ma boutique ») et modification (espace vendeur).
// onPhotoChange(champ, url) : en modification, la photo est enregistrée dès qu'elle est choisie.
export default function ShopForm({ initial, submitLabel, onSubmit, onPhotoChange }) {
  const { zones } = useShop();
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    whatsapp: initial?.whatsapp || "",
    zone: initial?.zone || "",
    address: initial?.address || "",
    logo_url: initial?.logo_url || "",
    cover_url: initial?.cover_url || "",
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [photoSaved, setPhotoSaved] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // Photo déjà recadrée par CropFileInput
  const upload = (key) => async ([file]) => {
    setUploading(key);
    setError("");
    setPhotoSaved(false);
    try {
      const res = await api.upload(`/me/upload${key === "cover_url" ? "?kind=cover" : ""}`, file);
      setForm((f) => ({ ...f, [key]: res.url }));
      if (onPhotoChange) {
        await onPhotoChange(key, res.url);
        setPhotoSaved(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading("");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Couverture + logo, comme ils apparaîtront sur la page de la boutique */}
      <div className="card overflow-hidden">
        <label className="relative block h-32 cursor-pointer bg-gradient-to-br from-brand-100 to-accent-100 dark:from-slate-700 dark:to-slate-600">
          {form.cover_url && <img src={form.cover_url} alt="" className="h-full w-full object-cover" />}
          <span className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow dark:bg-slate-800/90 dark:text-slate-200">
            <ImagePlus size={14} />
            {uploading === "cover_url" ? "Envoi…" : "Photo de couverture"}
          </span>
          <CropFileInput aspect={3} maxWidth={1600} onCropped={upload("cover_url")} />
        </label>
        <div className="flex items-center gap-3 px-4 pb-4">
          <label className="relative -mt-8 cursor-pointer rounded-full ring-4 ring-white dark:ring-slate-800">
            <ShopAvatar shop={{ name: form.name, logo_url: form.logo_url }} className="h-16 w-16 text-2xl" />
            <span className="absolute -right-1 -bottom-1 rounded-full bg-brand-600 p-1.5 text-white shadow">
              <ImagePlus size={12} />
            </span>
            <CropFileInput aspect={1} round maxWidth={600} onCropped={upload("logo_url")} />
          </label>
          <p className="pt-2 text-xs muted">
            {uploading
              ? "Envoi de la photo…"
              : photoSaved
                ? "Photo enregistrée."
                : onPhotoChange
                  ? "Touchez une image pour la changer : elle est enregistrée tout de suite."
                  : "Touchez les images pour ajouter votre logo et une couverture."}
          </p>
        </div>
      </div>

      <label className="block">
        <span className="label">Nom de la boutique *</span>
        <input value={form.name} onChange={set("name")} required maxLength={80} className="input" placeholder="Ex. Chez Awa Pagnes" />
      </label>
      <label className="block">
        <span className="label">Présentation</span>
        <textarea
          value={form.description}
          onChange={set("description")}
          rows={3}
          maxLength={1500}
          className="input"
          placeholder="Ce que vous vendez, vos points forts, vos horaires…"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">WhatsApp de la boutique</span>
          <input type="tel" inputMode="tel" value={form.whatsapp} onChange={set("whatsapp")} className="input" placeholder="Votre numéro par défaut" />
        </label>
        <label className="block">
          <span className="label">Quartier</span>
          <select value={form.zone} onChange={set("zone")} className="input">
            <option value="">Choisir…</option>
            <ZoneOptions zones={zones} />
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Adresse de retrait</span>
        <input
          value={form.address}
          onChange={set("address")}
          className="input"
          placeholder="Où le livreur récupère vos colis (ex. Marché Mont-Bouët, allée 3)"
        />
        <span className="mt-1 block text-xs muted">
          Communiquée aux livreurs, et aux clients qui choisissent le retrait en boutique.
        </span>
      </label>
      <div>
        <span className="label">Position de la boutique (conseillé)</span>
        <LocationPicker
          value={form.latitude != null ? { latitude: form.latitude, longitude: form.longitude } : null}
          onChange={(pos) =>
            setForm((f) => ({ ...f, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null }))
          }
          label="Utiliser ma position (je suis à la boutique)"
          hint="Les livreurs et vos clients l'ouvrent dans Google Maps pour venir jusqu'à vous."
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={busy || Boolean(uploading)} className="btn-primary py-3 text-base">
        {busy ? "…" : submitLabel}
      </button>
    </form>
  );
}
