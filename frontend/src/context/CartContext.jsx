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
          emoji: product.emoji,
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
    const result = await api.post("/promo/validate", { code });
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
