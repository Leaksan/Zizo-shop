import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { api } from "../api";
import { formatDate } from "../format";
import Rating from "./Rating";

export default function ReviewsSection({ productId }) {
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    api
      .get(`/products/${productId}/reviews`)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [productId]);

  if (reviews === null) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <MessageSquare size={20} className="text-brand-600 dark:text-brand-400" />
        Avis clients {reviews.length > 0 && `(${reviews.length})`}
      </h2>
      {reviews.length === 0 ? (
        <p className="card p-6 text-center text-sm muted">
          Aucun avis pour le moment. Les clients pourront laisser un avis avec photo après leur
          livraison.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{r.customer_name}</span>
                <span className="text-xs muted">{formatDate(r.created_at)}</span>
              </div>
              <Rating value={r.rating} className="mt-1" />
              {r.comment && <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{r.comment}</p>}
              {r.photo_url && (
                <a href={r.photo_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={r.photo_url}
                    alt="Photo client"
                    className="mt-3 h-32 w-32 rounded-lg object-cover transition hover:scale-105"
                  />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
