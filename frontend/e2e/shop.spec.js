import { test, expect } from "@playwright/test";

const settings = {
  shop_name: "241 Shop",
  shop_phone: "241077123456",
  currency: "XAF",
  delivery_fee: 1500,
  free_shipping_threshold: 30000,
  zones: ["Glass", "Owendo"],
  zone_fees: { Glass: 1500, Owendo: 3000 },
  pickup_address: "Boutique, avenue de la République",
  clearance_count: 1,
};
const simple = {
  id: 1,
  name: "Sac de voyage",
  category_id: 1,
  category: "Mode",
  description: "Un sac léger pour tous les jours.",
  price_min: 10000,
  price_max: 10000,
  total_stock: 8,
  badge: "Promo",
  promo_percent: 20,
  clearance: true,
  rating: 4.5,
  reviews_count: 10,
  real_reviews_count: 0,
  created_at: "2026-10-01T12:00:00Z",
  variants: [
    { id: 11, name: "Standard", price: 10000, old_price: 12500, stock: 8 },
  ],
};
const multi = {
  ...simple,
  id: 2,
  name: "T-shirt coton",
  clearance: false,
  badge: "",
  price_min: 5000,
  price_max: 6500,
  total_stock: 5,
  variants: [
    { id: 21, name: "M", price: 5000, stock: 3 },
    { id: 22, name: "L", price: 6500, stock: 2 },
    { id: 23, name: "XL", price: 6500, stock: 0 },
  ],
};
const exhausted = {
  ...simple,
  id: 3,
  name: "Lampe",
  category_id: 2,
  category: "Maison",
  total_stock: 0,
  variants: [{ id: 31, name: "Standard", price: 10000, stock: 0 }],
};
const percentPromo = {
  code: "REDUC10",
  type: "percent",
  value: 10,
  min_order: 0,
  label: "10 % de remise",
};

// Le navigateur utilise le vrai frontend ; les réponses API sont contrôlées pour
// vérifier aussi les erreurs et les ruptures sans modifier les données boutique.
async function setup(page, options = {}) {
  const state = {
    orders: [],
    settingsRequests: 0,
    products: structuredClone([simple, multi, exhausted]),
  };
  if (options.stock !== undefined) {
    state.products[0].variants[0].stock = options.stock;
    state.products[0].total_stock = options.stock;
  }
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api", "");
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (path === "/settings/public") {
      state.settingsRequests++;
      if (options.settingsFailure && state.settingsRequests <= 1)
        return json({ error: "Indisponible" }, 503);
      return json({ ...settings, ...options.settings });
    }
    if (path === "/categories")
      return json([
        { id: 1, name: "Mode", product_count: 2 },
        { id: 2, name: "Maison", product_count: 1 },
        { id: 4, name: "Vide", product_count: 0 },
      ]);
    if (path === "/products")
      return json(
        state.products.filter(
          (p) =>
            (!url.searchParams.get("category") ||
              p.category_id === Number(url.searchParams.get("category"))) &&
            (!url.searchParams.get("search") ||
              p.name
                .toLowerCase()
                .includes(url.searchParams.get("search").toLowerCase())),
        ),
      );
    if (/^\/products\/\d+\/reviews$/.test(path)) return json([]);
    if (/^\/products\/\d+$/.test(path))
      return json(
        state.products.find((p) => p.id === Number(path.split("/")[2])),
      );
    if (path === "/geocode/search") return json([]);
    if (path === "/promo/validate") {
      const code = request.postDataJSON().code;
      if (code === "REDUC10") return json(percentPromo);
      if (code === "LIVRAISON")
        return json({
          code,
          type: "freeship",
          value: 0,
          min_order: 0,
          label: "Livraison offerte",
        });
      return json({ error: "Code invalide" }, 400);
    }
    if (path === "/stock-requests") return json({ id: 1 }, 201);
    if (path === "/orders" && request.method() === "POST") {
      const body = request.postDataJSON();
      state.orders.push(body);
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (options.orderFailure)
        return json({ error: "Réseau indisponible. Réessayez." }, 503);
      return json(makeOrder(body), 201);
    }
    if (path.startsWith("/orders/track/")) {
      if (path.endsWith("CMD-UNKNOWN"))
        return json({ error: "Commande introuvable" }, 404);
      return json({
        ...makeOrder(state.orders.at(-1) || {}),
        ...options.tracking,
      });
    }
    throw new Error(`API fixture manquante : ${request.method()} ${path}`);
  });
  if (
    options.cart ||
    options.client ||
    options.promo ||
    options.theme ||
    options.favorites
  ) {
    await page.addInitScript(
      (data) => {
        if (sessionStorage.getItem("fixture-loaded")) return;
        for (const [key, value] of Object.entries(data))
          if (value !== undefined)
            localStorage.setItem(key, JSON.stringify(value));
        sessionStorage.setItem("fixture-loaded", "1");
      },
      {
        shop_cart: options.cart,
        shop_client: options.client,
        shop_promo: options.promo,
        shop_favorites: options.favorites,
      },
    );
    if (options.theme)
      await page.addInitScript(
        (theme) => localStorage.setItem("shop_theme", theme),
        options.theme,
      );
  }
  return state;
}
function makeOrder(body) {
  return {
    reference: "CMD-ABC123",
    status: "pending",
    created_at: "2026-10-04T12:00:00Z",
    delivery_method: body.delivery_method || "delivery",
    customer_address: body.customer_address || "Glass",
    zone: body.zone || "Glass",
    payment_method: "livraison",
    total: body.delivery_method === "pickup" ? 10000 : 11500,
    discount: 0,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    courier: null,
    ...body,
    items: [
      {
        id: 1,
        product_id: 1,
        product_name: simple.name,
        variant_name: "Standard",
        quantity: 1,
      },
    ],
  };
}
const cartItem = (
  product = simple,
  variant = product.variants[0],
  quantity = 1,
) => ({
  product_id: product.id,
  product_name: product.name,
  variant_id: variant.id,
  variant_name: variant.name,
  unit_price: variant.price,
  stock: variant.stock,
  quantity,
});
async function fillCustomer(page) {
  await page.getByRole("textbox", { name: "Nom complet" }).fill("Awa Mba");
  await page
    .getByRole("textbox", { name: "Téléphone", exact: true })
    .fill("077123456");
}
async function selectDelivery(page, zone = "Glass") {
  await page
    .getByRole("combobox", { name: "Adresse de livraison" })
    .fill("Portail bleu, Glass");
  await page
    .getByRole("combobox", { name: "Confirmez votre quartier" })
    .selectOption(zone);
}
async function amount(page, text) {
  await expect(
    page.getByRole("region", { name: "Montant de la commande" }),
  ).toContainText(text);
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
}

