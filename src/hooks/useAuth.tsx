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
  const [sessionResolved, setSessionResolved] = useState(false);
  const [rolesForUserId, setRolesForUserId] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let authEventReceived = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!authEventReceived) setSession(data.session);
      setSessionResolved(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      authEventReceived = true;
      setSession(s);
      setSessionResolved(true);
      if (!s) { setRoles([]); setRolesForUserId(null); qc.clear(); }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  // Roles are read from the database (my_roles RPC) — never from client-supplied claims.
  useEffect(() => {
    if (!session) { setRoles([]); setRolesForUserId(null); return; }
    let cancelled = false;
    const userId = session.user.id;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("my_roles");
        if (!cancelled) setRoles(error ? [] : (data as AppRole[]) ?? []);
      } catch {
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setRolesForUserId(userId);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user.id, session?.access_token]);

  const loading = !sessionResolved || (!!session && rolesForUserId !== session.user.id);
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
