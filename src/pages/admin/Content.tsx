import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { QueryBoundary } from "@/components/common/States";
import { AdminTitle, Table, downloadCsv, useAction } from "@/components/admin/ui";
import { useAuth } from "@/hooks/useAuth";
import * as api from "@/services/admin";
import { fetchSetting } from "@/services/catalog";
import { publicImageUrl } from "@/lib/supabase";
import { errorMessage, formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";

// ---------- Admin design library ----------
export function Designs() {
  const q = useQuery({ queryKey: ["admin", "collections"], queryFn: api.adminCollections });
  const products = useQuery({ queryKey: ["admin", "products"], queryFn: api.adminProducts });
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [d, setD] = useState({ collection: "", name: "", price: "0", file: null as File | null });
  const [attach, setAttach] = useState({ design: "", product: "" });
  const addCol = useAction((n: string) => api.saveCollection(n), { invalidate: [["admin", "collections"]], success: "Collection created", onDone: () => setName("") });
  const upload = useAction(async () => {
    if (!d.collection || !d.name.trim() || !d.file) throw new Error("Choose a collection, name and image");
    await api.uploadAdminDesign(d.collection, d.name.trim(), Number(d.price || 0), d.file);
  }, { invalidate: [["admin", "collections"]], success: "Design uploaded", onDone: () => setD({ ...d, name: "", file: null }) });
  const designs = useMemo(() => (q.data ?? []).flatMap((c: any) => c.admin_designs.map((x: any) => ({ ...x, collection: c.name }))), [q.data]);
  async function link() {
    if (!attach.design || !attach.product) return;
    try { await api.attachDesign(attach.product, attach.design, true); toast.success("Design attached to product"); qc.invalidateQueries({ queryKey: ["admin"] }); } catch (e) { toast.error(errorMessage(e).includes("duplicate") ? "Already attached" : errorMessage(e)); }
  }
  return (<><AdminTitle title="Design library" />
    <div className="grid gap-6 lg:grid-cols-3">
      <Card><CardHeader><CardTitle>New collection</CardTitle></CardHeader><CardContent className="space-y-3"><Input placeholder="Collection name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Collection name" /><Button disabled={!name.trim()} loading={addCol.isPending} onClick={() => addCol.mutate(name.trim())}>Create</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Upload design</CardTitle></CardHeader><CardContent className="space-y-3">
        <Select value={d.collection} onChange={(e) => setD({ ...d, collection: e.target.value })} aria-label="Collection"><option value="">Collection…</option>{q.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Input placeholder="Design name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} aria-label="Design name" />
        <Input type="number" min={0} placeholder="Extra price (₹)" value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} aria-label="Extra price" />
        <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setD({ ...d, file: e.target.files?.[0] ?? null })} aria-label="Design file" />
        <Button loading={upload.isPending} onClick={() => upload.mutate(undefined as never)}>Upload</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Attach to product</CardTitle></CardHeader><CardContent className="space-y-3">
        <Select value={attach.design} onChange={(e) => setAttach({ ...attach, design: e.target.value })} aria-label="Design"><option value="">Design…</option>{designs.map((x: any) => <option key={x.id} value={x.id}>{x.collection} — {x.name}</option>)}</Select>
        <Select value={attach.product} onChange={(e) => setAttach({ ...attach, product: e.target.value })} aria-label="Product"><option value="">Product…</option>{products.data?.filter((p) => p.is_customizable).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Button variant="outline" onClick={link}>Attach</Button><p className="text-xs text-muted-foreground">Only products with customization enabled are listed.</p></CardContent></Card>
    </div>
    <QueryBoundary query={q} empty={{ title: "No collections yet", hint: "Create a collection, then upload designs into it." }}>{(cols) => (
      <div className="mt-8 space-y-6">{cols.map((c: any) => (<section key={c.id}><h2 className="mb-3 text-3xl">{c.name}</h2>
        {c.admin_designs.length === 0 ? <p className="text-sm text-muted-foreground">No designs yet.</p> : <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{c.admin_designs.map((x: any) => (
          <div key={x.id} className="rounded-lg border border-border p-2"><img src={publicImageUrl(x.storage_path, "admin-designs")} alt={x.name} className="aspect-square w-full rounded object-cover" /><p className="mt-2 text-sm font-semibold">{x.name}</p><p className="text-xs text-muted-foreground">+{formatINR(x.extra_price)}</p></div>))}</div>}</section>))}</div>)}</QueryBoundary></>);
}

// ---------- Reports ----------
export function Reports() {
  const orders = useQuery({ queryKey: ["admin", "orders"], queryFn: api.adminOrders });
  const payments = useQuery({ queryKey: ["admin", "payments"], queryFn: api.adminPayments });
  const [days, setDays] = useState(30);
  const rows = useMemo(() => {
    const since = Date.now() - days * 86400000; const byDay = new Map<string, { orders: number; revenue: number }>();
    (orders.data ?? []).filter((o) => ["paid", "processing", "shipped", "delivered"].includes(o.status) && new Date(o.created_at).getTime() >= since).forEach((o) => {
      const k = o.created_at.slice(0, 10); const r = byDay.get(k) ?? { orders: 0, revenue: 0 }; r.orders++; r.revenue += Number(o.total); byDay.set(k, r); });
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, v]) => ({ date, orders: v.orders, revenue: v.revenue }));
  }, [orders.data, days]);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const unreconciled = (payments.data ?? []).filter((p) => p.status === "created" && Date.now() - new Date(p.created_at).getTime() > 3600_000);
  return (<><AdminTitle title="Reports">
    <Select className="w-40" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></Select>
    <Button variant="outline" onClick={() => downloadCsv(`sales-${days}d.csv`, rows)} disabled={rows.length === 0}>Export CSV</Button></AdminTitle>
    <QueryBoundary query={orders} empty={{ title: "No orders yet" }}>{() => (<div className="space-y-8">
      <Card><CardContent className="pt-5"><p className="eyebrow">Revenue ({days} days)</p><p className="mt-2 font-display text-6xl">{formatINR(total)}</p><p className="text-sm text-muted-foreground">{rows.reduce((s, r) => s + r.orders, 0)} paid orders</p></CardContent></Card>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No paid orders in this period.</p> : <Table head={["Date", "Orders", "Revenue"]}>{rows.map((r) => <tr key={r.date}><td>{formatDate(r.date)}</td><td>{r.orders}</td><td>{formatINR(r.revenue)}</td></tr>)}</Table>}
      <section><h2 className="mb-2 text-3xl">Reconciliation</h2><p className="mb-3 text-sm text-muted-foreground">Payments started more than an hour ago that never completed. Check them in Razorpay; the webhook will reconcile any that were actually captured.</p>
        {unreconciled.length === 0 ? <p className="text-sm text-muted-foreground">Nothing outstanding.</p> : <Table head={["Created", "For", "Razorpay order", "Amount"]}>{unreconciled.map((p) => <tr key={p.id}><td>{formatDateTime(p.created_at)}</td><td>{titleCase(p.purpose)}</td><td className="font-mono text-xs">{p.razorpay_order_id}</td><td>{formatINR(p.amount)}</td></tr>)}</Table>}</section>
    </div>)}</QueryBoundary></>);
}

