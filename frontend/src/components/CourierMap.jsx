import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { LIBREVILLE_CENTER } from "../libreville";
import { fetchRoute } from "../routing";

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const courierIcon = L.divIcon({
  className: "",
  html: '<div style="width:34px;height:34px;border-radius:50%;background:#4f46e5;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px">🛵</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export default function CourierMap({ courierPos, deliveries }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const destLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current).setView(LIBREVILLE_CENTER, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    destLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (courierPos) {
      if (courierMarkerRef.current) courierMarkerRef.current.setLatLng(courierPos);
      else {
        courierMarkerRef.current = L.marker(courierPos, { icon: courierIcon })
          .addTo(map)
          .bindTooltip("Vous êtes ici", { permanent: false });
      }
    }
  }, [courierPos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    destLayerRef.current.clearLayers();
    routeLayerRef.current.clearLayers();
    setRouteInfo(null);

    const targets = deliveries.filter((d) => d.latitude != null && d.longitude != null);
    const bounds = [];
    if (courierPos) bounds.push(courierPos);

    targets.forEach((d) => {
      const pos = [d.latitude, d.longitude];
      bounds.push(pos);
      L.marker(pos)
        .addTo(destLayerRef.current)
        .bindTooltip(`${d.reference} · ${d.customer_name} (${d.zone})`);
    });

    if (courierPos && targets.length > 0) {
      (async () => {
        const infos = [];
        for (const d of targets) {
          const route = await fetchRoute(courierPos, [d.latitude, d.longitude]);
          if (route && routeLayerRef.current) {
            L.polyline(route.points, { color: "#4f46e5", weight: 5, opacity: 0.75 })
              .addTo(routeLayerRef.current)
              .bindTooltip(`${d.reference} : ${route.distanceKm} km · ~${route.durationMin} min`);
            infos.push({ ref: d.reference, ...route });
          }
        }
        setRouteInfo(infos.length ? infos : null);
      })();
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.25));
    }
  }, [courierPos, deliveries]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="z-0 h-80 w-full overflow-hidden rounded-xl border border-gray-300 dark:border-slate-600"
      />
      {routeInfo && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold shadow dark:bg-slate-800/95">
          {routeInfo.map((r) => (
            <span key={r.ref}>
              🛵 {r.ref} : {r.distanceKm} km · ~{r.durationMin} min
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
