import { useState } from "react";
import { Bike, Camera, CheckCircle2, Send, Star } from "lucide-react";
import { api } from "../api";
import Rating from "./Rating";

export function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="transition hover:scale-125">
          <Star
            size={26}
            className={n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-slate-600"}
          />
        </button>
      ))}
    </div>
  );
}

export function CourierRatingForm({ order, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");

  if (order.courier_rating) {
    return (
      <div className="card mt-6 p-5">
        <h3 className="mb-2 flex items-center gap-2 font-bold">
          <Bike size={18} className="text-indigo-600 dark:text-indigo-400" />
          Votre note pour {order.courier?.name || "le livreur"}
        </h3>
        <Rating value={order.courier_rating} />
        {order.courier_comment && (
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">« {order.courier_comment} »</p>
        )}
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      await api.put(`/orders/${order.reference}/courier-rating`, { rating, comment });
      setStatus("ok");
      onDone?.();
    } catch (e2) {
      setStatus(e2.message);
    }
  };

  return (
    <form onSubmit={submit} className="card mt-6 p-5">
      <h3 className="mb-1 flex items-center gap-2 font-bold">
        <Bike size={18} className="text-indigo-600 dark:text-indigo-400" />
        Notez votre livreur {order.courier?.name && `(${order.courier.name})`}
      </h3>
      <p className="mb-3 text-sm muted">Bon service ou problème ? Votre avis compte.</p>
      <StarInput value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Commentaire (optionnel)…"
        className="input mt-3"
      />
      {status && status !== "sending" && status !== "ok" && (
        <p className="mt-2 text-sm text-red-600">{status}</p>
      )}
      <button type="submit" disabled={status === "sending"} className="btn-primary mt-3 flex items-center gap-2">
        <Send size={15} />
        {status === "sending" ? "Envoi…" : "Envoyer ma note"}
      </button>
    </form>
  );
}

export function ProductReviewForm({ order, item, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const fd = new FormData();
      fd.append("product_id", item.product_id);
      fd.append("rating", rating);
      fd.append("comment", comment);
      if (photo) fd.append("photo", photo);
      const res = await fetch(`/api/orders/${order.reference}/reviews`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setStatus("ok");
      onDone?.();
    } catch (e2) {
      setStatus(e2.message);
    }
  };

  if (status === "ok") {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
        <CheckCircle2 size={16} />
        Merci ! Votre avis sur « {item.product_name} » est publié.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-gray-200 p-4 dark:border-slate-700">
      <p className="font-semibold">
        {item.product_name} <span className="text-sm font-normal muted">({item.variant_name})</span>
      </p>
      <div className="mt-2">
        <StarInput value={rating} onChange={setRating} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Votre avis sur ce produit…"
        className="input mt-2"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="btn-outline flex cursor-pointer items-center gap-1.5">
          <Camera size={14} />
          {photo ? photo.name.slice(0, 24) : "Ajouter une photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          />
        </label>
        <button type="submit" disabled={status === "sending"} className="btn-primary text-xs">
          {status === "sending" ? "Envoi…" : "Publier l'avis"}
        </button>
      </div>
      {status && status !== "sending" && <p className="mt-2 text-sm text-red-600">{status}</p>}
    </form>
  );
}