// ---------- Settings ----------
function SettingsForm({ k, fields, title }: { k: string; title: string; fields: { name: string; label: string; type?: string }[] }) {
  const q = useQuery({ queryKey: ["setting", k], queryFn: () => fetchSetting<Record<string, string | number>>(k) });
  const [v, setV] = useState<Record<string, string | number>>({});
  const save = useAction(() => api.saveSetting(k, Object.fromEntries(fields.map((f) => { const raw = v[f.name] ?? q.data?.[f.name] ?? ""; return [f.name, f.type === "number" ? (raw === "" ? null : Number(raw)) : raw]; }))), { invalidate: [["setting", k]], success: "Saved" });
  return (<Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-3">
    {fields.map((f) => <Field key={f.name} label={f.label}><Input type={f.type ?? "text"} value={String(v[f.name] ?? q.data?.[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} /></Field>)}
    <Button loading={save.isPending} onClick={() => save.mutate(undefined as never)}>Save</Button></CardContent></Card>);
}

function Testimonials() {
  const q = useQuery({ queryKey: ["admin", "testimonials"], queryFn: api.adminTestimonials });
  const [t, setT] = useState({ author: "", quote: "" });
  const add = useAction(() => api.saveTestimonial(t), { invalidate: [["admin", "testimonials"], ["testimonials"]], success: "Added", onDone: () => setT({ author: "", quote: "" }) });
  const del = useAction((id: string) => api.deleteTestimonial(id), { invalidate: [["admin", "testimonials"], ["testimonials"]] });
  return (<Card className="lg:col-span-2"><CardHeader><CardTitle>Testimonials</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 md:grid-cols-[200px_1fr_auto]"><Input placeholder="Author" value={t.author} onChange={(e) => setT({ ...t, author: e.target.value })} aria-label="Author" /><Textarea className="min-h-[44px]" placeholder="Quote" value={t.quote} onChange={(e) => setT({ ...t, quote: e.target.value })} aria-label="Quote" /><Button disabled={!t.author.trim() || !t.quote.trim()} loading={add.isPending} onClick={() => add.mutate(undefined as never)}>Add</Button></div>
    <ul className="space-y-2 text-sm">{q.data?.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><span>“{x.quote}” — <span className="text-muted-foreground">{x.author}</span></span><button aria-label="Delete" onClick={() => del.mutate(x.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button></li>)}</ul></CardContent></Card>);
}

function Roles() {
  const q = useQuery({ queryKey: ["admin", "roles"], queryFn: api.listRoles });
  const [email, setEmail] = useState(""); const [role, setRole] = useState("staff");
  const grant = useAction(() => api.grantRole(email, role), { invalidate: [["admin", "roles"]], success: "Role granted", onDone: () => setEmail("") });
  const revoke = useAction((id: string) => api.revokeRole(id), { invalidate: [["admin", "roles"]], success: "Role removed" });
  return (<Card className="lg:col-span-2"><CardHeader><CardTitle>Team & roles (super admin)</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">There is no public admin sign-up. Ask the person to register as a normal customer, then grant a role here.</p>
    <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]"><Input type="email" placeholder="user@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="User email" />
      <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="staff">Staff</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></Select>
      <Button disabled={!email.trim()} loading={grant.isPending} onClick={() => grant.mutate(undefined as never)}>Grant</Button></div>
    <Table head={["User", "Role", ""]}>{q.data?.map((r: any) => <tr key={r.id}><td>{r.profiles?.full_name || r.profiles?.email}<br /><span className="text-xs text-muted-foreground">{r.profiles?.email}</span></td><td>{titleCase(r.role)}</td><td className="text-right"><Button size="sm" variant="ghost" onClick={() => revoke.mutate(r.id)}>Remove</Button></td></tr>)}</Table></CardContent></Card>);
}

export function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  return (<><AdminTitle title="Website settings" /><div className="grid gap-6 lg:grid-cols-2">
    <SettingsForm k="hero" title="Homepage hero" fields={[{ name: "headline", label: "Headline" }, { name: "subheadline", label: "Subheadline" }]} />
    <SettingsForm k="contact" title="Contact details" fields={[{ name: "email", label: "Email" }, { name: "phone", label: "Phone" }, { name: "address", label: "Address" }]} />
    <SettingsForm k="shipping" title="Shipping charges" fields={[{ name: "flat_rate", label: "Flat rate (₹)", type: "number" }, { name: "free_above", label: "Free shipping above (₹, blank = never)", type: "number" }]} />
    <Testimonials />{isSuperAdmin && <Roles />}</div></>);
}

// ---------- Audit logs ----------
export function AuditLogs() {
  const q = useQuery({ queryKey: ["admin", "audit"], queryFn: api.auditLogs });
  return (<><AdminTitle title="Audit logs" /><QueryBoundary query={q} empty={{ title: "No activity recorded yet" }}>{(rows) => (
    <Table head={["When", "Who", "Action", "Entity", "ID"]}>{rows.map((r: any) => <tr key={r.id}><td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td><td>{r.profiles?.full_name || r.profiles?.email || "system"}</td><td>{r.action}</td><td>{r.entity}</td><td className="font-mono text-xs">{r.entity_id?.slice(0, 8)}</td></tr>)}</Table>)}</QueryBoundary></>);
}
