// Tous les lieux s'ouvrent dans Google Maps (l'appli sur téléphone, le site sur ordinateur) :
// pas de carte dans le site. Les positions GPS viennent du téléphone, avec l'autorisation
// de la personne (« Utiliser ma position »).
import { zoneCity, zoneName } from "./cities";

const BASE = "https://www.google.com/maps";

export function hasCoords(place) {
  return place?.latitude != null && place?.longitude != null;
}

// Un point : la position GPS si on l'a, sinon l'adresse écrite, cherchée dans la ville du
// quartier (« Port-Gentil · Balise » -> « …, Balise, Port-Gentil, Gabon »)
function point(place) {
  if (hasCoords(place)) return `${place.latitude},${place.longitude}`;
  const text = [place?.address, zoneName(place?.zone)].filter(Boolean).join(", ");
  return text ? `${text}, ${zoneCity(place?.zone)}, Gabon` : "";
}

// Lien « voir sur Google Maps » (null s'il n'y a ni position ni adresse)
export function mapsUrl(place) {
  const query = point(place);
  return query ? `${BASE}/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

// Itinéraire depuis l'endroit où l'on est, avec une étape éventuelle (récupérer un colis)
export function directionsUrl(destination, via) {
  const target = point(destination);
  if (!target) return null;
  const params = new URLSearchParams({ api: "1", destination: target, travelmode: "driving" });
  const stop = via && point(via);
  if (stop) params.set("waypoints", stop);
  return `${BASE}/dir/?${params}`;
}

// Distance à vol d'oiseau en km (« à environ 2,3 km »)
export function distanceKm(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Position actuelle du téléphone : le navigateur demande l'autorisation la première fois
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("La localisation ne marche que sur le site sécurisé (adresse en https)."));
      return;
    }
    if (!("geolocation" in navigator)) {
      reject(new Error("Ce navigateur ne sait pas donner votre position."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? "Localisation refusée. Autorisez-la pour ce site dans les réglages du navigateur, ou décrivez bien l'adresse et un point de repère."
              : err.code === 3
                ? "Votre position met trop de temps à arriver : réessayez, de préférence dehors ou près d'une fenêtre."
                : "Position introuvable pour le moment : vérifiez que la localisation du téléphone est activée."
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}
