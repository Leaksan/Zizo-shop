import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import ShopForm from "../../components/ShopForm";

export default function SellerShopEdit() {
  const { shop, reload } = useOutletContext();
  const { refresh } = useAuth();
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-lg">
      {saved && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
          <CheckCircle2 size={16} /> Boutique enregistrée.
        </p>
      )}
      <ShopForm
        initial={shop}
        submitLabel="Enregistrer"
        onSubmit={async (form) => {
          setSaved(false);
          await api.put("/my/shop", form);
          await Promise.all([reload(), refresh()]);
          setSaved(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
