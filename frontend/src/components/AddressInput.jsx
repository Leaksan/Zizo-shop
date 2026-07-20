import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { searchPlaces } from "../libreville";

export default function AddressInput({ value, onChange, onPick, required = true }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [remote, setRemote] = useState([]);
  const boxRef = useRef(null);

  const local = searchPlaces(value);
  const suggestions = remote.length > 0 ? remote : local;

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) {
      setRemote([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get(`/geocode/search?q=${encodeURIComponent(q)}`)
        .then((results) => setRemote(results))
        .catch(() => setRemote([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [value]);

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
        placeholder="Ex. Glass, Akébé, Marché Mont-Bouët…"
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
                    ? "bg-indigo-50 dark:bg-slate-700"
                    : "hover:bg-gray-50 dark:hover:bg-slate-700"
                }`}
              >
                <span>📍</span>
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
