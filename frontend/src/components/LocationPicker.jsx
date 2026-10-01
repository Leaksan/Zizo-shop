import { useState } from "react";
import { Crosshair, ExternalLink, LoaderCircle, MapPin, X } from "lucide-react";
import { currentPosition, hasCoords, mapsUrl } from "../maps";

// Au-delà, la position est trop vague pour trouver une porte : on le dit
const VAGUE_METERS = 150;

/**
 * « Utiliser ma position actuelle » : le téléphone demande l'autorisation, puis la position GPS
 * est gardée (commande, boutique). On peut la vérifier dans Google Maps ou la retirer.
 * value : { latitude, longitude, accuracy } ou null · onChange(position | null)
 */
export default function LocationPicker({ value, onChange, hint, label = "Utiliser ma position actuelle" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const locate = async () => {
    setBusy(true);
    setError("");
    try {
      onChange(await currentPosition());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (hasCoords(value)) {
    const vague = value.accuracy > VAGUE_METERS;
    return (
      <div
        className={`flex flex-col gap-1.5 rounded-lg p-3 text-sm ${
          vague
            ? "bg-accent-50 text-accent-900 dark:bg-accent-950 dark:text-accent-200"
            : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
        }`}
      >
        <p className="flex items-center gap-2 font-semibold">
          <MapPin size={16} className="shrink-0" />
          Position enregistrée{value.accuracy ? ` (à ${value.accuracy} m près)` : ""}
        </p>
        {vague && (
          <p className="text-xs">Position approximative : ajoutez bien un point de repère, ou réessayez dehors.</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a
            href={mapsUrl(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-semibold underline"
          >
            Vérifier sur Google Maps <ExternalLink size={13} />
          </a>
          <button type="button" onClick={locate} disabled={busy} className="text-xs font-semibold underline opacity-80">
            {busy ? "…" : "Reprendre ma position"}
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-xs font-semibold opacity-80 hover:opacity-100"
          >
            <X size={13} /> Retirer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="btn-outline flex w-full items-center justify-center gap-2 py-2.5 sm:w-auto sm:px-4"
      >
        {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Crosshair size={17} />}
        {busy ? "Recherche de votre position…" : label}
      </button>
      {error ? (
        <p className="mt-1.5 rounded-lg bg-accent-50 p-2 text-xs text-accent-900 dark:bg-accent-950 dark:text-accent-200">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs muted">{hint}</p>
      )}
    </div>
  );
}
