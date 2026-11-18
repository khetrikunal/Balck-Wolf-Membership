import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/types/db";

interface AuthState {
  user: User | null; session: Session | null; loading: boolean;
  roles: AppRole[]; isStaff: boolean; isAdmin: boolean; isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setRoles([]); setLoading(false); qc.clear(); } });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  // Roles are read from the database (my_roles RPC) — never from client-supplied claims.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase.rpc("my_roles").then(({ data }) => {
      if (!cancelled) { setRoles((data as AppRole[]) ?? []); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null, session, loading, roles,
    isStaff: roles.length > 0,
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isSuperAdmin: roles.includes("super_admin"),
    signOut: async () => { await supabase.auth.signOut(); },
  }), [session, loading, roles]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
