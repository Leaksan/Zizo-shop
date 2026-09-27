import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatPrice } from "../../format";
import { useShop } from "../../context/ShopContext";
import { usePolling } from "../../hooks";
import ProductVisual from "../../components/ProductVisual";

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currency } = useShop();

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api
      .get("/admin/products")
      .then(setProducts)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(load, []);
  usePolling(() => load(true), 30000);

  const toggleActive = async (p) => {
    await api.put(`/admin/products/${p.id}`, { active: !p.active });
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Supprimer « ${p.name} » définitivement ?`)) return;
    await api.del(`/admin/products/${p.id}`);
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produits</h1>
        <Link to="/admin/products/new" className="btn-primary">
          + Nouveau produit
        </Link>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm muted">Chargement…</p>
        ) : products.length === 0 ? (
          <p className="p-4 text-sm muted">Aucun produit. Créez-en un !</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-slate-700 dark:text-slate-400">
                <th className="p-4 font-medium">Produit</th>
                <th className="p-4 font-medium">Catégorie</th>
                <th className="p-4 font-medium">Prix</th>
                <th className="p-4 font-medium">Variantes</th>
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
                        <ProductVisual product={p} size="text-xl" width={160} />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {p.clearance && <span title="Liquidation">🔥 </span>}
                          {p.name}
                        </p>
                        {p.badge && (
                          <span className="text-xs font-semibold text-brand-500">{p.badge}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-slate-300">{p.category || "—"}</td>
                  <td className="p-4">
                    {p.price_min === p.price_max
                      ? formatPrice(p.price_min, currency)
                      : `${formatPrice(p.price_min, currency)} – ${formatPrice(p.price_max, currency)}`}
                  </td>
                  <td className="p-4 text-gray-600 dark:text-slate-300">{p.variants.length}</td>
                  <td className="p-4">
                    <span
                      className={
                        p.total_stock === 0
                          ? "font-semibold text-red-600"
                          : "text-gray-700 dark:text-slate-300"
                      }
                    >
                      {p.total_stock}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.active
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {p.active ? "Actif" : "Masqué"}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Link to={`/admin/products/${p.id}/edit`} className="btn-outline">
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
        )}
      </div>
    </div>
  );
}
