import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut } from "lucide-react";

const MAX_ZOOM = 4;

/**
 * Champ « choisir une photo » (caché : on le place dans un <label> cliquable) qui fait d'abord
 * recadrer chaque photo, puis rend des fichiers JPEG déjà à la bonne taille via onCropped(files).
 * aspect : largeur / hauteur du cadre (1 = carré) · round : aperçu rond (logo) ·
 * maxWidth : largeur maximale envoyée (le serveur réduit de toute façon à 900 px, 1600 pour
 * une couverture) · multiple / limit : plusieurs photos recadrées l'une après l'autre.
 */
export default function CropFileInput({
  aspect = 1,
  round = false,
  maxWidth = 900,
  multiple = false,
  limit = 10,
  disabled = false,
  onCropped,
}) {
  const [queue, setQueue] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);

  const pick = (e) => {
    const files = [...(e.target.files || [])]
      .filter((f) => !f.type || f.type.startsWith("image/"))
      .slice(0, multiple ? limit : 1);
    e.target.value = ""; // pouvoir rechoisir la même photo
    if (!files.length) return;
    setResults([]);
    setTotal(files.length);
    setQueue(files);
  };

  // Photo validée (fichier) ou ignorée (null) : on passe à la suivante
  const next = (file) => {
    const done = file ? [...results, file] : results;
    const rest = queue.slice(1);
    setQueue(rest);
    setResults(rest.length ? done : []);
    if (!rest.length && done.length) onCropped(done);
  };

  return (
    <>
      <input type="file" accept="image/*" multiple={multiple} disabled={disabled} onChange={pick} className="hidden" />
      {queue.length > 0 &&
        createPortal(
          <CropDialog
            key={queue.length}
            file={queue[0]}
            aspect={aspect}
            round={round}
            maxWidth={maxWidth}
            counter={total > 1 ? `${total - queue.length + 1}/${total}` : ""}
            onDone={next}
            onCancel={() => next(null)}
          />,
          document.body
        )}
    </>
  );
}

// Taille du cadre : la largeur du téléphone (marges comprises), 420 px au plus, et assez bas
// pour laisser la place au curseur et aux boutons sur un écran couché
function frameWidth(aspect) {
  return Math.max(200, Math.min(window.innerWidth - 32, 420, (window.innerHeight - 230) * aspect));
}

