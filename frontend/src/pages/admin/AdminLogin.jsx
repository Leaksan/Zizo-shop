import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/login", { password });
      navigate("/admin/dashboard");
    } catch (e2) {
      setError(e2.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 dark:bg-slate-900">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-sm p-8"
      >
        <h1 className="mb-1 text-xl font-bold">Administration</h1>
        <p className="mb-6 text-sm muted">Connectez-vous pour gérer la boutique.</p>
        <label className="mb-4 block">
          <span className="label">Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="input"
          />
        </label>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          className="btn-primary w-full py-2.5"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
