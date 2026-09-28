// Page d'arrivée « à vue unique » : montrée à la première visite seulement. Ensuite,
// l'adresse / mène directement à la boutique (la boutique est la vraie page principale).
const STORAGE_KEY = "shop_welcome_seen";

export function welcomeSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // stockage indisponible (navigation privée) : l'accueil sera simplement remontré
  }
}
