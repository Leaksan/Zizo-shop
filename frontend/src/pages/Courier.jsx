import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Bike,
  CheckCircle2,
  Clock,
  Inbox,
  KeyRound,
  LogOut,
  Map,
  MapPin,
  Moon,
  Package,
  PackageOpen,
  PauseCircle,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Star,
  User,
} from "lucide-react";
import { api } from "../api";
import { formatDate, formatPrice } from "../format";
import { useShop } from "../context/ShopContext";
import CourierMap from "../components/CourierMap";

const VEHICLES = ["Scooter", "Moto", "Vélo", "Voiture"];

export default function Courier() {
  const [courier, setCourier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/courier/me")
      .then((res) => setCourier(res.courier))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-16 text-center muted">Chargement…</p>;
  return courier ? (
    <CourierDashboard courier={courier} onLogout={() => setCourier(null)} />
  ) : (
    <CourierAuth onLogin={setCourier} />
  );
}

function CourierAuth({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    vehicle: VEHICLES[0],
    zone: "",
  });
  const [error, setError] = useState("");
  const { zones } = useShop();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const courier =
        tab === "login"
          ? await api.post("/courier/login", { phone: form.phone, password: form.password })
          : await api.post("/courier/register", { ...form, zone: form.zone || zones[0] || "" });
      onLogin(courier);
    } catch (e2) {
      setError(e2.message);
    }
  };

  const tabCls = (active) =>
    `flex-1 rounded-lg py-2 text-sm font-bold transition ${
      active
        ? "bg-white text-indigo-600 shadow dark:bg-slate-700"
        : "text-gray-500 dark:text-slate-400"
    }`;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <span className="animate-gradient mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/30">
          <Bike size={32} className="text-white" />
        </span>
        <h1 className="text-2xl font-bold">Espace livreur</h1>
        <p className="mt-1 text-sm muted">
          Inscrivez-vous, consultez les courses disponibles et gagnez une commission à chaque
          livraison.
        </p>
      </div>
      <div className="card p-6">
        <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-slate-900">
          <button onClick={() => setTab("login")} className={tabCls(tab === "login")}>
            Connexion
          </button>
          <button onClick={() => setTab("register")} className={tabCls(tab === "register")}>
            Inscription
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {tab === "register" && (
            <label className="block">
              <span className="label">Nom complet</span>
              <input required value={form.name} onChange={set("name")} className="input" placeholder="Ex. Karim Benali" />
            </label>
          )}
          <label className="block">
            <span className="label">Téléphone</span>
            <input required type="tel" value={form.phone} onChange={set("phone")} className="input" placeholder="Ex. 06 98 76 54 32" />
          </label>
          {tab === "register" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Véhicule</span>
                <select value={form.vehicle} onChange={set("vehicle")} className="input">
                  {VEHICLES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Zone préférée</span>
                <select value={form.zone || zones[0] || ""} onChange={set("zone")} className="input">
                  {zones.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label className="block">
            <span className="label">Mot de passe</span>
            <input
              required
              type="password"
              minLength={tab === "register" ? 4 : undefined}
              value={form.password}
              onChange={set("password")}
              className="input"
              placeholder={tab === "register" ? "4 caractères minimum" : "Votre mot de passe"}
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-primary flex items-center justify-center gap-2 py-2.5">
            <Bike size={17} />
            {tab === "login" ? "Se connecter" : "Créer mon compte livreur"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CourierDashboard({ courier, onLogout }) {
  const [data, setData] = useState(null);
  const [me, setMe] = useState(courier);
  const [error, setError] = useState("");
  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState(false);
  const [activeTab, setActiveTab] = useState("dispos");
  const { currency } = useShop();

  const load = useCallback(() => {
    api
      .get("/courier/deliveries")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoError(true);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setMyPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoError(false);
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 20000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const inProgressCount = data?.in_progress?.length || 0;

  useEffect(() => {
    if (!myPos || inProgressCount === 0) return;
    const send = () =>
      api.put("/courier/position", { lat: myPos[0], lng: myPos[1] }).catch(() => {});
    send();
    const timer = setInterval(send, 30000);
    return () => clearInterval(timer);
  }, [myPos, inProgressCount]);

  const toggleAvailability = async () => {
    setMe(await api.put("/courier/availability", { available: !me.available }));
  };

  const accept = async (order) => {
    try {
      await api.post(`/courier/deliveries/${order.id}/accept`);
      load();
    } catch (e) {
      setError(e.message);
      load();
    }
  };

  const complete = async (order, code) => {
    try {
      await api.post(`/courier/deliveries/${order.id}/complete`, { code });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const logout = async () => {
    await api.post("/courier/logout").catch(() => {});
    onLogout();
  };

  const stats = data
    ? [
        { id: "dispos", icon: PackageOpen, value: data.available.length, label: "Courses disponibles" },
        { id: "encours", icon: Bike, value: data.in_progress.length, label: "Livraisons en cours" },
        { id: "historique", icon: CheckCircle2, value: data.delivered.length, label: "Courses livrées" },
        { id: null, icon: Banknote, value: formatPrice(data.earnings, currency), label: "Gains cumulés" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-xl shadow-indigo-500/20">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
          <Bike size={32} />
        </span>
        <div>
          <h1 className="text-xl font-bold">Bonjour, {me.name} 👋</h1>
          <p className="text-sm opacity-85">
            {me.vehicle} · Zone {me.zone} · {me.phone}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {me.verified ? (
              <span className="flex items-center gap-1 rounded-full bg-green-400/25 px-2 py-0.5 font-bold">
                <ShieldCheck size={12} /> Livreur vérifié
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/25 px-2 py-0.5 font-bold">
                <ShieldAlert size={12} /> En cours de vérification
              </span>
            )}
            {data?.rating_avg && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-bold">
                <Star size={12} className="fill-amber-300 text-amber-300" />
                {data.rating_avg.toFixed(1).replace(".", ",")}/5 ({data.rating_count} avis)
              </span>
            )}
            {data?.bonus_total > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-bold">
                🎁 Prime : {formatPrice(data.bonus_total, currency)}
              </span>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggleAvailability}
            className="flex items-center gap-2 text-sm font-bold"
          >
            <span
              className={`relative h-6 w-11 rounded-full transition ${me.available ? "bg-green-500" : "bg-white/35"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${me.available ? "left-[22px]" : "left-0.5"}`}
              />
            </span>
            {me.available ? "En ligne" : "Hors ligne"}
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-bold transition hover:bg-white/25"
          >
            <LogOut size={15} />
            Déconnexion
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && inProgressCount > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <Map size={20} className="text-indigo-600 dark:text-indigo-400" />
            Carte des livraisons en cours
            {myPos && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
                Position partagée
              </span>
            )}
          </h2>
          {geoError && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              ⚠️ Activez la géolocalisation pour afficher votre position et les itinéraires.
            </p>
          )}
          <CourierMap courierPos={myPos} deliveries={data.in_progress} />
        </section>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((s) => {
              const isTab = s.id !== null;
              const active = activeTab === s.id;
              const cls = `card p-4 text-left transition ${
                isTab ? "hover:-translate-y-0.5 hover:shadow-md" : ""
              } ${active ? "ring-2 ring-indigo-500 lg:ring-0" : ""}`;
              const inner = (
                <>
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                    }`}
                  >
                    <s.icon size={20} />
                  </span>
                  <p className="mt-2 text-2xl font-bold">{s.value}</p>
                  <p className="text-xs leading-tight muted">{s.label}</p>
                </>
              );
              return isTab ? (
                <button key={s.label} onClick={() => setActiveTab(s.id)} className={cls}>
                  {inner}
                </button>
              ) : (
                <div key={s.label} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section
              className={`card p-4 sm:p-5 ${activeTab === "dispos" ? "block" : "hidden"} lg:block`}
            >
              <h2 className="mb-4 flex items-center gap-2 font-bold">
                <PackageOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
                Courses disponibles
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {data.available.length}
                </span>
              </h2>
              {!me.verified ? (
                <Empty
                  icon={<ShieldAlert size={40} strokeWidth={1.2} />}
                  text={"Votre compte est en cours de vérification par la boutique.\nVous pourrez accepter des courses une fois vérifié."}
                />
              ) : !me.available ? (
                <Empty icon={<PauseCircle size={40} strokeWidth={1.2} />} text={"Vous êtes hors ligne.\nPassez « En ligne » pour voir et accepter des courses."} />
              ) : data.available.length === 0 ? (
                <Empty icon={<Moon size={40} strokeWidth={1.2} />} text={"Aucune course disponible pour le moment.\nLes nouvelles commandes apparaîtront ici automatiquement."} />
              ) : (
                data.available.map((o) => (
                  <DeliveryCard key={o.id} order={o} myZone={me.zone} currency={currency}>
                    <button onClick={() => accept(o)} className="btn-primary flex items-center gap-1.5 text-xs">
                      <CheckCircle2 size={14} />
                      Accepter (+{formatPrice(data.commission, currency)})
                    </button>
                  </DeliveryCard>
                ))
              )}
            </section>

            <section
              className={`card p-4 sm:p-5 ${activeTab === "encours" ? "block" : "hidden"} lg:block`}
            >
              <h2 className="mb-4 flex items-center gap-2 font-bold">
                <Bike size={20} className="text-indigo-600 dark:text-indigo-400" />
                Mes livraisons en cours
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {data.in_progress.length}
                </span>
              </h2>
              {data.in_progress.length === 0 ? (
                <Empty icon={<Inbox size={40} strokeWidth={1.2} />} text={"Aucune livraison en cours.\nAcceptez une course disponible pour commencer."} />
              ) : (
                data.in_progress.map((o) => (
                  <DeliveryCard key={o.id} order={o} myZone={me.zone} currency={currency}>
                    <CompleteForm onSubmit={(code) => complete(o, code)} />
                  </DeliveryCard>
                ))
              )}
            </section>
          </div>

          <section
            className={`card p-4 sm:p-5 ${activeTab === "historique" ? "block" : "hidden"} lg:block`}
          >
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <ScrollText size={20} className="text-indigo-600 dark:text-indigo-400" />
              Historique de mes livraisons
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {data.delivered.length}
              </span>
            </h2>
            {data.delivered.length === 0 ? (
              <Empty icon={<ScrollText size={40} strokeWidth={1.2} />} text="Votre historique de livraisons apparaîtra ici." />
            ) : (
              data.delivered.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-3 text-sm last:border-0 dark:border-slate-700"
                >
                  <span>
                    <b>{o.reference}</b> · {o.customer_name} ({o.zone})
                  </span>
                  <span className="muted">{formatDate(o.delivered_at)}</span>
                  <span className="font-bold text-green-600">
                    +{formatPrice(data.commission, currency)}
                  </span>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="py-8 text-center muted">
      <span className="mx-auto flex w-fit text-gray-300 dark:text-slate-600">{icon}</span>
      <p className="mt-2 text-sm whitespace-pre-line">{text}</p>
    </div>
  );
}

function CompleteForm({ onSubmit }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim().length === 4) onSubmit(code.trim());
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300">
        <KeyRound size={14} />
        Code client :
      </label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="0000"
        inputMode="numeric"
        className="input w-24 py-1.5 text-center font-mono font-bold tracking-widest"
      />
      <button
        type="submit"
        disabled={code.length !== 4}
        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-40"
      >
        <CheckCircle2 size={14} />
        Confirmer la livraison
      </button>
    </form>
  );
}

function DeliveryCard({ order, myZone, currency, children }) {
  const myZoneMatch = order.zone === myZone;
  const itemCount = order.items.reduce((s, a) => s + a.quantity, 0);
  const mapsUrl =
    order.latitude != null && order.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`
      : "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(`${order.customer_address} ${order.zone}, Libreville, Gabon`);

  return (
    <div className="mb-3 rounded-xl border border-gray-200 p-4 transition hover:border-indigo-400 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-bold">{order.reference}</span>
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
            myZoneMatch
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
          }`}
        >
          {myZoneMatch && <MapPin size={11} />}
          {myZoneMatch ? "Votre zone · " : ""}
          {order.zone}
        </span>
      </div>
      <div className="mb-3 flex flex-col gap-1.5 text-sm muted">
        <span className="flex items-center gap-1.5">
          <User size={14} />
          <b className="text-gray-800 dark:text-gray-200">{order.customer_name}</b> ·{" "}
          <a
            href={`tel:${order.customer_phone.replace(/\s/g, "")}`}
            className="font-semibold text-indigo-600 dark:text-indigo-400"
          >
            {order.customer_phone}
          </a>
        </span>
        <span className="flex items-center gap-1.5">
          <Package size={14} />
          {itemCount} article{itemCount > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={14} />
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-indigo-600 dark:text-indigo-400"
          >
            {order.customer_address} ↗
          </a>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={14} />
          Commandée {formatDate(order.created_at)}
        </span>
      </div>
      {order.note && (
        <p className="mb-3 rounded-lg border-l-2 border-indigo-500 bg-gray-50 px-3 py-2 text-xs text-gray-500 italic dark:bg-slate-900 dark:text-slate-400">
          📝 « {order.note} »
        </p>
      )}
      {order.payment_method === "livraison" ? (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Banknote size={14} />
          À encaisser auprès du client : {formatPrice(order.total, currency)}
        </p>
      ) : (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-950 dark:text-green-300">
          <CheckCircle2 size={14} />
          Déjà payé par carte — rien à encaisser
        </p>
      )}
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
