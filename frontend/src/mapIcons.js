import L from "leaflet";

// Marqueurs des cartes. Leaflet attend du HTML en texte (pas de composant React) :
// icônes lucide « bike », « map-pin » et « store » en SVG, dans une pastille aux couleurs de la marque.
const svg = (size, stroke, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const BIKE =
  '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>';
const MAP_PIN =
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>';

const STORE =
  '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>';

const bubble = (size, background, content, { border = "#fff", color = "#fff" } = {}) =>
  L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${background};border:3px solid ${border};color:${color};box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">${content}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2, 0],
  });

// Livreur : pastille émeraude avec un vélo
export const courierIcon = (size = 36) =>
  bubble(size, "var(--color-brand-600, #059669)", svg(Math.round(size / 2), "#fff", BIKE));

// Adresse de livraison : pastille ambre avec une épingle
export const destinationIcon = (size = 32) =>
  bubble(size, "var(--color-accent-400, #fbbf24)", svg(Math.round(size / 2), "#111827", MAP_PIN));

// Boutique où récupérer le colis : pastille blanche cerclée d'émeraude
export const pickupIcon = (size = 30) =>
  bubble(size, "#fff", svg(Math.round(size / 2), "currentColor", STORE), {
    border: "var(--color-brand-600, #059669)",
    color: "var(--color-brand-700, #047857)",
  });

// Tracé du trajet (attribut SVG : pas de variable CSS possible, émeraude de la marque)
export const ROUTE_COLOR = "#059669";
