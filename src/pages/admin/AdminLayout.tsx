import { BarChart3, Boxes, Crown, FileText, FolderTree, Image, LayoutDashboard, Package, Palette, Receipt, ScrollText, Settings, Shirt, Tag, Truck, Users, UserCheck } from "lucide-react";
import { PanelLayout, type NavItem } from "@/components/layout/PanelLayout";
import { useAuth } from "@/hooks/useAuth";

const items: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/shipping", label: "Shipping", icon: Truck },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/custom-requests", label: "Custom requests", icon: Palette },
  { to: "/admin/quotations", label: "Quotations", icon: FileText },
  { to: "/admin/products", label: "Products", icon: Shirt, adminOnly: true },
  { to: "/admin/categories", label: "Categories", icon: FolderTree, adminOnly: true },
  { to: "/admin/designs", label: "Design library", icon: Image, adminOnly: true },
  { to: "/admin/plans", label: "Membership plans", icon: Crown, adminOnly: true },
  { to: "/admin/members", label: "Membership management", icon: UserCheck, adminOnly: true },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: Receipt, adminOnly: true },
  { to: "/admin/coupons", label: "Coupons", icon: Tag, adminOnly: true },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { to: "/admin/settings", label: "Website settings", icon: Settings, adminOnly: true },
  { to: "/admin/audit", label: "Audit logs", icon: ScrollText, adminOnly: true },
];
export default function AdminLayout() {
  const { roles } = useAuth();
  return <PanelLayout title="Admin" items={items} badge={roles.includes("super_admin") ? "super admin" : roles.includes("admin") ? "admin" : "staff"} />;
}
