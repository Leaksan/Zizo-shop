import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const ShopContext = createContext(null);

const DEFAULTS = {
  shop_name: "MaBoutique",
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
      .then((s) => setSettings({ ...DEFAULTS, ...s }))
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
    reload,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  return useContext(ShopContext);
}
