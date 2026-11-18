import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryBoundary } from "@/components/common/States";
import { Badge } from "@/components/ui/card";
import { fetchPlans } from "@/services/catalog";
import { fetchMyMemberships, startMembership } from "@/services/account";
import { runPayment } from "@/lib/payFlow";
import { useAuth } from "@/hooks/useAuth";
import { errorMessage, formatDate, formatINR } from "@/lib/utils";
import type { MembershipPlan } from "@/types/db";

export const planDuration = (p: MembershipPlan) => p.duration_unit === "lifetime" ? "Lifetime" : `${p.duration} ${p.duration === 1 ? p.duration_unit.replace(/s$/, "") : p.duration_unit}`;

export default function Membership() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const mine = useQuery({ queryKey: ["memberships", user?.id], queryFn: fetchMyMemberships, enabled: !!user });
  const [busy, setBusy] = useState<string | null>(null);

  const current = mine.data?.[0];
  const hasLive = current && (current.status === "active" || current.status === "expired");
  const activeNow = current?.status === "active" && (!current.expires_at || new Date(current.expires_at) > new Date());

  async function buy(plan: MembershipPlan) {
    if (!user) return navigate("/login", { state: { from: loc.pathname } });
    setBusy(plan.id);
    try {
      const renewal = !!hasLive;
      const start = await startMembership(plan.id, renewal);
      const res = await runPayment(start, { email: user.email ?? undefined }, `${plan.name} membership`);
      if (res.status === "pending") toast.info("Payment received — confirming. Your membership will activate shortly.");
      else toast.success("Membership activated!");
      await qc.invalidateQueries();
      navigate("/account/membership");
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader eyebrow="Black Wolf Membership" title="Join the pack" subtitle="Exclusive member prices on every product, early access and a digital membership card." />
      <div className="container py-12">
        {current && (
          <div className="mb-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5">
            <div><p className="eyebrow">Your membership</p>
              <p className="mt-1 text-lg">{current.plan_snapshot?.name} <Badge status={current.status} /></p>
              <p className="text-sm text-muted-foreground">{current.status === "active" ? (current.expires_at ? `Valid until ${formatDate(current.expires_at)}` : "Lifetime") : current.status === "suspended" ? "Suspended — contact support." : ""}</p></div>
            <Button variant="outline" asChild><Link to="/account/membership">Manage</Link></Button>
          </div>)}
        <QueryBoundary query={plans} empty={{ title: "No plans available", hint: "Membership plans will appear here once published." }}>
          {(list) => (
            <div className="grid gap-6 md:grid-cols-3">{list.map((p) => (
              <div key={p.id} className="flex flex-col rounded-lg border border-border bg-card p-7">
                <p className="eyebrow">{planDuration(p)}</p>
                <h3 className="mt-2 text-3xl">{p.name}</h3>
                <p className="mt-4 font-display text-6xl">{formatINR(p.price)}</p>
                {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">{(p.benefits ?? []).map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-silver" />{b}</li>)}</ul>
                <Button className="mt-8" loading={busy === p.id} disabled={current?.status === "suspended" || (activeNow && !current?.expires_at)} onClick={() => buy(p)}>
                  {hasLive ? (activeNow ? "Renew / extend" : "Renew") : "Become a member"}</Button>
              </div>))}</div>)}
        </QueryBoundary>
        <p className="mt-8 text-center text-xs text-muted-foreground">One-time payment. Memberships do not auto-renew; you can renew manually before or after expiry. Member prices apply only while your membership is active.</p>
      </div>
    </>
  );
}
