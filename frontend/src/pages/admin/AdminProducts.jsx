import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../api";
import { formatPrice } from "../../format";
import { useShop } from "../../context/ShopContext";
import { usePolling } from "../../hooks";
import ProductVisual from "../../components/ProductVisual";

// Même liste pour l'admin (tous les produits, avec leur boutique) et pour un vendeur (les siens)
const MODES = {
  admin: {
    api: "/admin/products",
    create: "/admin/products/new",
    edit: (id) => `/admin/products/${id}/edit`,
    showShop: true,
  },
  vendeur: {
    api: "/my/products",
    create: "/vendeur/produits/nouveau",
    edit: (id) => `/vendeur/produits/${id}`,
    showShop: false,
  },
};

export default function AdminProducts({ mode = "admin" }) {
  const cfg = MODES[mode];
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useShop();

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api
      .get(cfg.api)
      .then(setProducts)
      .catch(() => {})
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [mode]);
  usePolling(() => load(true), 30000, [mode]);

  const toggleActive = async (p) => {
    await api.put(`${cfg.api}/${p.id}`, { active: !p.active });
    load(true);
  };

  const remove = async (p) => {
    if (!window.confirm(`Supprimer « ${p.name} » définitivement ?`)) return;
    await api.del(`${cfg.api}/${p.id}`);
    load(true);
  };

  const price = (p) =>
    p.price_min === p.price_max
      ? formatPrice(p.price_min, currency)
      : `${formatPrice(p.price_min, currency)} – ${formatPrice(p.price_max, currency)}`;

  const statusButton = (p) => (
    <button
      onClick={() => toggleActive(p)}
      title="Afficher ou masquer ce produit"
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        p.active
          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
      }`}
    >
      {p.active ? "Visible" : "Masqué"}
    </button>
  );

  const name = (p) => (
    <p className="font-semibold">
      {p.clearance && (
        <Flame size={14} aria-label="Liquidation" className="mr-1 inline align-[-2px] text-accent-600" />
      )}
      {p.name}
    </p>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{mode === "vendeur" ? "Mes produits" : "Produits"}</h1>
        <Link to={cfg.create} className="btn-primary inline-flex items-center gap-1.5">
          <Plus size={16} />
          Nouveau produit
        </Link>
      </div>

      {loading ? (
        <div className="skeleton h-40" />
      ) : products.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">Aucun produit pour l'instant</p>
          <p className="mt-1 text-sm muted">Ajoutez votre premier produit : photo, prix, stock.</p>
        </div>
      ) : (
        <>
          {/* Téléphone : cartes (le tableau obligerait à défiler de côté) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {products.map((p) => (
              <li key={p.id} className="card flex items-center gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <ProductVisual product={p} width={160} />
                </div>
                <div className="min-w-0 flex-1">
                  {name(p)}
                  <p className="text-sm">{price(p)}</p>
                  <p className={`text-xs ${p.total_stock === 0 ? "font-semibold text-red-600" : "muted"}`}>
                    Stock : {p.total_stock}
                    {cfg.showShop && p.shop ? ` · ${p.shop.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {statusButton(p)}
                  <div className="flex gap-1">
                    <Link to={cfg.edit(p.id)} className="btn-outline p-2" aria-label={`Modifier ${p.name}`}>
                      <Pencil size={15} />
                    </Link>
                    <button onClick={() => remove(p)} className="btn-danger p-2" aria-label={`Supprimer ${p.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Grand écran : tableau */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="p-4 font-medium">Produit</th>
                  {cfg.showShop && <th className="p-4 font-medium">Boutique</th>}
                  <th className="p-4 font-medium">Catégorie</th>
                  <th className="p-4 font-medium">Prix</th>
                  <th className="p-4 font-medium">Stock</th>
                  <th className="p-4 font-medium">Statut</th>
                  <th className="p-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 dark:border-slate-700">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          <ProductVisual product={p} width={160} />
                        </div>
                        <div>
                          {name(p)}
                          {p.badge && <span className="text-xs font-semibold text-brand-500">{p.badge}</span>}
                        </div>
                      </div>
                    </td>
                    {cfg.showShop && (
                      <td className="p-4 text-gray-600 dark:text-slate-300">{p.shop?.name || "—"}</td>
                    )}
                    <td className="p-4 text-gray-600 dark:text-slate-300">{p.category || "—"}</td>
                    <td className="p-4">{price(p)}</td>
                    <td className="p-4">
                      <span className={p.total_stock === 0 ? "font-semibold text-red-600" : "text-gray-700 dark:text-slate-300"}>
                        {p.total_stock}
                      </span>
                    </td>
                    <td className="p-4">{statusButton(p)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Link to={cfg.edit(p.id)} className="btn-outline">
                          Modifier
                        </Link>
                        <button onClick={() => remove(p)} className="btn-danger">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
