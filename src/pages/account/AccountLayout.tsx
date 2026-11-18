import { Bell, CreditCard, Crown, Heart, LayoutDashboard, MapPin, Package, Palette, Receipt, User } from "lucide-react";
import { PanelLayout, type NavItem } from "@/components/layout/PanelLayout";

const items: NavItem[] = [
  { to: "/account", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/account/profile", label: "Profile", icon: User },
  { to: "/account/orders", label: "My orders", icon: Package },
  { to: "/account/membership", label: "Membership", icon: Crown },
  { to: "/account/card", label: "Membership card", icon: CreditCard },
  { to: "/account/payments", label: "Payment history", icon: Receipt },
  { to: "/account/custom", label: "Custom designs", icon: Palette },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
];
export default function AccountLayout() { return <PanelLayout title="My account" items={items} />; }
