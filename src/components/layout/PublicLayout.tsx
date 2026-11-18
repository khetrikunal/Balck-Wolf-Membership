import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useShop";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const nav = [
  { to: "/", label: "Home" }, { to: "/shop", label: "Shop" }, { to: "/shop?category=exclusive-collections", label: "Collections" },
  { to: "/about", label: "About" }, { to: "/contact", label: "Contact" },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user, isStaff } = useAuth();
  const cart = useCart();
  const count = cart.data?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="container grid h-[74px] grid-cols-[1fr_auto_1fr] items-center">
          <button className="justify-self-start text-foreground transition-colors hover:text-primary md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <Link to="/" aria-label="BLACK WOLF home" className="justify-self-start"><Logo /></Link>
          <nav className="hidden gap-8 md:flex">
            {nav.map((n) => (
              <NavLink key={n.label} to={n.to} end={n.label === "Home"} className={({ isActive }) => cn("text-[10px] font-medium uppercase tracking-[0.19em] transition-colors hover:text-primary", isActive ? "text-primary" : "text-foreground/80")}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="flex items-center justify-self-end gap-3 sm:gap-5">
            {isStaff && <Link to="/admin" className="hidden text-[10px] uppercase tracking-widest text-primary lg:block">Admin</Link>}
            <button aria-label="Search products" onClick={() => navigate("/shop")} className="text-foreground/80 transition-colors hover:text-primary"><Search className="h-[18px] w-[18px]" /></button>
            <button aria-label="Account" onClick={() => navigate(user ? "/account" : "/login")} className="text-foreground/80 transition-colors hover:text-primary"><User className="h-[18px] w-[18px]" /></button>
            <Link to="/cart" aria-label="Cart" className="relative text-foreground/80 transition-colors hover:text-primary">
              <ShoppingBag className="h-[18px] w-[18px]" />
              {count > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{count}</span>}
            </Link>
          </div>
        </div>
        {open && (
          <nav className="container flex flex-col gap-1 border-t border-border py-4 md:hidden">
            {nav.map((n) => <NavLink key={n.label} to={n.to} end={n.label === "Home"} className={({ isActive }) => cn("py-3 text-xs uppercase tracking-[0.2em]", isActive ? "text-primary" : "text-foreground/80")}>{n.label}</NavLink>)}
            <NavLink to="/track-pants" className="py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Track Pants</NavLink>
            <NavLink to="/membership" className="py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Membership</NavLink>
            {isStaff && <Link to="/admin" className="py-3 text-xs uppercase tracking-[0.2em] text-primary">Admin</Link>}
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

function Footer() {
  const col = "space-y-2 text-sm text-muted-foreground [&_a]:transition-colors [&_a:hover]:text-primary";
  return (
    <footer className="border-t border-border bg-secondary">
      <div className="container grid gap-10 py-16 md:grid-cols-4">
        <div className="space-y-4"><Logo /><p className="max-w-xs text-sm leading-7 text-muted-foreground">Considered streetwear. Crafted for the ones who move differently.</p></div>
        <div><h4 className="mb-4 font-display text-2xl">Shop</h4><ul className={col}>
          <li><Link to="/shop">All products</Link></li><li><Link to="/t-shirts">T-Shirts</Link></li><li><Link to="/track-pants">Track Pants</Link></li><li><Link to="/custom">Custom clothing</Link></li></ul></div>
        <div><h4 className="mb-4 font-display text-2xl">The house</h4><ul className={col}>
          <li><Link to="/membership">Membership</Link></li><li><Link to="/about">About us</Link></li><li><Link to="/contact">Contact</Link></li><li><Link to="/account">My account</Link></li></ul></div>
        <div><h4 className="mb-4 font-display text-2xl">Information</h4><ul className={col}>
          <li><Link to="/privacy-policy">Privacy</Link></li><li><Link to="/terms">Terms & conditions</Link></li><li><Link to="/refund-policy">Refunds</Link></li><li><Link to="/shipping-policy">Shipping</Link></li></ul></div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} BLACK WOLF. All rights reserved.</div>
    </footer>
  );
}