test("arrivée directe, trois destinations et options secondaires à la demande", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/boutique$/);
  await expect(
    page.getByRole("heading", { name: "Boutique", exact: true }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", {
    name: "Navigation principale",
    exact: true,
  });
  const desktopNav = page.getByRole("navigation", {
    name: "Navigation principale sur ordinateur",
  });
  const visibleNav = (await nav.isVisible()) ? nav : desktopNav;
  await expect(visibleNav.getByRole("link")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Vide", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".whatsapp-fab")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Trier les produits" }),
  ).toBeHidden();
  await page.getByText("Plus", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Mes favoris", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "Mes favoris", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Affiner" }).click();
  await page
    .getByRole("combobox", { name: "Trier les produits" })
    .selectOption("prix-asc");
  await page
    .getByRole("searchbox", { name: "Rechercher un produit" })
    .fill("T-shirt");
  await expect(
    page.getByRole("heading", { name: "Sac de voyage" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "T-shirt coton" }),
  ).toBeVisible();
  await noOverflow(page);
});

test("acheter depuis le catalogue sans ouvrir les options secondaires", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ajouter Sac de voyage au panier" })
    .click();
  await page
    .getByRole("link", { name: /Panier/ })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByText("Total estimé", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Code promotionnel" }),
  ).toBeHidden();
  await page
    .getByRole("link", { name: "Passer commande", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toBeDisabled();
  await amount(page, "Quartier à confirmer");
  await fillCustomer(page);
  await selectDelivery(page, "Owendo");
  await amount(page, /13\s000/);
  await noOverflow(page);
  await page.getByRole("button", { name: /Confirmer ma commande/ }).click();
  await expect(
    page.getByRole("heading", { name: "Commande confirmée !" }),
  ).toBeVisible();
  expect(state.orders).toHaveLength(1);
  expect(state.orders[0]).toMatchObject({
    delivery_method: "delivery",
    zone: "Owendo",
    latitude: null,
    longitude: null,
    payment_method: "livraison",
    items: [{ variant_id: 11, quantity: 1 }],
  });
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("shop_cart"))),
  ).toEqual([]);
  await page.getByRole("link", { name: "Suivre ma commande" }).click();
  await expect(
    page.getByRole("heading", { name: "En attente d'un livreur" }),
  ).toBeVisible();
  await expect(
    page.getByText("Détails de ma commande", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Articles", { exact: true })).toBeHidden();
  await page
    .getByRole("button", { name: "Mes commandes", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /CMD-ABC123/ })).toBeVisible();
});

