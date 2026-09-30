import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { api } from "../api";
import { normalize } from "../libreville";
import { useShop } from "../context/ShopContext";
import AddressInput from "./AddressInput";
import ShopAvatar from "./ShopAvatar";

// Informations d'une boutique : création (« Ouvrir ma boutique ») et modification (espace vendeur)
export default function ShopForm({ initial, submitLabel, onSubmit }) {
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
  // Lieu choisi dans les suggestions : sa position GPS guide le livreur (carte). Elle reste
  // valable tant que l'adresse commence par ce lieu (ex. « Glass, immeuble bleu »).
  const [picked, setPicked] = useState(initial?.latitude != null ? initial.address || "" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const upload = (key) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(key);
    setError("");
    try {
      const res = await api.upload(`/me/upload${key === "cover_url" ? "?kind=cover" : ""}`, file);
      setForm((f) => ({ ...f, [key]: res.url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading("");
      e.target.value = "";
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
          <input type="file" accept="image/*" onChange={upload("cover_url")} className="hidden" />
        </label>
        <div className="flex items-center gap-3 px-4 pb-4">
          <label className="relative -mt-8 cursor-pointer rounded-full ring-4 ring-white dark:ring-slate-800">
            <ShopAvatar shop={{ name: form.name, logo_url: form.logo_url }} className="h-16 w-16 text-2xl" />
            <span className="absolute -right-1 -bottom-1 rounded-full bg-brand-600 p-1.5 text-white shadow">
              <ImagePlus size={12} />
            </span>
            <input type="file" accept="image/*" onChange={upload("logo_url")} className="hidden" />
          </label>
          <p className="pt-2 text-xs muted">
            {uploading === "logo_url" ? "Envoi du logo…" : "Touchez les images pour ajouter votre logo et une couverture."}
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
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Adresse de retrait</span>
        <AddressInput
          value={form.address}
          required={false}
          placeholder="Où le livreur récupère vos colis (ex. Marché Mont-Bouët, allée 3)"
          onChange={(value) => {
            const keep = picked && value.startsWith(picked);
            setForm((f) => ({ ...f, address: value, ...(keep ? {} : { latitude: null, longitude: null }) }));
            if (!keep) setPicked("");
          }}
          onPick={(place) => {
            setPicked(place.name);
            setForm((f) => ({
              ...f,
              address: place.name,
              latitude: place.lat,
              longitude: place.lng,
              zone: (place.zone && zones.find((z) => normalize(z) === normalize(place.zone).trim())) || f.zone,
            }));
          }}
        />
        <span className="mt-1 block text-xs muted">
          Communiquée aux livreurs, et aux clients qui choisissent le retrait en boutique.
        </span>
      </label>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={busy || Boolean(uploading)} className="btn-primary py-3 text-base">
        {busy ? "…" : submitLabel}
      </button>
    </form>
  );
}
