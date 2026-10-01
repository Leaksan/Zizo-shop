import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";
import { setSiteSoundsOff } from "../sounds";

const ShopContext = createContext(null);

const DEFAULTS = {
  shop_name: "241 Shop",
  shop_phone: "",
  currency: "XAF",
  delivery_fee: 0,
  free_shipping_threshold: 0,
  zones: [],
  zone_fees: {},
};

export function ShopProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  const reload = () => {
    api
      .get("/settings/public")
      .then((s) => {
        setSettings({ ...DEFAULTS, ...s });
        setSiteSoundsOff(s.sounds_off); // sons coupés par l'admin pour tout le monde
      })
      .catch(() => {});
  };

  useEffect(reload, []);

  const value = {
    shopName: settings.shop_name,
    shopPhone: settings.shop_phone || "",
    pickupAddress: settings.pickup_address || "",
    currency: settings.currency || "XAF",
    deliveryFee: Number(settings.delivery_fee) || 0,
    freeShippingThreshold: Number(settings.free_shipping_threshold) || 0,
    zones: settings.zones || [],
    zoneFees: settings.zone_fees || {},
    clearanceCount: Number(settings.clearance_count) || 0,
    lowStockThreshold: Number(settings.low_stock_threshold) || 5,
    // Envoi entre villes : frais ajoutés à la livraison, délai annoncé
    intercityFee: Number(settings.intercity_fee) || 0,
    intercityDelay: settings.intercity_delay || "",
    siteSoundsOff: settings.sounds_off || [],
    reload,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  return useContext(ShopContext);
}
