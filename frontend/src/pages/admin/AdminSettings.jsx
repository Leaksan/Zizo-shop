import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "../../api";
import { useShop } from "../../context/ShopContext";

export default function AdminSettings() {
  const { reload } = useShop();
  const [form, setForm] = useState({
    shop_name: "",
    shop_phone: "",
    pickup_address: "",
    currency: "XAF",
    low_stock_threshold: "5",
    delivery_fee: "",
    free_shipping_threshold: "",
    delivery_commission: "",
  });
  // [{ name, fee }] — fee vide = frais de livraison par défaut
  const [zoneRows, setZoneRows] = useState([]);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/settings")
      .then((s) => {
        setForm(s);
        setZoneRows(
          (s.zones || []).map((name) => ({
            name,
            fee: s.zone_fees?.[name] != null ? String(s.zone_fees[name]) : "",
          }))
        );
      })
      .catch(() => {});
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.put("/admin/settings", {
        shop_name: form.shop_name,
        shop_phone: form.shop_phone,
        pickup_address: form.pickup_address,
        currency: form.currency,
        low_stock_threshold: form.low_stock_threshold,
        delivery_fee: form.delivery_fee,
        free_shipping_threshold: form.free_shipping_threshold,
        delivery_commission: form.delivery_commission,
        zones: zoneRows.map((z) => z.name.trim()).filter(Boolean),
        zone_fees: Object.fromEntries(
          zoneRows.filter((z) => z.name.trim()).map((z) => [z.name.trim(), z.fee])
        ),
        ...(newPassword ? { new_password: newPassword } : {}),
      });
      setMessage("Paramètres enregistrés ✓");
      setNewPassword("");
      reload();
    } catch (e2) {
      setError(e2.message);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Paramètres</h1>
      <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-6">
        <h2 className="font-semibold">Boutique</h2>
        <label className="block">
          <span className="label">Nom de la boutique</span>
          <input value={form.shop_name} onChange={set("shop_name")} className="input" />
        </label>
        <label className="block">
          <span className="label">Numéro WhatsApp de la boutique (commandes &amp; contact clients)</span>
          <input
            type="tel"
            value={form.shop_phone}
            onChange={set("shop_phone")}
            className="input"
            placeholder="Ex. 074756768"
          />
          <span className="mt-1 block text-xs muted">
            Utilisé pour le bouton WhatsApp flottant, le footer et la page de commande. Les clients
            sont invités à privilégier WhatsApp.
          </span>
        </label>
        <label className="block">
          <span className="label">Adresse de retrait en boutique (click &amp; collect)</span>
          <input
            value={form.pickup_address}
            onChange={set("pickup_address")}
            className="input"
            placeholder="Ex. Centre-ville, près du Marché Mont-Bouët"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Devise</span>
            <select value={form.currency} onChange={set("currency")} className="input">
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CHF">CHF</option>
              <option value="MAD">MAD</option>
              <option value="XAF">XAF (FCFA — Gabon, Afrique centrale)</option>
              <option value="XOF">XOF (FCFA — Afrique de l'Ouest)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Seuil d'alerte stock faible</span>
            <input
              type="number"
              min="0"
              value={form.low_stock_threshold}
              onChange={set("low_stock_threshold")}
              className="input"
            />
          </label>
        </div>

        <hr className="border-gray-200 dark:border-slate-700" />
        <h2 className="font-semibold">Livraison</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="label">Frais de livraison par défaut</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.delivery_fee}
              onChange={set("delivery_fee")}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Offerte dès (0 = jamais)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.free_shipping_threshold}
              onChange={set("free_shipping_threshold")}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Commission livreur</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.delivery_commission}
              onChange={set("delivery_commission")}
              className="input"
            />
          </label>
        </div>
        <div>
          <span className="label">Zones de livraison et frais</span>
          <p className="mb-2 text-xs muted">
            Laissez les frais vides pour appliquer les frais par défaut. Vous pouvez ajouter
            d'autres villes (ex. Port-Gentil) comme des zones.
          </p>
          <div className="flex flex-col gap-2">
            {zoneRows.map((z, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={z.name}
                  onChange={(e) =>
                    setZoneRows(zoneRows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                  }
                  className="input flex-1"
                  placeholder="Nom de la zone"
                />
                <input
                  type="number"
                  min="0"
                  value={z.fee}
                  onChange={(e) =>
                    setZoneRows(zoneRows.map((r, j) => (j === i ? { ...r, fee: e.target.value } : r)))
                  }
                  className="input w-32"
                  placeholder={form.delivery_fee ? `${form.delivery_fee}` : "Défaut"}
                />
                <button
                  type="button"
                  onClick={() => setZoneRows(zoneRows.filter((_, j) => j !== i))}
                  className="rounded-lg px-2 text-gray-400 hover:text-red-600"
                  aria-label={`Supprimer ${z.name}`}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setZoneRows([...zoneRows, { name: "", fee: "" }])}
            className="btn-outline mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm"
          >
            <Plus size={15} /> Ajouter une zone
          </button>
        </div>

        <hr className="border-gray-200 dark:border-slate-700" />
        <h2 className="font-semibold">Sécurité</h2>
        <label className="block">
          <span className="label">Nouveau mot de passe admin (vide = inchangé)</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
          />
        </label>
        {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary py-2.5">
          Enregistrer
        </button>
      </form>
    </div>
  );
}
