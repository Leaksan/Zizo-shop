import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { usePolling } from "../hooks";
import { play } from "../sounds";

// Compte client / vendeur (téléphone + mot de passe, session côté serveur)
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined : vérification en cours · null : pas connecté · objet : connecté
  const [user, setUser] = useState(undefined);
  // Notifications non lues : pastille de la cloche, vérifiée à chaque minute
  const [unread, setUnread] = useState(0);
  const lastUnread = useRef(null);
  const loggedIn = Boolean(user);

  const refresh = useCallback(
    () =>
      api
        .get("/auth/me")
        .then((r) => setUser(r.user))
        .catch(() => setUser(null)),
    []
  );

  const refreshUnread = useCallback(
    () =>
      api
        .get("/me/notifications/count")
        .then((r) => {
          if (lastUnread.current !== null && r.unread > lastUnread.current) play("notification");
          lastUnread.current = r.unread;
          setUnread(r.unread);
        })
        .catch(() => {}),
    []
  );

  // Notifications lues (page « Notifications ») : la prochaine hausse fera de nouveau sonner
  const markRead = useCallback((n) => {
    lastUnread.current = n;
    setUnread(n);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    lastUnread.current = null; // nouveau compte : pas de son pour les notifications déjà là
    if (loggedIn) refreshUnread();
    else setUnread(0);
  }, [loggedIn, refreshUnread]);

  // Onglet en arrière-plan : pas de requête inutile
  usePolling(() => loggedIn && document.visibilityState === "visible" && refreshUnread(), 60000, [loggedIn]);

  const value = {
    user,
    loading: user === undefined,
    refresh,
    unread,
    setUnread: markRead,
    refreshUnread,
    login: async (phone, password) => setUser(await api.post("/auth/login", { phone, password })),
    register: async (form) => setUser(await api.post("/auth/register", form)),
    logout: async () => {
      await api.post("/auth/logout").catch(() => {});
      setUser(null);
    },
    update: async (changes) => setUser(await api.put("/auth/me", changes)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
