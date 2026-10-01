import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import FloatingWhatsApp from "./components/FloatingWhatsApp";
import BottomNav from "./components/BottomNav";
import ScrollToTop from "./components/ScrollToTop";
import Shop from "./pages/Shop";
import { welcomeSeen } from "./welcome";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";

// Pages chargées à la demande : l'admin, l'espace livreur et les cartes (Leaflet)
// ne sont plus téléchargés par les clients qui visitent seulement la boutique.
const Landing = lazy(() => import("./pages/Landing"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Courier = lazy(() => import("./pages/Courier"));
const Liquidation = lazy(() => import("./pages/Liquidation"));
const Favorites = lazy(() => import("./pages/Favorites"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Account = lazy(() => import("./pages/Account"));
const Shops = lazy(() => import("./pages/Shops"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const OpenShop = lazy(() => import("./pages/OpenShop"));
const SellerLayout = lazy(() => import("./pages/seller/SellerLayout"));
const SellerShopEdit = lazy(() => import("./pages/seller/SellerShopEdit"));
const SellerPosts = lazy(() => import("./pages/seller/SellerPosts"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const SellerDashboard = lazy(() => import("./pages/seller/SellerDashboard"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminProductForm = lazy(() => import("./pages/admin/AdminProductForm"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminPromos = lazy(() => import("./pages/admin/AdminPromos"));
const AdminCouriers = lazy(() => import("./pages/admin/AdminCouriers"));
const AdminStockRequests = lazy(() => import("./pages/admin/AdminStockRequests"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminShops = lazy(() => import("./pages/admin/AdminShops"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));

function PageLoader() {
  return <p className="py-16 text-center muted">Chargement…</p>;
}

// Accueil « à vue unique » : décidé une fois à l'arrivée sur /, pas à chaque rendu
function WelcomeGate() {
  const [seen] = useState(welcomeSeen);
  return seen ? <Navigate to="/boutique" replace /> : <Landing />;
}

export default function App() {
  return (
    <div className="min-h-screen overflow-x-clip bg-gray-50 text-gray-900 dark:bg-slate-900 dark:text-gray-100">
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<WelcomeGate />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="shops" element={<AdminShops />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id/edit" element={<AdminProductForm />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="promos" element={<AdminPromos />} />
          <Route path="couriers" element={<AdminCouriers />} />
          <Route path="stock-requests" element={<AdminStockRequests />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route
          path="*"
          element={
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Ancien fil d'actu (liens partagés, appli installée) : l'Explorer le remplace */}
                  <Route path="/fil" element={<Navigate to="/boutique" replace />} />
                  <Route path="/boutique" element={<Shop />} />
                  <Route path="/products/:id" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/favoris" element={<Favorites />} />
                  <Route path="/liquidation" element={<Liquidation />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/order-confirmation/:reference" element={<OrderConfirmation />} />
                  <Route path="/suivi" element={<TrackOrder />} />
                  <Route path="/livreur" element={<Courier />} />
                  <Route path="/compte" element={<Account />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/boutiques" element={<Shops />} />
                  <Route path="/b/:slug" element={<ShopPage />} />
                  <Route path="/vendeur/ouvrir" element={<OpenShop />} />
                  <Route path="/vendeur" element={<SellerLayout />}>
                    <Route index element={<Navigate to="tableau" replace />} />
                    <Route path="tableau" element={<SellerDashboard />} />
                    <Route path="produits" element={<AdminProducts mode="vendeur" />} />
                    <Route path="produits/nouveau" element={<AdminProductForm mode="vendeur" />} />
                    <Route path="produits/:id" element={<AdminProductForm mode="vendeur" />} />
                    <Route path="commandes" element={<SellerOrders />} />
                    <Route path="publications" element={<SellerPosts />} />
                    <Route path="boutique" element={<SellerShopEdit />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </main>
              <Footer />
              <FloatingWhatsApp />
              <BottomNav />
            </div>
          }
        />
      </Routes>
      </Suspense>
    </div>
  );
}
