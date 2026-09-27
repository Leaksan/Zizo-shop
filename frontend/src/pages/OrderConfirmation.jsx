import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Store } from "lucide-react";
import { api } from "../api";
import { useShop } from "../context/ShopContext";

export default function OrderConfirmation() {
  const { reference } = useParams();
  const { pickupAddress } = useShop();
  const [isPickup, setIsPickup] = useState(false);

  useEffect(() => {
    api
      .get(`/orders/track/${reference}`)
      .then((o) => setIsPickup(o.delivery_method === "pickup"))
      .catch(() => {});
  }, [reference]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="animate-pop mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
        <CheckCircle2 size={36} />
      </div>
      <h1 className="text-2xl font-bold">Commande confirmée !</h1>
      <p className="mt-2 text-gray-600 dark:text-slate-300">
        Merci pour votre commande. Conservez votre numéro de suivi :
      </p>
      <p className="animate-pop mx-auto mt-4 w-fit rounded-xl bg-brand-50 px-6 py-3 text-xl font-bold tracking-widest text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        {reference}
      </p>
      {isPickup ? (
        <div className="mx-auto mt-5 max-w-sm rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          <p className="flex items-center justify-center gap-2 font-semibold">
            <Store size={16} />
            Retrait en boutique
          </p>
          <p className="mt-1">📍 {pickupAddress}</p>
          <p className="mt-1 text-xs opacity-80">
            Présentez ce numéro au comptoir pour récupérer votre commande.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm muted">
          Un livreur va très vite prendre en charge votre colis. Vous pourrez suivre sa position en
          temps réel.
        </p>
      )}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to={`/suivi?ref=${reference}`}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 px-6 py-2.5 sm:w-auto"
        >
          <MapPin size={17} />
          Suivre ma commande
        </Link>
        <Link to="/boutique" className="btn-outline w-full px-6 py-2.5 text-center text-sm sm:w-auto">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
