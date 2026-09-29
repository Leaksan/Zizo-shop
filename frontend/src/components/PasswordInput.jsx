import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Mot de passe avec bouton « afficher » : sur téléphone, on se trompe vite en tapant à l'aveugle
export default function PasswordInput({ value, onChange, autoComplete, placeholder, id }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="input pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute top-1/2 right-1 -translate-y-1/2 rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