function CropDialog({ file, aspect, round, maxWidth, counter, onDone, onCancel }) {
  const [img, setImg] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [frameW, setFrameW] = useState(() => frameWidth(aspect));
  const frameH = frameW / aspect;
  // zoom 1 : la photo remplit le cadre ; en dessous, elle y tient entière (bords blancs)
  const [view, setViewState] = useState({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  // Fonction d'annulation du parent (recréée à chaque rendu) : lue au moment de l'Échap
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });

  const setView = (v) => {
    viewRef.current = v;
    setViewState(v);
  };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setError("Cette image ne peut pas être ouverte. Choisissez-en une autre.");
    image.src = url;
    return () => {
      // Chargement abandonné (fenêtre fermée) : ce n'est pas une image illisible
      image.onload = image.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Échap annule ; la page derrière ne défile pas ; le cadre suit la taille de l'écran
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && cancelRef.current();
    const onResize = () => setFrameW(frameWidth(aspect));
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = overflow;
    };
  }, [aspect]);

  const natW = img?.naturalWidth || 1;
  const natH = img?.naturalHeight || 1;
  const cover = Math.max(frameW / natW, frameH / natH);
  const minZoom = Math.min(frameW / natW, frameH / natH) / cover;
  const scale = cover * view.zoom;

  // La photo couvre le cadre, ou y reste entière quand on dézoome
  const clamp = (v) => {
    const zoom = Math.max(minZoom, Math.min(MAX_ZOOM, v.zoom));
    const s = cover * zoom;
    const maxX = Math.abs(natW * s - frameW) / 2;
    const maxY = Math.abs(natH * s - frameH) / 2;
    return { zoom, x: Math.max(-maxX, Math.min(maxX, v.x)), y: Math.max(-maxY, Math.min(maxY, v.y)) };
  };

  // Nouvelle taille de cadre (écran tourné) : rester dans les limites
  useEffect(() => {
    setView(clamp(viewRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameW, img]);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      return {
        type: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: viewRef.current,
      };
    }
    return pts.length ? { type: "pan", start: pts[0], view: viewRef.current } : null;
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = startGesture();
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (g?.type === "pinch" && pts.length >= 2) {
      const [a, b] = pts;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setView(
        clamp({
          zoom: (g.view.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist,
          x: g.view.x + mid.x - g.mid.x,
          y: g.view.y + mid.y - g.mid.y,
        })
      );
    } else if (g?.type === "pan") {
      setView(clamp({ ...g.view, x: g.view.x + e.clientX - g.start.x, y: g.view.y + e.clientY - g.start.y }));
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    gesture.current = startGesture();
  };

  const zoomTo = (zoom) => setView(clamp({ ...viewRef.current, zoom }));

  const validate = () => {
    if (!img) return;
    setBusy(true);
    const v = viewRef.current;
    const s = cover * v.zoom;
    // Pas d'agrandissement au-delà des pixels de la photo, pas plus large que maxWidth
    const outW = Math.round(Math.min(maxWidth, frameW / s));
    const outH = Math.round(outW / aspect);
    const k = outW / frameW;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // fond blanc : bords d'une photo dézoomée, logos transparents
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = "high";
    const dw = natW * s * k;
    const dh = natH * s * k;
    ctx.drawImage(img, (frameW / 2 + v.x) * k - dw / 2, (frameH / 2 + v.y) * k - dh / 2, dw, dh);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Le recadrage a échoué. Réessayez avec une autre photo.");
          setBusy(false);
          return;
        }
        onDone(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-title"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-gray-950/95 p-4 text-white"
    >
      <div className="flex w-full items-center justify-between gap-2" style={{ maxWidth: frameW }}>
        <h2 id="crop-title" className="text-lg font-bold">
          Recadrer la photo {counter && <span className="text-sm font-medium text-white/70">({counter})</span>}
        </h2>
        <button type="button" onClick={onCancel} aria-label="Annuler" className="rounded-lg p-2 text-white/80 hover:bg-white/10">
          <X size={20} />
        </button>
      </div>

      <div
        className="relative cursor-grab touch-none overflow-hidden rounded-lg bg-white select-none active:cursor-grabbing"
        style={{ width: frameW, height: frameH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => zoomTo(viewRef.current.zoom * Math.exp(-e.deltaY * 0.0015))}
      >
        {img && (
          <img
            src={img.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            style={{
              width: natW,
              height: natH,
              transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${scale})`,
            }}
          />
        )}
        {round && (
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
        )}
        <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-white/80 ring-inset" />
        {!img && !error && <div className="skeleton absolute inset-0" />}
      </div>

      {error ? (
        <p className="max-w-sm rounded-lg bg-red-950/80 p-3 text-center text-sm text-red-100">{error}</p>
      ) : (
        <p className="text-center text-xs text-white/70">
          Glissez pour déplacer · pincez ou utilisez le curseur pour zoomer
        </p>
      )}

      <div className="flex w-full items-center gap-3" style={{ maxWidth: frameW }}>
        <button type="button" onClick={() => zoomTo(viewRef.current.zoom / 1.25)} aria-label="Dézoomer" className="rounded-lg p-1.5 hover:bg-white/10">
          <ZoomOut size={18} />
        </button>
        <input
          type="range"
          min={minZoom}
          max={MAX_ZOOM}
          step="0.01"
          value={view.zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          disabled={!img}
          aria-label="Zoom"
          className="flex-1 accent-brand-500"
        />
        <button type="button" onClick={() => zoomTo(viewRef.current.zoom * 1.25)} aria-label="Zoomer" className="rounded-lg p-1.5 hover:bg-white/10">
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="flex w-full gap-2" style={{ maxWidth: frameW }}>
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-white/40 py-2.5 text-sm font-semibold hover:bg-white/10">
          {counter ? "Ignorer" : "Annuler"}
        </button>
        <button type="button" onClick={validate} disabled={!img || busy} className="btn-primary flex-1 py-2.5">
          {busy ? "…" : "Valider"}
        </button>
      </div>
    </div>
  );
}
