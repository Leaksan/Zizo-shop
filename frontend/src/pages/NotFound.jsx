import { Link } from "react-router-dom";
import { Home, SearchX, Store } from "lucide-react";

// Adresse inconnue (lien mal copié, ancienne page…) : proposer une sortie plutôt qu'une page vide
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <SearchX size={48} className="mx-auto text-gray-300 dark:text-slate-600" strokeWidth={1.2} />
      <h1 className="mt-4 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-sm muted">
        Cette page n'existe pas ou n'existe plus. Le lien a peut-être été mal copié.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/boutique" className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-2.5">
          <Store size={17} />
          Voir la boutique
        </Link>
        <Link to="/" className="btn-outline inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm">
          <Home size={16} />
          Accueil
        </Link>
      </div>
    </div>
  );
}
