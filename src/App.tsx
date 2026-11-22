import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { RequireAdmin, RequireAuth, RequireStaff } from "@/components/common/Guards";
import { Loading, EmptyState } from "@/components/common/States";
import Home from "@/pages/public/Home";
import Shop from "@/pages/public/Shop";
import ProductDetails from "@/pages/public/ProductDetails";
import Membership from "@/pages/public/Membership";
import Cart from "@/pages/public/Cart";
import Checkout from "@/pages/public/Checkout";
import Verify from "@/pages/public/Verify";
import { Login, Register } from "@/pages/public/Auth";
import { OrderFailure, OrderSuccess } from "@/pages/public/OrderResult";
import { About, Contact, CustomClothing, PrivacyPolicy, RefundPolicy, ShippingPolicy, Terms } from "@/pages/public/Info";

// Customer and admin areas are code-split so shoppers never download admin code.
const AccountLayout = lazy(() => import("@/pages/account/AccountLayout"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const acc = (n: string) => lazy(() => import("@/pages/account/Account").then((m) => ({ default: (m as any)[n] })));
const cus = (n: string) => lazy(() => import("@/pages/account/Custom").then((m) => ({ default: (m as any)[n] })));
const ops = (n: string) => lazy(() => import("@/pages/admin/Operations").then((m) => ({ default: (m as any)[n] })));
const biz = (n: string) => lazy(() => import("@/pages/admin/Business").then((m) => ({ default: (m as any)[n] })));
const cnt = (n: string) => lazy(() => import("@/pages/admin/Content").then((m) => ({ default: (m as any)[n] })));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const Products = lazy(() => import("@/pages/admin/Products"));

const Overview = acc("Overview"), Profile = acc("Profile"), Orders = acc("Orders"), OrderDetails = acc("OrderDetails"), MembershipPage = acc("MembershipPage"),
  CardPage = acc("CardPage"), PaymentHistory = acc("PaymentHistory"), Wishlist = acc("Wishlist"), Addresses = acc("Addresses"), Notifications = acc("Notifications");
const CustomRequests = cus("CustomRequests"), NewCustomRequest = cus("NewCustomRequest");
const AOrders = ops("Orders"), AShipping = ops("Shipping"), AInventory = ops("Inventory"), ACustom = ops("CustomRequests"), AQuotes = ops("Quotations");
const ACategories = biz("Categories"), APlans = biz("Plans"), AMembers = biz("Members"), ACustomers = biz("Customers"), APayments = biz("Payments"), ACoupons = biz("Coupons");
const ADesigns = cnt("Designs"), AReports = cnt("Reports"), ASettings = cnt("SettingsPage"), AAudit = cnt("AuditLogs");

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="t-shirts" element={<Shop categorySlug="t-shirts" title="T-Shirts" />} />
          <Route path="track-pants" element={<Shop categorySlug="track-pants" title="Track Pants" />} />
          <Route path="product/:slug" element={<ProductDetails />} />
          <Route path="membership" element={<Membership />} />
          <Route path="custom" element={<CustomClothing />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="cart" element={<Cart />} />
          <Route path="verify/:token" element={<Verify />} />
          <Route path="privacy-policy" element={<PrivacyPolicy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="refund-policy" element={<RefundPolicy />} />
          <Route path="shipping-policy" element={<ShippingPolicy />} />
          <Route element={<RequireAuth />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/success" element={<OrderSuccess />} />
            <Route path="order/failure" element={<OrderFailure />} />
          </Route>
          <Route path="*" element={<EmptyState title="Page not found" />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<Overview />} />
            <Route path="profile" element={<Profile />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetails />} />
            <Route path="membership" element={<MembershipPage />} />
            <Route path="card" element={<CardPage />} />
            <Route path="payments" element={<PaymentHistory />} />
            <Route path="custom" element={<CustomRequests />} />
            <Route path="custom/new" element={<NewCustomRequest />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>

        {/* Admin: UI gate only — RLS and server functions enforce permissions. No public admin sign-up exists. */}
        <Route element={<RequireStaff />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AOrders />} />
            <Route path="shipping" element={<AShipping />} />
            <Route path="inventory" element={<AInventory />} />
            <Route path="custom-requests" element={<ACustom />} />
            <Route path="quotations" element={<AQuotes />} />
            <Route path="customers" element={<ACustomers />} />
            <Route element={<RequireAdmin />}>
              <Route path="members" element={<AMembers />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<ACategories />} />
              <Route path="designs" element={<ADesigns />} />
              <Route path="plans" element={<APlans />} />
              <Route path="payments" element={<APayments />} />
              <Route path="coupons" element={<ACoupons />} />
              <Route path="reports" element={<AReports />} />
              <Route path="settings" element={<ASettings />} />
              <Route path="audit" element={<AAudit />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
