import { Star, StarHalf } from "lucide-react";

export default function Rating({ value = 0, count, size = 14, className = "" }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full)
          return (
            <Star key={i} size={size} className="fill-amber-400 text-amber-400" strokeWidth={1.5} />
          );
        if (i === full && half)
          return (
            <span key={i} className="relative inline-flex">
              <Star size={size} className="text-amber-400" strokeWidth={1.5} />
              <StarHalf
                size={size}
                className="absolute inset-0 fill-amber-400 text-amber-400"
                strokeWidth={1.5}
              />
            </span>
          );
        return <Star key={i} size={size} className="text-gray-300 dark:text-slate-600" strokeWidth={1.5} />;
      })}
      {count != null && (
        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">
          {value.toFixed(1).replace(".", ",")} ({count} avis)
        </span>
      )}
    </span>
  );
}
