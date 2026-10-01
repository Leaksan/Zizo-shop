// Petits sons du site, fabriqués par le navigateur (Web Audio) : aucun fichier à télécharger.
// Chaque son peut être coupé pour tout le site (Admin > Paramètres) ou sur cet appareil
// (page « Paramètres »). Mêmes clés que SOUND_KEYS (backend/models.py).
export const SOUNDS = [
  { key: "panier", label: "Ajout au panier" },
  { key: "retrait", label: "Retrait du panier" },
  { key: "favori", label: "Ajout aux favoris" },
  { key: "commande", label: "Commande validée" },
  { key: "promo", label: "Code promo appliqué" },
  { key: "suivre", label: "Abonnement à une boutique" },
  { key: "notification", label: "Nouvelle notification" },
  { key: "vente", label: "Nouvelle commande reçue (vendeur, admin)" },
  { key: "course", label: "Nouvelle course disponible (livreur)" },
];

const STORAGE_KEY = "shop_sounds";
let siteOff = new Set(); // coupés par l'admin pour tout le monde

export function setSiteSoundsOff(keys) {
  siteOff = new Set(keys || []);
}

export function isSiteSoundOff(key) {
  return siteOff.has(key);
}

// Réglages de cet appareil : tout couper (muted) ou certains sons seulement (off)
export function getSoundPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { muted: Boolean(prefs?.muted), off: Array.isArray(prefs?.off) ? prefs.off : [] };
  } catch {
    return { muted: false, off: [] };
  }
}

export function setSoundPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // stockage indisponible (navigation privée) : réglage gardé le temps de la visite seulement
  }
}

let context = null;
function audio() {
  if (context) return context;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  context = new AudioContextClass();
  return context;
}

// Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur : on le « débloque » au
// premier toucher, pour que les sons qui arrivent plus tard (nouvelle commande) puissent jouer.
if (typeof window !== "undefined") {
  const unlock = () => {
    const ac = audio();
    if (ac?.state === "suspended") ac.resume().catch(() => {});
  };
  for (const type of ["pointerdown", "touchend", "click", "keydown"]) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

// Une note : fréquence (Hz), départ et durée (s), timbre, volume, glissando éventuel
function tone(ac, { freq, start = 0, duration = 0.15, type = "sine", volume = 0.15, slideTo }) {
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

const RECIPES = {
  // « pop » montant : un article tombe dans le panier
  panier: (ac) => {
    tone(ac, { freq: 660, duration: 0.09, type: "triangle", volume: 0.18 });
    tone(ac, { freq: 990, start: 0.07, duration: 0.13, type: "triangle", volume: 0.16 });
  },
  // glissé descendant : un article sort du panier
  retrait: (ac) => tone(ac, { freq: 520, duration: 0.16, type: "triangle", slideTo: 280, volume: 0.15 }),
  // petite cloche douce
  favori: (ac) => {
    tone(ac, { freq: 880, duration: 0.3, volume: 0.12 });
    tone(ac, { freq: 1320, start: 0.04, duration: 0.35, volume: 0.06 });
  },
  // arpège joyeux : commande passée
  commande: (ac) =>
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone(ac, { freq, start: i * 0.09, duration: 0.24, type: "triangle", volume: 0.15 })
    ),
  // deux bips brillants : remise accordée
  promo: (ac) => {
    tone(ac, { freq: 784, duration: 0.1, type: "square", volume: 0.05 });
    tone(ac, { freq: 1175, start: 0.08, duration: 0.18, type: "square", volume: 0.05 });
  },
  // montée courte : « je suis cette boutique »
  suivre: (ac) => tone(ac, { freq: 600, duration: 0.14, slideTo: 950, volume: 0.13 }),
  // « ding-dong »
  notification: (ac) => {
    tone(ac, { freq: 1046.5, duration: 0.32, volume: 0.13 });
    tone(ac, { freq: 784, start: 0.16, duration: 0.45, volume: 0.13 });
  },
  // tiroir-caisse : une vente arrive
  vente: (ac) => {
    tone(ac, { freq: 1568, duration: 0.07, type: "square", volume: 0.04 });
    tone(ac, { freq: 2093, start: 0.05, duration: 0.28, type: "triangle", volume: 0.11 });
    tone(ac, { freq: 2637, start: 0.12, duration: 0.4, volume: 0.09 });
  },
  // sonnette : une course attend un livreur
  course: (ac) =>
    [880, 1108.73, 880, 1108.73].forEach((freq, i) =>
      tone(ac, { freq, start: i * 0.12, duration: 0.1, type: "triangle", volume: 0.13 })
    ),
};

/**
 * Joue un son, sauf s'il est coupé (pour tout le site ou sur cet appareil).
 * force : l'écouter quand même (bouton « Écouter » des réglages).
 */
export function play(key, { force = false } = {}) {
  if (!force) {
    if (siteOff.has(key)) return;
    const prefs = getSoundPrefs();
    if (prefs.muted || prefs.off.includes(key)) return;
  }
  const recipe = RECIPES[key];
  const ac = recipe && audio();
  if (!ac) return;
  if (ac.state === "running") recipe(ac);
  // Pendant un geste de l'utilisateur seulement : sinon le son partirait bien plus tard
  else if (navigator.userActivation?.isActive) {
    ac.resume()
      .then(() => recipe(ac))
      .catch(() => {});
  }
}
