import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bell, ChevronRight, Heart, LogOut, Package, Settings, Store, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useShop } from "../context/ShopContext";
import PasswordInput from "../components/PasswordInput";
import ShopAvatar from "../components/ShopAvatar";
import { formatPhone } from "../format";
import { SHOP_STATUS } from "../shopStatus";
import { whatsappUrl, WhatsAppIcon } from "../whatsapp";

export default function Account() {
  const { user, loading } = useAuth();
  if (loading) return <div className="skeleton mx-auto h-72 max-w-md" />;
  return user ? <Profile user={user} /> : <AuthForms />;
}

// Page d'où l'on vient (ex. « suivre » une boutique) : seulement une adresse du site
function safeNext(value) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function AuthForms() {
  const { login, register } = useAuth();
  const { shopPhone, shopName } = useShop();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState(params.get("mode") === "inscription" ? "register" : "login");
  const [form, setForm] = useState({ name: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("suite"));
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(form.phone, form.password);
      else await register(form);
      if (next) navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tabCls = (active) =>
    `flex-1 rounded-lg py-2 text-sm font-semibold transition ${
      active ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300" : "text-gray-500"
    }`;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <UserRound size={28} />
        </span>
        <h1 className="text-2xl font-bold">Mon compte</h1>
        <p className="mt-1 text-sm muted">Suivez vos boutiques préférées et ouvrez la vôtre sur {shopName}.</p>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-slate-800">
        <button onClick={() => setMode("login")} className={tabCls(mode === "login")}>
          Se connecter
        </button>
        <button onClick={() => setMode("register")} className={tabCls(mode === "register")}>
          Créer un compte
        </button>
      </div>

      <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
        {mode === "register" && (
          <label className="block">
            <span className="label">Votre nom</span>
            <input value={form.name} onChange={set("name")} autoComplete="name" required className="input" placeholder="Ex. Awa Mba" />
          </label>
        )}
        <label className="block">
          <span className="label">Téléphone</span>
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={set("phone")}
            autoComplete="tel"
            required
            className="input"
            placeholder="Ex. 077 12 34 56"
          />
        </label>
        <div>
          <label className="label" htmlFor="password">
            Mot de passe {mode === "register" && <span className="font-normal muted">(6 caractères minimum)</span>}
          </label>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={set("password")}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary py-3 text-base">
          {busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>

      {mode === "login" && shopPhone && (
        <a
          href={whatsappUrl(shopPhone, "Bonjour, j'ai oublié le mot de passe de mon compte.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-green-700 hover:underline dark:text-green-400"
        >
          <WhatsAppIcon size={16} />
          Mot de passe oublié ? Écrivez-nous
        </a>
      )}
    </div>
  );
}

function Profile({ user }) {
  const { logout, update, unread } = useAuth();
  const [follows, setFollows] = useState(null);
  const [name, setName] = useState(user.name);
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get("/me/follows").then(setFollows).catch(() => setFollows([]));
  }, []);

  const save = async (changes, done) => {
    setMessage(null);
    try {
      await update(changes);
      setMessage({ ok: true, text: done });
      setPasswords({ current_password: "", new_password: "" });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  const shop = user.shop;
  const status = shop && SHOP_STATUS[shop.status];
  const rowCls =
    "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition hover:bg-gray-50 dark:hover:bg-slate-700/50";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-extrabold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{user.name}</h1>
          <p className="text-sm muted">{formatPhone(user.phone)}</p>
        </div>
      </div>

      {shop ? (
        <Link to="/vendeur" className="card flex items-center gap-3 p-4 transition hover:border-brand-300">
          <ShopAvatar shop={shop} className="h-12 w-12 text-lg" />
          <span className="min-w-0 flex-1">
            <b className="block truncate">{shop.name}</b>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${status?.cls}`}>
              {status?.label}
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
            Gérer <ChevronRight size={16} />
          </span>
        </Link>
      ) : (
        <Link
          to="/vendeur/ouvrir"
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-4 transition hover:border-brand-500 dark:border-brand-800 dark:bg-brand-950/40"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <Store size={22} />
          </span>
          <span className="flex-1">
            <b className="block">Vendez sur la plateforme</b>
            <small className="muted">Ouvrez votre boutique : elle sera en ligne dès sa validation.</small>
          </span>
          <ChevronRight size={18} className="text-brand-600" />
        </Link>
      )}

      <nav className="card divide-y divide-gray-100 overflow-hidden dark:divide-slate-700">
        <Link to="/notifications" className={rowCls}>
          <Bell size={18} className="text-brand-600 dark:text-brand-400" />
          <span className="flex-1">Notifications</span>
          {unread > 0 && (
            <span className="rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-gray-950">{unread}</span>
          )}
          <ChevronRight size={16} className="text-gray-400" />
        </Link>
        <Link to="/suivi" className={rowCls}>
          <Package size={18} className="text-brand-600 dark:text-brand-400" />
          <span className="flex-1">Mes commandes</span>
          <ChevronRight size={16} className="text-gray-400" />
        </Link>
        <Link to="/favoris" className={rowCls}>
          <Heart size={18} className="text-red-500" />
          <span className="flex-1">Mes favoris</span>
          <ChevronRight size={16} className="text-gray-400" />
        </Link>
      </nav>

      <section>
        <h2 className="mb-2 text-sm font-bold tracking-wide text-gray-500 uppercase dark:text-slate-400">
          Boutiques suivies
        </h2>
        {follows === null ? (
          <div className="skeleton h-16" />
        ) : follows.length === 0 ? (
          <p className="card p-4 text-sm muted">
            Vous ne suivez encore aucune boutique.{" "}
            <Link to="/boutiques" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Découvrir les boutiques
            </Link>
          </p>
        ) : (
          <div className="card divide-y divide-gray-100 overflow-hidden dark:divide-slate-700">
            {follows.map((s) => (
              <Link key={s.id} to={`/b/${s.slug}`} className={rowCls}>
                <ShopAvatar shop={s} className="h-9 w-9 text-sm" />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <details className="card p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <Settings size={17} className="text-gray-500" />
          Paramètres du compte
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save({ name }, "Nom enregistré.");
            }}
            className="flex flex-col gap-2"
          >
            <span className="label">Nom affiché</span>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
              <button type="submit" className="btn-primary shrink-0">
                Enregistrer
              </button>
            </div>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(passwords, "Mot de passe changé.");
            }}
            className="flex flex-col gap-2"
          >
            <span className="label">Changer de mot de passe</span>
            <PasswordInput
              value={passwords.current_password}
              onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
              autoComplete="current-password"
              placeholder="Mot de passe actuel"
            />
            <PasswordInput
              value={passwords.new_password}
              onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
              autoComplete="new-password"
              placeholder="Nouveau mot de passe (6 caractères min.)"
            />
            <button type="submit" className="btn-outline w-fit px-4 py-2 text-sm">
              Changer le mot de passe
            </button>
          </form>
          {message && (
            <p className={`text-sm font-medium ${message.ok ? "text-green-600" : "text-red-600"}`}>{message.text}</p>
          )}
        </div>
      </details>

      <button
        onClick={logout}
        className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        <LogOut size={17} />
        Se déconnecter
      </button>
    </div>
  );
}
