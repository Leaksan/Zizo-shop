import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import FloatingWhatsApp from "./components/FloatingWhatsApp";
import ScrollToTop from "./components/ScrollToTop";
import Landing from "./pages/Landing";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import TrackOrder from "./pages/TrackOrder";
import Courier from "./pages/Courier";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminPromos from "./pages/admin/AdminPromos";
import AdminCouriers from "./pages/admin/AdminCouriers";
import AdminStockRequests from "./pages/admin/AdminStockRequests";
import AdminSettings from "./pages/admin/AdminSettings";

export default function App() {
  return (
    <div className="min-h-screen overflow-x-clip bg-gray-50 text-gray-900 dark:bg-slate-900 dark:text-gray-100">
      <ScrollToTop />
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
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
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/boutique" element={<Shop />} />
                  <Route path="/products/:id" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/order-confirmation/:reference" element={<OrderConfirmation />} />
                  <Route path="/suivi" element={<TrackOrder />} />
                  <Route path="/livreur" element={<Courier />} />
                </Routes>
              </main>
              <Footer />
              <FloatingWhatsApp />
            </div>
          }
        />
      </Routes>
    </div>
  );
}
