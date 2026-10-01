import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "../api";
import CropFileInput from "./CropFileInput";

/**
 * Le vendeur change le logo ou la couverture de sa boutique en un geste : il touche la photo,
 * la recadre, et c'est enregistré tout de suite (pas besoin du formulaire « Ma boutique »).
 * kind : "logo" ou "cover" · onSaved(boutique mise à jour) · les enfants sont la photo affichée.
 */
export default function ShopPhotoButton({ kind, onSaved, className = "", children }) {
  const [busy, setBusy] = useState(false);
  const cover = kind === "cover";

  const save = async ([file]) => {
    setBusy(true);
    try {
      const { url } = await api.upload(`/me/upload${cover ? "?kind=cover" : ""}`, file);
      const shop = await api.put("/my/shop", { [cover ? "cover_url" : "logo_url"]: url });
      onSaved?.(shop);
    } catch (err) {
      window.alert(`La photo n'a pas pu être changée : ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label
      className={`cursor-pointer ${className}`}
      title={cover ? "Changer la photo de couverture" : "Changer le logo"}
      aria-label={cover ? "Changer la photo de couverture" : "Changer le logo"}
    >
      {children}
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/40 text-white">
          <LoaderCircle size={24} className="animate-spin" />
        </span>
      )}
      <CropFileInput
        aspect={cover ? 3 : 1}
        round={!cover}
        maxWidth={cover ? 1600 : 600}
        disabled={busy}
        onCropped={save}
      />
    </label>
  );
}
