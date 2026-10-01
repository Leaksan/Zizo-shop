import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "../api";
import { normalize, searchPlaces } from "../libreville";

export default function AddressInput({
  value,
  onChange,
  onPick,
  required = true,
  placeholder = "Ex. Glass, Akébé, Marché Mont-Bouët…",
  city = "Libreville",
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // Résultats du serveur, gardés avec la saisie qui les a demandés : ceux d'une saisie
  // précédente ne s'affichent pas pendant que la nouvelle recherche est en cours
  const [remote, setRemote] = useState({ query: "", city: "", places: [] });
  const boxRef = useRef(null);

  const query = value.trim();
  const local = searchPlaces(value, city);
  const fresh = remote.query === query && remote.city === city ? remote.places : [];
  // Quartiers connus d'abord, puis les lieux trouvés par la recherche (sans doublon)
  const known = new Set(local.map((p) => normalize(p.name)));
  const suggestions = [...local, ...fresh.filter((p) => !known.has(normalize(p.name)))].slice(0, 6);

  useEffect(() => {
    if (query.length < 3) return undefined;
    const timer = setTimeout(() => {
      api
        .get(`/geocode/search?q=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`)
        .then((places) => setRemote({ query, city, places }))
        .catch(() => setRemote({ query, city, places: [] }));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, city]);

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (place) => {
    onChange(place.name);
    onPick(place);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="input"
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {suggestions.map((p, i) => (
            <li key={`${p.name}-${i}`}>
              <button
                type="button"
                onClick={() => pick(p)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === highlight
                    ? "bg-brand-50 dark:bg-slate-700"
                    : "hover:bg-gray-50 dark:hover:bg-slate-700"
                }`}
              >
                <MapPin size={15} className="shrink-0 text-brand-600 dark:text-brand-400" />
                <span className="flex-1">{p.name}</span>
                {p.zone && <span className="text-xs muted">{p.zone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
