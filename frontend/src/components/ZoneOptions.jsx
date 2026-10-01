import { citiesOf, zoneName, zonesOf } from "../cities";

// Options d'une liste de quartiers, rangées par ville (« Libreville », « Port-Gentil »…)
export default function ZoneOptions({ zones }) {
  const cities = citiesOf(zones);
  if (cities.length < 2) {
    return zones.map((z) => (
      <option key={z} value={z}>
        {zoneName(z)}
      </option>
    ));
  }
  return cities.map((city) => (
    <optgroup key={city} label={city}>
      {zonesOf(zones, city).map((z) => (
        <option key={z} value={z}>
          {zoneName(z)}
        </option>
      ))}
    </optgroup>
  ));
}
