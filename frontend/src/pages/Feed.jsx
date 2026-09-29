import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Newspaper, PenSquare, Store, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import PostCard from "../components/PostCard";

const TABS = [
  { key: "all", label: "Pour vous" },
  { key: "following", label: "Abonnements" },
];

// Fil d'actu commun : publications des vendeurs et nouveautés automatiques des boutiques
export default function Feed() {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [posts, setPosts] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    (nextPage) =>
      api.get(`/feed?tab=${tab}&page=${nextPage}`).then((r) => {
        setPosts((prev) => (nextPage === 0 ? r.posts : [...(prev || []), ...r.posts]));
        setHasMore(r.has_more);
        setPage(nextPage);
      }),
    [tab]
  );

  useEffect(() => {
    setPosts(null);
    if (tab === "following" && !user) return;
    load(0).catch(() => setPosts([]));
  }, [tab, user, load]);

  const more = async () => {
    setLoadingMore(true);
    try {
      await load(page + 1);
    } finally {
      setLoadingMore(false);
    }
  };

  // Abonnement depuis une publication : toutes celles de la boutique passent à « suivie »
  const followed = (slug) =>
    setPosts((list) => list.map((p) => (p.shop.slug === slug ? { ...p, following: true } : p)));

  const tabCls = (active) =>
    `flex-1 rounded-lg py-2 text-sm font-semibold transition ${
      active ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300" : "text-gray-500"
    }`;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="flex flex-1 items-center gap-2 text-2xl font-bold">
          <Newspaper size={24} className="text-brand-600 dark:text-brand-400" />
          Fil d'actu
        </h1>
        {user?.shop && (
          <Link to="/vendeur/publications" className="btn-primary inline-flex items-center gap-1.5">
            <PenSquare size={16} /> Publier
          </Link>
        )}
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-slate-800">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tabCls(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "following" && !user ? (
        <Empty
          icon={UserRound}
          title="Suivez vos boutiques préférées"
          text="Connectez-vous pour retrouver ici les publications des boutiques que vous suivez."
          to="/compte?suite=/fil"
          action="Se connecter"
        />
      ) : posts === null ? (
        Array.from({ length: 2 }, (_, i) => <div key={i} className="skeleton h-96" />)
      ) : posts.length === 0 ? (
        tab === "following" ? (
          <Empty
            icon={Store}
            title="Aucune publication pour l'instant"
            text="Suivez des boutiques : leurs nouveautés et leurs publications apparaîtront ici."
            to="/boutiques"
            action="Découvrir les boutiques"
          />
        ) : (
          <Empty icon={Newspaper} title="Le fil est encore calme" text="Les nouveautés des boutiques apparaîtront ici." to="/boutique" action="Voir les produits" />
        )
      ) : (
        <>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onFollow={followed} />
          ))}
          {hasMore && (
            <button onClick={more} disabled={loadingMore} className="btn-outline mx-auto px-6 py-2.5 text-sm">
              {loadingMore ? "Chargement…" : "Voir plus"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Empty({ icon: Icon, title, text, to, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <Icon size={36} className="text-gray-300 dark:text-slate-600" strokeWidth={1.5} />
      <p className="font-semibold">{title}</p>
      <p className="text-sm muted">{text}</p>
      <Link to={to} className="btn-primary px-5 py-2.5">
        {action}
      </Link>
    </div>
  );
}
