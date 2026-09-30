import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Store } from "lucide-react";
import { api } from "../api";
import ShopAvatar from "../components/ShopAvatar";

// Confirmation : une commande par boutique (références séparées par des virgules dans l'adresse)
export default function OrderConfirmation() {
  const { reference } = useParams();
  const references = reference.split(",").filter(Boolean);
  const [orders, setOrders] = useState({});

  useEffect(() => {
    references.forEach((ref) =>
      api
        .get(`/orders/track/${ref}`)
        .then((o) => setOrders((all) => ({ ...all, [ref]: o })))
        .catch(() => {})
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const several = references.length > 1;

  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="animate-pop mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
        <CheckCircle2 size={36} />
      </div>
      <h1 className="text-2xl font-bold">{several ? "Commandes confirmées !" : "Commande confirmée !"}</h1>
      <p className="mt-2 text-gray-600 dark:text-slate-300">
        {several
          ? `Merci ! Vos articles viennent de ${references.length} boutiques : une commande et un suivi par boutique.`
          : "Merci pour votre commande. Conservez votre numéro de suivi :"}
      </p>

      <ul className="mt-5 flex flex-col gap-3 text-left">
        {references.map((ref) => {
          const order = orders[ref];
          const pickup = order?.delivery_method === "pickup";
          return (
            <li key={ref} className="card p-4">
              <div className="flex items-center gap-3">
                {order?.shop && <ShopAvatar shop={order.shop} className="h-9 w-9 text-sm" />}
                <div className="min-w-0 flex-1">
                  {order?.shop && <p className="truncate text-sm font-semibold">{order.shop.name}</p>}
                  <p className="text-lg font-bold tracking-widest text-brand-700 dark:text-brand-300">{ref}</p>
                </div>
                <Link to={`/suivi?ref=${ref}`} className="btn-outline shrink-0 text-sm">
                  Suivre
                </Link>
              </div>
              {pickup && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-green-50 p-2 text-xs text-green-800 dark:bg-green-950 dark:text-green-200">
                  <Store size={14} className="mt-0.5 shrink-0" />
                  Retrait en boutique : présentez ce numéro au vendeur.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {!Object.values(orders).every((o) => o.delivery_method === "pickup") && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-sm muted">
          <MapPin size={15} />
          Un livreur récupère votre colis chez le vendeur, puis vous le livre : suivez-le en temps réel.
        </p>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to={several ? "/suivi" : `/suivi?ref=${references[0]}`}
          className="btn-primary inline-flex w-full items-center justify-center gap-2 px-6 py-2.5 sm:w-auto"
        >
          <MapPin size={17} />
          {several ? "Voir mes commandes" : "Suivre ma commande"}
        </Link>
        <Link to="/fil" className="btn-outline w-full px-6 py-2.5 text-center text-sm sm:w-auto">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
