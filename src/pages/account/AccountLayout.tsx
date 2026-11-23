import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/account", label: "Overview", end: true },
  { to: "/account/orders", label: "Orders" },
  { to: "/account/wishlist", label: "Wishlist" },
  { to: "/account/addresses", label: "Addresses" },
  { to: "/account/profile", label: "Profile" },
  { to: "/account/membership", label: "Membership" },
  { to: "/account/card", label: "Membership card" },
  { to: "/account/payments", label: "Payments" },
  { to: "/account/custom", label: "Custom designs" },
  { to: "/account/notifications", label: "Notifications" },
];

export default function AccountLayout() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = (mobile = false) => items.map((item) => (
    <NavLink key={item.to} to={item.to} end={item.end} onClick={() => mobile && setMobileOpen(false)}
      className={({ isActive }) => cn(
        "transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        mobile ? "block border-b border-border py-3 text-base" : "whitespace-nowrap border-b-2 px-3 py-4 text-sm",
        isActive ? "border-primary text-primary" : mobile ? "text-muted-foreground" : "border-transparent text-muted-foreground",
      )}>{item.label}</NavLink>
  ));

  return <section className="container min-h-[60vh] py-8 md:py-12">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div><p className="eyebrow">BLACK WOLF · YOUR SPACE</p><h1 className="mt-1 text-5xl leading-none md:text-6xl">Account</h1><p className="mt-2 text-sm text-muted-foreground">Signed in as {user?.email}</p></div>
      <button onClick={() => void signOut()} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><LogOut className="h-4 w-4" />Sign out</button>
    </div>
    <div className="mb-7 md:hidden">
      <button type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} className="flex min-h-12 w-full items-center justify-between border border-border px-4 text-left text-sm">Account menu <ChevronDown className={cn("h-4 w-4 transition-transform", mobileOpen && "rotate-180")} /></button>
      {mobileOpen && <nav aria-label="Account pages" className="mt-2 border-x border-t border-border px-4">{links(true)}</nav>}
    </div>
    <nav aria-label="Account pages" className="mb-8 hidden items-center gap-1 overflow-x-auto border-y border-border md:flex">{links()}</nav>
    <div className="account-content"><Outlet /></div>
  </section>;
}
