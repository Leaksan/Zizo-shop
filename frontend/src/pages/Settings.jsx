import { useState } from "react";
import { Moon, Settings as SettingsIcon, Sun, Volume2, VolumeX } from "lucide-react";
import Switch from "../components/Switch";
import { useShop } from "../context/ShopContext";
import { useTheme } from "../context/ThemeContext";
import { getSoundPrefs, play, setSoundPrefs, SOUNDS } from "../sounds";

// Réglages de cet appareil (rien n'est envoyé au serveur) : apparence et sons, un par un
export default function Settings() {
  const { theme, toggle } = useTheme();
  const { siteSoundsOff } = useShop();
  const [prefs, setPrefs] = useState(getSoundPrefs);

  const save = (next) => {
    setPrefs(next);
    setSoundPrefs(next);
  };
  // Les sons coupés par la boutique pour tout le monde ne sont pas proposés
  const sounds = SOUNDS.filter((s) => !siteSoundsOff.includes(s.key));
  const sectionTitle = "px-4 pt-4 pb-2 text-xs font-bold tracking-wide text-gray-500 uppercase dark:text-slate-400";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <SettingsIcon size={24} className="text-brand-600 dark:text-brand-400" /> Paramètres
        </h1>
        <p className="mt-1 text-sm muted">Réglages de ce téléphone (ou de cet ordinateur).</p>
      </div>

      <section className="card">
        <h2 className={sectionTitle}>Apparence</h2>
        <div className="flex items-center gap-3 px-4 pb-4">
          {theme === "dark" ? <Moon size={20} className="text-brand-600 dark:text-brand-400" /> : <Sun size={20} className="text-brand-600" />}
          <span className="flex-1 text-sm font-medium">Mode sombre</span>
          <Switch checked={theme === "dark"} onChange={toggle} label="Mode sombre" />
        </div>
      </section>

      <section className="card">
        <h2 className={sectionTitle}>Sons</h2>
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 pb-4 dark:border-slate-700">
          {prefs.muted ? (
            <VolumeX size={20} className="text-gray-400" />
          ) : (
            <Volume2 size={20} className="text-brand-600 dark:text-brand-400" />
          )}
          <span className="flex-1">
            <b className="block text-sm">Sons du site</b>
            <small className="text-xs muted">De petits sons quand vous agissez : panier, commande…</small>
          </span>
          <Switch checked={!prefs.muted} onChange={(on) => save({ ...prefs, muted: !on })} label="Sons du site" />
        </div>
        {sounds.length === 0 ? (
          <p className="p-4 text-sm muted">Aucun son sur ce site.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700">
            {sounds.map((sound) => (
              <li key={sound.key} className="flex items-center gap-2 px-2 py-1.5 pr-4">
                <button
                  type="button"
                  onClick={() => play(sound.key, { force: true })}
                  className="rounded-lg p-2.5 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950"
                  aria-label={`Écouter : ${sound.label}`}
                  title="Écouter"
                >
                  <Volume2 size={17} />
                </button>
                <span className={`flex-1 text-sm ${prefs.muted ? "muted" : ""}`}>{sound.label}</span>
                <Switch
                  checked={!prefs.muted && !prefs.off.includes(sound.key)}
                  disabled={prefs.muted}
                  label={sound.label}
                  onChange={(on) =>
                    save({
                      ...prefs,
                      off: on ? prefs.off.filter((k) => k !== sound.key) : [...prefs.off, sound.key],
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
