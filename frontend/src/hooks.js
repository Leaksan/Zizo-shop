import { useEffect, useRef } from "react";

export function usePolling(callback, ms = 15000, deps = []) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (!ms) return undefined;
    const t = setInterval(() => saved.current(), ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
