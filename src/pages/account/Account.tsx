import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { QueryBoundary } from "@/components/common/States";
import { AddressForm } from "@/components/common/AddressForm";
import { ProductGrid } from "@/components/product/ProductCard";
import { MembershipCard } from "@/components/product/MembershipCard";
import { useAuth } from "@/hooks/useAuth";
import * as acc from "@/services/account";
import { supabase, publicImageUrl } from "@/lib/supabase";
import { errorMessage, formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import type { Shipment } from "@/types/db";

const H = ({ children }: { children: React.ReactNode }) => <h1 className="mb-6 text-5xl">{children}</h1>;
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

// ---------- Overview / profile ----------
const profileSchema = z.object({ full_name: z.string().trim().min(2, "Enter your name").max(100), phone: z.string().trim().max(20).optional().or(z.literal("")) });
export function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["profile", user?.id], queryFn: async () => { const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single(); if (error) throw error; return data; } });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), values: { full_name: q.data?.full_name ?? "", phone: q.data?.phone ?? "" } });
  return (<><H>Profile</H>
    <QueryBoundary query={q}>{() => (
      <Card className="max-w-xl"><CardContent className="pt-5">
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
          const { error } = await supabase.from("profiles").update({ full_name: v.full_name, phone: v.phone || null }).eq("id", user!.id);
          if (error) toast.error(error.message); else { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); }
        })}>
          <Field label="Email"><Input value={user?.email ?? ""} disabled /></Field>
          <Field label="Full name" error={errors.full_name?.message}><Input {...register("full_name")} /></Field>
          <Field label="Phone" error={errors.phone?.message}><Input {...register("phone")} /></Field>
          <Button loading={isSubmitting}>Save changes</Button>
        </form></CardContent></Card>)}</QueryBoundary></>);
}

export function Overview() {
  const { user } = useAuth();
  const m = useQuery({ queryKey: ["memberships", user?.id], queryFn: acc.fetchMyMemberships });
  const o = useQuery({ queryKey: ["orders", user?.id], queryFn: acc.fetchMyOrders });
  const cur = m.data?.[0];
  return (<><H>Welcome back</H>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><CardTitle>Membership</CardTitle></CardHeader><CardContent>
        {cur ? <><Badge status={cur.status} /><p className="mt-2 text-sm text-muted-foreground">{cur.plan_snapshot?.name}</p></> : <p className="text-sm text-muted-foreground">Not a member yet.</p>}
        <Button variant="link" className="mt-3" asChild><Link to={cur ? "/account/membership" : "/membership"}>{cur ? "Manage" : "View plans"}</Link></Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Orders</CardTitle></CardHeader><CardContent><p className="font-display text-5xl">{o.data?.length ?? "–"}</p><Button variant="link" className="mt-3" asChild><Link to="/account/orders">View orders</Link></Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Custom designs</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Upload artwork, get a quote.</p><Button variant="link" className="mt-3" asChild><Link to="/account/custom">Open requests</Link></Button></CardContent></Card>
    </div></>);
}

// ---------- Orders ----------
export function Orders() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["orders", user?.id], queryFn: acc.fetchMyOrders });
  return (<><H>My orders</H>
    <QueryBoundary query={q} empty={{ title: "No orders yet", hint: "Your paid orders appear here.", action: <Button asChild><Link to="/shop">Shop now</Link></Button> }}>
      {(list) => (<div className="space-y-3">{list.map((o) => (
        <Link key={o.id} to={`/account/orders/${o.id}`} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition hover:border-silver/50">
          <div><p className="font-semibold">{o.order_number}</p><p className="text-sm text-muted-foreground">{formatDate(o.created_at)} · {o.order_items?.length ?? 0} item(s)</p></div>
          <div className="text-right"><p>{formatINR(o.total)}</p><Badge status={o.status} /></div></Link>))}</div>)}
    </QueryBoundary></>);
}

