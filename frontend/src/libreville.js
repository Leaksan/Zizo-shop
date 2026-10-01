export const LIBREVILLE_PLACES = [
  { name: "Centre-ville, Libreville", zone: "Centre-ville", lat: 0.3921, lng: 9.4536 },
  { name: "Marché Mont-Bouët", zone: "Mont-Bouët", lat: 0.3953, lng: 9.4564 },
  { name: "Mont-Bouët, Libreville", zone: "Mont-Bouët", lat: 0.3972, lng: 9.4568 },
  { name: "Glass, Libreville", zone: "Glass", lat: 0.4067, lng: 9.4608 },
  { name: "Oloumi, Libreville", zone: "Oloumi", lat: 0.4039, lng: 9.4479 },
  { name: "Marché d'Oloumi", zone: "Oloumi", lat: 0.4045, lng: 9.4485 },
  { name: "Quartier Louis, Libreville", zone: "Quartier Louis", lat: 0.3865, lng: 9.45 },
  { name: "Batterie IV, Libreville", zone: "Batterie IV", lat: 0.381, lng: 9.4523 },
  { name: "Akébé, Libreville", zone: "Akébé", lat: 0.3667, lng: 9.4833 },
  { name: "Nzeng-Ayong, Libreville", zone: "Nzeng-Ayong", lat: 0.3367, lng: 9.505 },
  { name: "Lalala, Libreville", zone: "Lalala", lat: 0.36, lng: 9.4667 },
  { name: "Ozoungué, Libreville", zone: "Ozoungué", lat: 0.3714, lng: 9.454 },
  { name: "Alibandeng, Libreville", zone: "Alibandeng", lat: 0.36, lng: 9.46 },
  { name: "La Sablière, Libreville", zone: "La Sablière", lat: 0.4, lng: 9.43 },
  { name: "Angondjé, Libreville", zone: "Angondjé", lat: 0.4667, lng: 9.4167 },
  { name: "Aéroport Léon Mba", zone: "Angondjé", lat: 0.4586, lng: 9.4123 },
  { name: "Stade d'Angondjé", zone: "Angondjé", lat: 0.4625, lng: 9.41 },
  { name: "CHU d'Angondjé", zone: "Angondjé", lat: 0.465, lng: 9.415 },
  { name: "Owendo", zone: "Owendo", lat: 0.2967, lng: 9.5017 },
  { name: "Port d'Owendo", zone: "Owendo", lat: 0.29, lng: 9.505 },
  { name: "Gare d'Owendo (SETRAG)", zone: "Owendo", lat: 0.2983, lng: 9.5 },
  { name: "Nkok, Libreville", zone: "Nkok", lat: 0.32, lng: 9.5833 },
  { name: "Zone économique de Nkok", zone: "Nkok", lat: 0.315, lng: 9.59 },
  { name: "Cap Estérias", zone: "Cap Estérias", lat: 0.6, lng: 9.35 },
  { name: "Université Omar Bongo", zone: "Centre-ville", lat: 0.4183, lng: 9.445 },
  { name: "Camp de Gaulle, Libreville", zone: "Centre-ville", lat: 0.415, lng: 9.447 },
  { name: "PK5, Libreville", zone: "Akébé", lat: 0.3667, lng: 9.4667 },
  { name: "PK8, Libreville", zone: "Lalala", lat: 0.35, lng: 9.4767 },
  { name: "PK12, Libreville", zone: "Nzeng-Ayong", lat: 0.3333, lng: 9.49 },
  { name: "Front de mer, Libreville", zone: "La Sablière", lat: 0.405, lng: 9.435 },
];

export function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function searchPlaces(query, limit = 6) {
  const q = normalize(query).trim();
  if (q.length < 2) return [];
  return LIBREVILLE_PLACES.filter((p) => normalize(p.name).includes(q)).slice(0, limit);
}
