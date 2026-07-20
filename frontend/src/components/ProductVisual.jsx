export default function ProductVisual({ product, size = "text-4xl", className = "" }) {
  if (product.image_url) {
    return (
      <img
        src={product.image_url}
        alt={product.name}
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
