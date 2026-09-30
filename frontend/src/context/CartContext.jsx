import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const CartContext = createContext(null);

const STORAGE_KEY = "shop_cart";
const PROMO_KEY = "shop_promo";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [promo, setPromo] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROMO_KEY));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Le panier est conservé dans le navigateur : au chargement, on reprend les prix
  // et stocks actuels (le serveur facture toujours le prix du jour) et on retire
  // les articles qui ne sont plus en vente.
  useEffect(() => {
    if (items.length === 0) return;
    api
      .get("/products")
      .then((products) => {
        const variants = new Map();
        for (const p of products) for (const v of p.variants) variants.set(v.id, { p, v });
        setItems((prev) =>
          prev
            .filter((i) => variants.has(i.variant_id))
            .map((i) => {
              const { p, v } = variants.get(i.variant_id);
              return {
                ...i,
                product_name: p.name,
                variant_name: v.name,
                unit_price: v.price,
                image_url: p.image_url,
                category: p.category,
                shop: p.shop,
                stock: v.stock,
              };
            })
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (promo) localStorage.setItem(PROMO_KEY, JSON.stringify(promo));
    else localStorage.removeItem(PROMO_KEY);
  }, [promo]);

  const addItem = (product, variant, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant_id === variant.id);
      if (existing) {
        return prev.map((i) =>
          i.variant_id === variant.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          variant_id: variant.id,
          product_id: product.id,
          product_name: product.name,
          variant_name: variant.name,
          unit_price: variant.price,
          image_url: product.image_url,
          category: product.category,
          // Boutique du produit : le panier est découpé en une commande par boutique
          shop: product.shop,
          stock: variant.stock,
          quantity,
        },
      ];
    });
  };

  const updateQuantity = (variantId, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.variant_id !== variantId)
        : prev.map((i) => (i.variant_id === variantId ? { ...i, quantity } : i))
    );
  };

  const removeItem = (variantId) =>
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));

  const clearCart = () => {
    setItems([]);
    setPromo(null);
  };

  const applyPromo = async (code) => {
    // Les codes de la plateforme ne portent que sur les produits de la boutique officielle
    const subtotalNow = items
      .filter((i) => i.shop?.official)
      .reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const result = await api.post("/promo/validate", { code, subtotal: subtotalNow });
    setPromo(result);
    return result;
  };

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [items]
  );
  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        promo,
        applyPromo,
        clearPromo: () => setPromo(null),
        subtotal,
        count,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
