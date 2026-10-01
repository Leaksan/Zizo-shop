import { useEffect, useState } from "react";
import { Plus, Volume2, X } from "lucide-react";
import { api } from "../../api";
import { useShop } from "../../context/ShopContext";
import Switch from "../../components/Switch";
import { citiesOf } from "../../cities";
import { play, SOUNDS } from "../../sounds";

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
    intercity_fee: "",
    intercity_delay: "",
  });
  // Point relais de chaque ville : où arrive un colis envoyé d'une autre ville
  const [relayPoints, setRelayPoints] = useState({});
  // [{ name, fee }] — fee vide = frais de livraison par défaut
  const [zoneRows, setZoneRows] = useState([]);
  // Sons coupés pour tout le site (chaque visiteur peut aussi couper les siens)
  const [soundsOff, setSoundsOff] = useState([]);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/settings")
      .then((s) => {
        setForm(s);
        setSoundsOff(s.sounds_off || []);
        setRelayPoints(s.relay_points || {});
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
        low_stock_threshold: form.low_stock_threshold,
        delivery_fee: form.delivery_fee,
        free_shipping_threshold: form.free_shipping_threshold,
        delivery_commission: form.delivery_commission,
        intercity_fee: form.intercity_fee,
        intercity_delay: form.intercity_delay,
        relay_points: relayPoints,
        zones: zoneRows.map((z) => z.name.trim()).filter(Boolean),
        zone_fees: Object.fromEntries(
          zoneRows.filter((z) => z.name.trim()).map((z) => [z.name.trim(), z.fee])
        ),
        sounds_off: soundsOff,
        ...(newPassword ? { new_password: newPassword } : {}),
      });
      setMessage("Paramètres enregistrés.");
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
          <span className="label">Adresse de retrait de la boutique officielle</span>
          <input
            value={form.pickup_address}
            onChange={set("pickup_address")}
            className="input"
            placeholder="Ex. Centre-ville, près du Marché Mont-Bouët"
          />
          <span className="mt-1 block text-xs muted">
            Donnée aux clients qui retirent une commande de la boutique officielle, et aux livreurs.
            Chaque vendeur indique la sienne dans sa boutique.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Devise</span>
            <p className="input bg-gray-50 text-gray-600 dark:bg-slate-900 dark:text-slate-300">Franc CFA (XAF)</p>
          </div>
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
            Laissez les frais vides pour appliquer les frais par défaut. Pour un quartier d'une autre
            ville, écrivez « Ville · Quartier » (ex. Port-Gentil · Balise) ; un quartier sans ville est
            à Libreville.
          </p>
          <div className="flex flex-col gap-2">
            {zoneRows.map((z, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={z.name}
                  onChange={(e) =>
                    setZoneRows(zoneRows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                  }
                  className="input min-w-0 flex-1"
                  placeholder="Quartier, ou « Ville · Quartier »"
                />
                <input
                  type="number"
                  min="0"
                  value={z.fee}
                  onChange={(e) =>
                    setZoneRows(zoneRows.map((r, j) => (j === i ? { ...r, fee: e.target.value } : r)))
                  }
                  className="input w-24 shrink-0"
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
        <h2 className="font-semibold">Envoi entre villes</h2>
        <p className="-mt-2 text-xs muted">
          Quand la boutique et le client ne sont pas dans la même ville (ex. boutique de Libreville,
          client de Port-Gentil) : le colis voyage, puis un livreur de la ville du client le livre une
          fois que vous l'avez marqué « Arrivé » dans Commandes.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Frais d'envoi (ajoutés à la livraison)</span>
            <input
              type="number"
              min="0"
              value={form.intercity_fee}
              onChange={set("intercity_fee")}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Délai annoncé au client</span>
            <input
              value={form.intercity_delay}
              onChange={set("intercity_delay")}
              className="input"
              placeholder="Ex. 2 à 4 jours"
            />
          </label>
        </div>
        <div>
          <span className="label">Points relais : où le livreur récupère un colis arrivé</span>
          <div className="flex flex-col gap-2">
            {citiesOf(zoneRows.map((z) => z.name.trim()).filter(Boolean)).map((city) => (
              <label key={city} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-sm font-medium">{city}</span>
                <input
                  value={relayPoints[city] || ""}
                  onChange={(e) => setRelayPoints({ ...relayPoints, [city]: e.target.value })}
                  className="input flex-1"
                  placeholder={`Adresse à ${city}`}
                />
              </label>
            ))}
          </div>
        </div>

        <hr className="border-gray-200 dark:border-slate-700" />
        <h2 className="font-semibold">Sons du site</h2>
        <p className="-mt-2 text-xs muted">
          Un son coupé ici ne joue pour personne. Chaque visiteur peut en plus couper les siens dans
          « Paramètres » (menu du site).
        </p>
        <ul className="flex flex-col divide-y divide-gray-100 dark:divide-slate-700">
          {SOUNDS.map((sound) => {
            const on = !soundsOff.includes(sound.key);
            return (
              <li key={sound.key} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => play(sound.key, { force: true })}
                  className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950"
                  aria-label={`Écouter : ${sound.label}`}
                  title="Écouter"
                >
                  <Volume2 size={18} />
                </button>
                <span className="flex-1 text-sm">{sound.label}</span>
                <Switch
                  checked={on}
                  label={sound.label}
                  onChange={(value) =>
                    setSoundsOff((list) => (value ? list.filter((k) => k !== sound.key) : [...list, sound.key]))
                  }
                />
              </li>
            );
          })}
        </ul>

        <hr className="border-gray-200 dark:border-slate-700" />
        <h2 className="font-semibold">Sécurité</h2>
        <label className="block">
          <span className="label">Nouveau mot de passe admin (vide = inchangé)</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
          <span className="mt-1 block text-xs muted">8 caractères minimum. Il est enregistré chiffré.</span>
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
