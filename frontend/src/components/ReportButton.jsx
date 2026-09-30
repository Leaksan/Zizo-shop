import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Flag, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

// Mêmes motifs que le serveur (REPORT_REASONS dans models.py)
const REASONS = [
  ["arnaque", "Arnaque ou fraude"],
  ["contrefacon", "Contrefaçon"],
  ["inapproprie", "Contenu choquant ou inapproprié"],
  ["trompeur", "Prix ou description trompeurs"],
  ["autre", "Autre raison"],
];

// « Signaler » une publication ou une boutique : il faut un compte (limite les abus)
export default function ReportButton({ target, targetId, className = "", withLabel = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);

  const start = () => {
    if (!user) {
      navigate(`/compte?suite=${encodeURIComponent(pathname + search)}`);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button type="button" onClick={start} className={className} aria-label="Signaler" title="Signaler">
        <Flag size={16} />
        {withLabel && <span>Signaler</span>}
      </button>
      {open &&
        createPortal(
          <ReportDialog target={target} targetId={targetId} onClose={() => setOpen(false)} />,
          document.body
        )}
    </>
  );
}

function ReportDialog({ target, targetId, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Échap ferme la fenêtre ; la page derrière ne défile pas
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/reports", { target, target_id: targetId, reason, details });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl dark:bg-slate-800"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="report-title" className="flex items-center gap-2 text-lg font-bold">
            <Flag size={18} className="text-gray-500 dark:text-slate-400" />
            Signaler {target === "post" ? "cette publication" : "cette boutique"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="py-3 text-center">
            <CheckCircle2 size={40} className="mx-auto text-green-600" />
            <p className="mt-2 font-semibold">Merci, c'est noté.</p>
            <p className="mt-1 text-sm muted">
              Notre équipe va vérifier. Le vendeur ne sait pas qui a fait le signalement.
            </p>
            <button onClick={onClose} className="btn-primary mt-4 w-full py-2.5">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <p className="mb-1 text-sm muted">Que se passe-t-il ?</p>
            {REASONS.map(([value, label]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                  reason === value
                    ? "border-brand-600 bg-brand-50 dark:bg-brand-950"
                    : "border-gray-200 dark:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="accent-brand-600"
                />
                {label}
              </label>
            ))}
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              maxLength={500}
              className="input mt-1"
              placeholder="Précisions (facultatif)"
            />
            {error && (
              <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
            )}
            <button type="submit" disabled={!reason || busy} className="btn-primary mt-1 py-2.5">
              {busy ? "Envoi…" : "Envoyer le signalement"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