test("fiche : variantes utiles, ajout sans redirection et réassort", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/products/2");
  await page.getByRole("button", { name: /^L —/ }).click();
  await page
    .getByRole("button", { name: /^(Ajouter|Ajouter au panier)$/ })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/products\/2$/);
  await expect(
    page.getByRole("link", { name: "Voir mon panier" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("shop_cart"))[0].variant_id,
    ),
  ).toBe(22);
  await expect(
    page.getByRole("button", { name: "Commander maintenant" }),
  ).toHaveCount(0);
  await expect(page.getByText(multi.description, { exact: true })).toBeHidden();
  await page.getByText("Description du produit", { exact: true }).click();
  await expect(
    page.getByText(multi.description, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^XL —/ }).click();
  await expect(
    page.getByRole("button", { name: "Demander", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Demander", exact: true }).click();
  await expect(page.getByText(/Demande enregistrée/)).toBeVisible();
  await page.goto("/products/1");
  await expect(page.getByText("Variante", { exact: true })).toHaveCount(0);
  await noOverflow(page);
});

test("retrait avec remise, sans adresse ni carte, double soumission protégée", async ({
  page,
}) => {
  const state = await setup(page, { cart: [cartItem()], promo: percentPromo });
  await page.goto("/checkout");
  await fillCustomer(page);
  await page
    .getByRole("button", { name: "Retirer en boutique gratuitement" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Adresse de livraison" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(settings.pickup_address, { exact: true }),
  ).toBeVisible();
  await amount(page, /9\s000/);
  await page.locator("form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(
    page.getByRole("heading", { name: "Commande confirmée !" }),
  ).toBeVisible();
  expect(state.orders).toHaveLength(1);
  expect(state.orders[0]).toMatchObject({
    delivery_method: "pickup",
    zone: "",
    latitude: null,
    longitude: null,
    promo_code: "REDUC10",
  });
  await expect(
    page.getByText("Retrait en boutique", { exact: true }),
  ).toBeVisible();
});

test("échec API conserve le formulaire et le panier", async ({ page }) => {
  const state = await setup(page, { cart: [cartItem()], orderFailure: true });
  await page.goto("/checkout");
  await fillCustomer(page);
  await selectDelivery(page);
  await page.getByRole("button", { name: /Confirmer ma commande/ }).click();
  await expect(page.getByRole("alert")).toContainText("Réseau indisponible");
  await expect(page.getByRole("textbox", { name: "Nom complet" })).toHaveValue(
    "Awa Mba",
  );
  await expect(
    page.getByRole("combobox", { name: "Confirmez votre quartier" }),
  ).toHaveValue("Glass");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("shop_cart"))),
  ).toHaveLength(1);
  await page.getByRole("button", { name: /Confirmer ma commande/ }).click();
  await expect.poll(() => state.orders.length).toBe(2);
});

