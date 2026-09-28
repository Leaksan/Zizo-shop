import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bike } from "lucide-react";
import { LIBREVILLE_CENTER } from "../libreville";
import { courierIcon, destinationIcon, ROUTE_COLOR } from "../mapIcons";
import { fetchRoute } from "../routing";

export default function TrackingMap({ courierPos, destPos }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const [routeInfo, setRouteInfo] = useState(null);

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current).setView(LIBREVILLE_CENTER, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
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
    if (destPos && !destMarkerRef.current) {
      destMarkerRef.current = L.marker(destPos, { icon: destinationIcon() })
        .addTo(map)
        .bindTooltip("Adresse de livraison")
        .openTooltip();
    }
  }, [destPos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (courierPos) {
      if (courierMarkerRef.current) courierMarkerRef.current.setLatLng(courierPos);
      else {
        courierMarkerRef.current = L.marker(courierPos, { icon: courierIcon() })
          .addTo(map)
          .bindTooltip("Votre livreur");
      }
    }

    const bounds = [];
    if (courierPos) bounds.push(courierPos);
    if (destPos) bounds.push(destPos);
    if (bounds.length > 0) map.fitBounds(L.latLngBounds(bounds).pad(0.3));

    if (courierPos && destPos) {
      routeLayerRef.current.clearLayers();
      fetchRoute(courierPos, destPos).then((route) => {
        if (route && routeLayerRef.current) {
          L.polyline(route.points, { color: ROUTE_COLOR, weight: 5, opacity: 0.75 }).addTo(
            routeLayerRef.current
          );
          setRouteInfo(route);
        }
      });
    }
  }, [courierPos, destPos]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="z-0 h-72 w-full overflow-hidden rounded-xl border border-gray-300 dark:border-slate-600"
      />
      {routeInfo && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold shadow dark:bg-slate-800/95">
          <Bike size={14} className="text-brand-600 dark:text-brand-400" />
          Le livreur est à {routeInfo.distanceKm} km · ~{routeInfo.durationMin} min
        </div>
      )}
    </div>
  );
}
