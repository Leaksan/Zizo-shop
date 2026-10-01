import { Navigate, useNavigate } from "react-router-dom";
import { BadgeCheck, Store, Truck, Users } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import ShopForm from "../components/ShopForm";

// « Ouvrir ma boutique » : la boutique est créée en attente de validation par l'admin
export default function OpenShop() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="skeleton mx-auto h-72 max-w-lg" />;
  if (!user) return <Navigate to="/compte?mode=inscription&suite=/vendeur/ouvrir" replace />;
  if (user.shop) return <Navigate to="/vendeur" replace />;

  const perks = [
    { icon: Users, text: "Vos nouveautés en tête de l'Explorer, votre page dans l'annuaire" },
    { icon: Truck, text: "Livraison partout à Libreville par nos livreurs, paiement à la livraison" },
    { icon: BadgeCheck, text: "Boutique vérifiée par notre équipe avant sa mise en ligne" },
  ];

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Store size={24} className="text-brand-600 dark:text-brand-400" />
          Ouvrir ma boutique
        </h1>
        <ul className="mt-3 flex flex-col gap-2">
          {perks.map((p) => (
            <li key={p.text} className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
              <p.icon size={16} className="shrink-0 text-brand-600 dark:text-brand-400" />
              {p.text}
            </li>
          ))}
        </ul>
      </div>
      <ShopForm
        initial={{ whatsapp: "" }}
        submitLabel="Envoyer ma boutique pour validation"
        onSubmit={async (form) => {
          await api.post("/my/shop", form);
          await refresh();
          navigate("/vendeur", { replace: true });
        }}
      />
    </div>
  );
}