test("frais, promotions et total suivent le quartier et les remises", async ({
  page,
}) => {
  await setup(page, { cart: [cartItem()] });
  await page.goto("/cart");
  await page.getByText("J’ai un code promo", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Code promotionnel" })
    .fill("REDUC10");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(page.getByText(/Code appliqué/)).toBeVisible();
  await page
    .getByRole("link", { name: "Passer commande", exact: true })
    .filter({ visible: true })
    .click();
  await selectDelivery(page);
  await amount(page, /10\s500/);
  await page
    .getByRole("combobox", { name: "Confirmez votre quartier" })
    .selectOption("Owendo");
  await amount(page, /12\s000/);
  await page.getByRole("link", { name: "Modifier mon panier" }).click();
  await page
    .getByRole("textbox", { name: "Code promotionnel" })
    .fill("LIVRAISON");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await expect(
    page.getByText(/Code appliqué : Livraison offerte/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Passer commande", exact: true })
    .filter({ visible: true })
    .click();
  await selectDelivery(page, "Owendo");
  await amount(page, "Offerte");
  await amount(page, /10\s000/);
});

test("seuil de livraison gratuite appliqué après remise", async ({ page }) => {
  await setup(page, {
    cart: [cartItem(simple, simple.variants[0], 3)],
    promo: percentPromo,
  });
  await page.goto("/checkout");
  await selectDelivery(page, "Owendo");
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande — 30\s000/ }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("region", { name: "Montant de la commande" })
      .getByText("Livraison", { exact: true })
      .locator(".."),
  ).toContainText(/3\s000/);
  await amount(page, /3\s000/);
  await page.getByRole("link", { name: "Modifier mon panier" }).click();
  await page
    .getByRole("button", { name: "Retirer le code", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Passer commande", exact: true })
    .filter({ visible: true })
    .click();
  await selectDelivery(page, "Owendo");
  await amount(page, "Offerte");
  await amount(page, /30\s000/);
});

test("panier vide et rupture réactualisée empêchent la commande", async ({
  page,
}) => {
  await setup(page, { cart: [cartItem()], stock: 0 });
  await page.goto("/cart");
  await expect(page.getByRole("alert")).toContainText("Article épuisé");
  await page
    .getByRole("link", { name: "Passer commande", exact: true })
    .filter({ visible: true })
    .click();
  await selectDelivery(page);
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "Modifier mon panier", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Retirer Sac de voyage", exact: true })
    .click();
  await expect(
    page.getByText("Votre panier est vide.", { exact: true }),
  ).toBeVisible();
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Votre panier est vide" }),
  ).toBeVisible();
});

test("préremplissage conservé, ancien quartier invalide non remplacé", async ({
  page,
}) => {
  await setup(page, {
    cart: [cartItem()],
    client: {
      customer_name: "Awa",
      customer_phone: "077123456",
      customer_address: "Ancienne adresse",
      zone: "Zone supprimée",
    },
  });
  await page.goto("/checkout");
  await expect(page.getByRole("textbox", { name: "Nom complet" })).toHaveValue(
    "Awa",
  );
  await expect(
    page.getByRole("combobox", { name: "Confirmez votre quartier" }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Confirmez votre quartier" })
    .selectOption("Glass");
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toBeEnabled();
});

test("carte facultative ouverte uniquement à la demande et sans coordonnées techniques", async ({
  page,
}) => {
  await setup(page, { cart: [cartItem()] });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/checkout");
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Préciser ma position (facultatif)" })
    .click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 100, y: 100 } });
  await expect(
    page.getByRole("button", { name: "Retirer la position enregistrée" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Masquer la carte" }).click();
  await page
    .getByRole("button", { name: "Préciser ma position (facultatif)" })
    .click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Retirer la position enregistrée" })
    .click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(0);
  await expect(page.getByRole("spinbutton", { name: "Latitude" })).toHaveCount(
    0,
  );
  await noOverflow(page);
});

test("liens partagés, favoris et thème existants conservés", async ({
  page,
}) => {
  await setup(page, { theme: "dark" });
  await page.goto("/products/1");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page
    .getByRole("button", { name: "Ajouter aux favoris", exact: true })
    .click();
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await expect(page).toHaveURL(/\/boutique$/);
  await page.getByText("Plus", { exact: true }).click();
  await page.getByRole("link", { name: "Mes favoris", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sac de voyage" }),
  ).toBeVisible();
  await page.goto("/boutique?cat=1&q=T-shirt&tri=prix-asc");
  await expect(
    page.getByRole("heading", { name: "Mode", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "T-shirt coton" }),
  ).toBeVisible();
  await page.goto("/suivi?ref=CMD-ABC123");
  await expect(
    page.getByRole("heading", { name: "En attente d'un livreur" }),
  ).toBeVisible();
});

test("clavier : options fermées non tabulables et précisions accessibles", async ({
  page,
}) => {
  await setup(page, { cart: [cartItem()] });
  await page.goto("/checkout");
  await fillCustomer(page);
  await selectDelivery(page);
  const summary = page.getByText("Ajouter des précisions (facultatif)", {
    exact: true,
  });
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("awa@example.com");
  await summary.click();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toBeEnabled();
});

test("un code sous son minimum doit être retiré avant de commander", async ({
  page,
}) => {
  await setup(page, {
    cart: [cartItem()],
    promo: { ...percentPromo, min_order: 20000 },
  });
  await page.goto("/checkout");
  await fillCustomer(page);
  await selectDelivery(page);
  await expect(
    page.getByRole("link", { name: "Modifier ou retirer le code" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Modifier ou retirer le code" }).click();
  await page.getByRole("button", { name: "Retirer le code" }).click();
  await page
    .getByRole("link", { name: "Passer commande", exact: true })
    .filter({ visible: true })
    .click();
  await fillCustomer(page);
  await selectDelivery(page);
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toBeEnabled();
});

test("informations de livraison indisponibles : réessayer sans faux total", async ({
  page,
}) => {
  await setup(page, { cart: [cartItem()], settingsFailure: true });
  await page.goto("/checkout");
  await expect(page.getByRole("alert")).toContainText(
    "informations de livraison",
  );
  await expect(
    page.getByRole("button", { name: /Confirmer ma commande/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(
    page.getByRole("heading", { name: "Votre commande", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Confirmez votre quartier" }),
  ).toHaveValue("");
});

test("ajouts répétés limités au stock disponible", async ({ page }) => {
  await setup(page, { stock: 2 });
  await page.goto("/");
  const add = page.getByRole("button", {
    name: "Ajouter Sac de voyage au panier",
  });
  await add.click();
  await add.click();
  await add.click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("shop_cart"))[0].quantity,
    ),
  ).toBe(2);
  await page
    .getByRole("link", { name: /Panier/ })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Augmenter la quantité de Sac de voyage",
      exact: true,
    }),
  ).toBeDisabled();
});
