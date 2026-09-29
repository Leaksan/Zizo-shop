import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

// Compte client / vendeur (téléphone + mot de passe, session côté serveur)
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined : vérification en cours · null : pas connecté · objet : connecté
  const [user, setUser] = useState(undefined);

  const refresh = useCallback(
    () =>
      api
        .get("/auth/me")
        .then((r) => setUser(r.user))
        .catch(() => setUser(null)),
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = {
    user,
    loading: user === undefined,
    refresh,
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
