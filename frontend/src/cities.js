// Villes livrées : un quartier s'écrit « Ville · Quartier », sauf à Libreville (ville d'origine).
// Mêmes règles que zone_city (backend/models.py).
export const HOME_CITY = "Libreville";
const SEP = " · ";

export function zoneCity(zone) {
  return zone && zone.includes(SEP) ? zone.split(SEP)[0].trim() || HOME_CITY : HOME_CITY;
}

// Nom du quartier seul : « Port-Gentil · Balise » -> « Balise »
export function zoneName(zone) {
  return zone && zone.includes(SEP) ? zone.slice(zone.indexOf(SEP) + SEP.length) : zone || "";
}

// Villes présentes dans la liste des quartiers, Libreville d'abord
export function citiesOf(zones) {
  const cities = [...new Set(zones.map(zoneCity))];
  return cities.sort((a, b) => (a === HOME_CITY ? -1 : b === HOME_CITY ? 1 : a.localeCompare(b, "fr")));
}

// « Libreville et Port-Gentil » : les villes livrées, pour les textes du site
export function citiesLabel(zones) {
  const cities = citiesOf(zones);
  if (cities.length < 2) return cities[0] || HOME_CITY;
  return `${cities.slice(0, -1).join(", ")} et ${cities[cities.length - 1]}`;
}

export function zonesOf(zones, city) {
  return zones.filter((z) => zoneCity(z) === city);
}

// Centres approximatifs, pour reconnaître la ville d'une position GPS
const CENTERS = { Libreville: [0.4162, 9.4673], "Port-Gentil": [-0.7193, 8.7815] };

export function nearestCity(position, cities) {
  let best = null;
  let bestDistance = Infinity;
  for (const city of cities) {
    const center = CENTERS[city];
    if (!center || !position) continue;
    const distance = (center[0] - position.latitude) ** 2 + (center[1] - position.longitude) ** 2;
    if (distance < bestDistance) {
      best = city;
      bestDistance = distance;
    }
  }
  return best;
}
