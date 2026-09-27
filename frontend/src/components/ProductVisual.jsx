// Largeurs de miniatures fournies par le serveur (backend/app.py, serve_thumb)
const THUMB_WIDTHS = [160, 320, 640];

// URL d'une version réduite de l'image, pour ne pas télécharger 900 px pour une vignette.
function sizedUrl(url, width) {
  const w = THUMB_WIDTHS.find((t) => t >= width) || THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
  const upload = url.match(/^\/uploads\/([^/]+)$/);
  if (upload) return `/uploads/thumb/${w}/${upload[1]}`;
  if (url.startsWith("https://images.unsplash.com/")) {
    const u = new URL(url);
    u.searchParams.set("w", String(w));
    return u.toString();
  }
  return url;
}

// width : largeur d'affichage approximative (px CSS). Sans width, image d'origine.
export default function ProductVisual({ product, size = "text-4xl", className = "", width }) {
  if (product.image_url) {
    const src = width ? sizedUrl(product.image_url, width) : product.image_url;
    const src2x = width ? sizedUrl(product.image_url, width * 2) : null;
    return (
      <img
        src={src}
        srcSet={src2x && src2x !== src ? `${src} 1x, ${src2x} 2x` : undefined}
        alt={product.name}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-slate-700 dark:to-slate-600 ${className}`}
    >
      <span className={size}>{product.emoji || product.name.charAt(0)}</span>
    </div>
  );
}
