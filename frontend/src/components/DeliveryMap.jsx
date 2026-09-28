import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LIBREVILLE_CENTER } from "../libreville";
import { destinationIcon } from "../mapIcons";

export default function DeliveryMap({ position, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current).setView(LIBREVILLE_CENTER, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (position) {
      if (markerRef.current) markerRef.current.setLatLng(position);
      else markerRef.current = L.marker(position, { icon: destinationIcon(36) }).addTo(map);
      map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [position]);

  return (
    <div
      ref={containerRef}
      className="z-0 h-64 w-full overflow-hidden rounded-xl border border-gray-300 dark:border-slate-600"
    />
  );
}
