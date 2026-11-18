import { NavLink, Outlet, Link } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; adminOnly?: boolean; superOnly?: boolean }

export function PanelLayout({ title, items, badge }: { title: string; items: NavItem[]; badge?: string }) {
  const { isAdmin, isSuperAdmin, signOut, user } = useAuth();
  const [open, setOpen] = useState(false);
  const visible = items.filter((i) => (!i.adminOnly || isAdmin) && (!i.superOnly || isSuperAdmin));

  const links = (
    <nav className="flex flex-col gap-1">
      {visible.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent", isActive ? "bg-accent text-foreground" : "text-muted-foreground")}>
          <Icon className="h-4 w-4" />{label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-border bg-card p-4 md:block">
        <Link to="/" className="mb-6 block"><Logo /></Link>
        <p className="eyebrow mb-3 px-3">{title}{badge && ` · ${badge}`}</p>
        {links}
        <div className="mt-8 border-t border-border px-3 pt-4 text-xs text-muted-foreground">
          <p className="mb-2 truncate">{user?.email}</p>
          <button className="underline hover:text-foreground" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <div>
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <Logo /><button aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && <div className="border-b border-border bg-card p-4 md:hidden">{links}<button className="mt-4 text-xs underline" onClick={signOut}>Sign out</button></div>}
        <main className="p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
