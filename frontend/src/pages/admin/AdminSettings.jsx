import { useEffect, useState } from "react";
import { api } from "../../api";
import { useShop } from "../../context/ShopContext";

export default function AdminSettings() {
  const { reload } = useShop();
  const [form, setForm] = useState({
    shop_name: "",
    shop_phone: "",
    pickup_address: "",
    currency: "EUR",
    low_stock_threshold: "5",
    delivery_fee: "",
    free_shipping_threshold: "",
    delivery_commission: "",
    zones: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/settings")
      .then((s) => setForm({ ...s, zones: (s.zones || []).join(", ") }))
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
        zones: form.zones.split(",").map((z) => z.trim()).filter(Boolean),
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
              <option value="XOF">XOF (FCFA)</option>
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
            <span className="label">Frais de livraison</span>
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
        <label className="block">
          <span className="label">Zones de livraison (séparées par des virgules)</span>
          <input
            value={form.zones}
            onChange={set("zones")}
            className="input"
            placeholder="Centre-ville, Nord, Sud, Est, Ouest"
          />
        </label>

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