export function OrderDetails() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["order", id], queryFn: () => acc.fetchOrder(id) });
  return (<><H>Order details</H>
    <QueryBoundary query={q} empty={{ title: "Order not found" }}>
      {(o) => { const s = one<Shipment>(o!.shipments); const a = o!.shipping_address; return (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card><CardHeader><CardTitle>{o!.order_number} <Badge status={o!.status} /></CardTitle></CardHeader><CardContent>
            <ul className="divide-y divide-border">{o!.order_items?.map((i) => (
              <li key={i.id} className="flex gap-4 py-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded bg-muted">{i.image_path && <img src={publicImageUrl(i.image_path)} alt="" className="h-full w-full object-cover" />}</div>
                <div className="flex-1 text-sm"><p className="font-semibold">{i.product_name}</p><p className="text-muted-foreground">{i.color} · {i.size} × {i.quantity}</p></div>
                <p className="text-sm">{formatINR(i.line_total)}</p></li>))}</ul>
            <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatINR(o!.subtotal)}</dd></div>
              {Number(o!.discount_total) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>−{formatINR(o!.discount_total)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{formatINR(o!.shipping_total)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatINR(o!.total)}</dd></div>
              {o!.is_member_pricing && <p className="pt-2 text-xs text-silver">Member prices were applied to this order.</p>}
            </dl></CardContent></Card>
          <div className="space-y-6">
            <Card><CardHeader><CardTitle>Shipment</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
              {s ? (<><p><Badge status={s.status} /></p>{s.courier_name && <p>Courier: {s.courier_name}</p>}{s.tracking_number && <p>Tracking: {s.tracking_number}</p>}
                {s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-silver underline">Track package <ExternalLink className="h-3 w-3" /></a>}
                {s.delivered_at && <p>Delivered {formatDate(s.delivered_at)}</p>}</>) : <p className="text-muted-foreground">Shipment details will appear once your order is processed.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Delivery address</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{a.full_name}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.postal_code}<br />{a.phone}</CardContent></Card>
          </div></div>); }}
    </QueryBoundary></>);
}

// ---------- Membership ----------
export function MembershipPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["memberships", user?.id], queryFn: acc.fetchMyMemberships });
  const hist = useQuery({ queryKey: ["membership-history", user?.id], queryFn: acc.fetchMyMembershipHistory });
  const profile = useQuery({ queryKey: ["profile-name", user?.id], queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", user!.id).single()).data?.full_name as string | undefined });
  return (<><H>Membership</H>
    <QueryBoundary query={q} empty={{ title: "No membership yet", hint: "Join to unlock member prices and a digital card.", action: <Button asChild><Link to="/membership">View plans</Link></Button> }}>
      {(list) => { const m = list[0]; const card = one(m.membership_cards); const live = m.status === "active" && (!m.expires_at || new Date(m.expires_at) > new Date()); return (
        <div className="space-y-8">
          <Card><CardContent className="grid gap-4 pt-5 text-sm md:grid-cols-4">
            <div><p className="eyebrow">Plan</p><p className="mt-1 text-lg">{m.plan_snapshot?.name}</p></div>
            <div><p className="eyebrow">Status</p><p className="mt-1"><Badge status={live ? "active" : m.status === "active" ? "expired" : m.status} /></p></div>
            <div><p className="eyebrow">Member since</p><p className="mt-1 text-lg">{formatDate(m.starts_at)}</p></div>
            <div><p className="eyebrow">Expires</p><p className="mt-1 text-lg">{m.status === "active" && !m.expires_at ? "Never (lifetime)" : formatDate(m.expires_at)}</p></div>
            <div className="md:col-span-4"><Button asChild variant="outline"><Link to="/membership">{live ? "Renew / extend" : "Renew membership"}</Link></Button></div>
          </CardContent></Card>
          {card && m.membership_number && <MembershipCard number={m.membership_number} name={profile.data || user?.email || "Member"} plan={m.plan_snapshot?.name} issued={card.issued_at} expires={m.expires_at} status={live ? "active" : m.status === "active" ? "expired" : m.status} token={card.verification_token} />}
          <section><h2 className="mb-3 text-3xl">Membership history</h2>
            <QueryBoundary query={hist} empty={{ title: "No history yet" }}>{(rows) => (
              <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Event</th><th className="p-3">Period</th><th className="p-3 text-right">Amount</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-border"><td className="p-3">{formatDate(r.created_at)}</td><td className="p-3">{titleCase(r.kind)}</td><td className="p-3">{r.period_end ? `${formatDate(r.period_start)} → ${formatDate(r.period_end)}` : r.kind === "purchase" || r.kind === "renewal" ? "Lifetime" : "—"}</td><td className="p-3 text-right">{formatINR(r.amount)}</td></tr>)}</tbody></table></div>)}</QueryBoundary></section>
        </div>); }}
    </QueryBoundary></>);
}

export function CardPage() {
  return <MembershipPage />;
}

export function PaymentHistory() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["payments", user?.id], queryFn: acc.fetchMyPayments });
  return (<><H>Payment history</H>
    <QueryBoundary query={q} empty={{ title: "No payments yet" }}>{(rows) => (
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">For</th><th className="p-3">Reference</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th></tr></thead>
        <tbody>{rows.map((p) => <tr key={p.id} className="border-t border-border"><td className="p-3">{formatDateTime(p.created_at)}</td><td className="p-3">{titleCase(p.purpose)}</td><td className="p-3 font-mono text-xs">{p.razorpay_payment_id ?? "—"}</td><td className="p-3"><Badge status={p.status} /></td><td className="p-3 text-right">{formatINR(p.amount)}</td></tr>)}</tbody></table></div>)}</QueryBoundary></>);
}

