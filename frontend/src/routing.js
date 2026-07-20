const cache = new Map();

export async function fetchRoute(from, to) {
  const key = `${from[0].toFixed(4)},${from[1].toFixed(4)}|${to[0].toFixed(4)},${to[1].toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = {
      points: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: Math.round((data.routes[0].distance / 1000) * 10) / 10,
      durationMin: Math.round(data.routes[0].duration / 60),
    };
    cache.set(key, route);
    return route;
  } catch {
    return null;
  }
}