// ---------- Wishlist / addresses / notifications ----------
export function Wishlist() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["wishlist", user?.id], queryFn: acc.fetchWishlist });
  return (<><H>Wishlist</H><QueryBoundary query={q} empty={{ title: "Your wishlist is empty", hint: "Tap the heart on any product to save it.", action: <Button asChild><Link to="/shop">Browse</Link></Button> }}>{(d) => <ProductGrid products={d} />}</QueryBoundary></>);
}

export function Addresses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["addresses", user?.id], queryFn: acc.fetchAddresses });
  const save = useMutation({ mutationFn: (v: Parameters<typeof acc.saveAddress>[0]) => acc.saveAddress(v), onSuccess: () => { toast.success("Address saved"); qc.invalidateQueries({ queryKey: ["addresses"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  const del = useMutation({ mutationFn: acc.deleteAddress, onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }), onError: (e) => toast.error(errorMessage(e)) });
  return (<><H>Saved addresses</H>
    <div className="grid gap-8 lg:grid-cols-2">
      <QueryBoundary query={q} empty={{ title: "No saved addresses" }}>{(list) => (<div className="space-y-3">{list.map((a) => (
        <Card key={a.id}><CardContent className="flex justify-between gap-3 pt-5 text-sm"><div><p className="font-semibold">{a.full_name} {a.is_default && <Badge status="active">Default</Badge>}</p><p className="text-muted-foreground">{a.line1}{a.line2 && `, ${a.line2}`}, {a.city}, {a.state} {a.postal_code} · {a.phone}</p>
          {!a.is_default && <button className="mt-2 text-xs text-silver underline" onClick={() => save.mutate({ id: a.id, user_id: user!.id, is_default: true })}>Make default</button>}</div>
          <button aria-label="Delete address" className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></button></CardContent></Card>))}</div>)}</QueryBoundary>
      <Card><CardHeader><CardTitle>Add address</CardTitle></CardHeader><CardContent><AddressForm busy={save.isPending} onSubmit={(v) => save.mutate({ ...v, line2: v.line2 || null, user_id: user!.id, is_default: (q.data?.length ?? 0) === 0 })} /></CardContent></Card>
    </div></>);
}

export function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications", user?.id], queryFn: acc.fetchNotifications });
  const read = useMutation({ mutationFn: acc.markNotificationRead, onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  return (<><H>Notifications</H><QueryBoundary query={q} empty={{ title: "You're all caught up" }}>{(list) => (
    <ul className="space-y-2">{list.map((n) => (
      <li key={n.id} className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${n.is_read ? "border-border" : "border-silver/50 bg-accent/40"}`}>
        <div><p className="font-semibold">{n.title}</p>{n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}<p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p></div>
        {!n.is_read && <Button size="sm" variant="ghost" onClick={() => read.mutate(n.id)}>Mark read</Button>}</li>))}</ul>)}</QueryBoundary></>);
}
