import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Pencil, Plus, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { QueryBoundary } from "@/components/common/States";
import { AdminTitle, Modal, Table, useAction } from "@/components/admin/ui";
import * as api from "@/services/admin";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import type { Category, Coupon, MembershipPlan } from "@/types/db";
import { useAuth } from "@/hooks/useAuth";

// ---------- Categories ----------
export function Categories() {
  const q = useQuery({ queryKey: ["admin", "categories"], queryFn: api.adminCategories });
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const save = useAction((c: Partial<Category> & { name: string }) => api.saveCategory(c), { invalidate: [["admin", "categories"]], success: "Category saved", onDone: () => setEdit(null) });
  return (<><AdminTitle title="Categories"><Button onClick={() => setEdit({ name: "", sort_order: 0, is_active: true })}><Plus className="h-4 w-4" /> New category</Button></AdminTitle>
    <QueryBoundary query={q} empty={{ title: "No categories" }}>{(list) => (
      <Table head={["Name", "Slug", "Order", "Status", ""]}>{list.map((c) => <tr key={c.id}><td className="font-semibold">{c.name}</td><td className="text-muted-foreground">{c.slug}</td><td>{c.sort_order}</td><td><Badge status={c.is_active ? "active" : "inactive"} /></td>
        <td className="text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button></td></tr>)}</Table>)}</QueryBoundary>
    {edit && <Modal title={edit.id ? "Edit category" : "New category"} onClose={() => setEdit(null)}>
      <div className="space-y-4"><Field label="Name"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Sort order"><Input type="number" value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-white" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Active</label>
        <Button loading={save.isPending} disabled={!edit.name?.trim()} onClick={() => save.mutate(edit as Category)}>Save</Button></div></Modal>}</>);
}

// ---------- Membership plans ----------
export function Plans() {
  const q = useQuery({ queryKey: ["admin", "plans"], queryFn: api.adminPlans });
  const [edit, setEdit] = useState<(Partial<MembershipPlan> & { benefitsText?: string }) | null>(null);
  const save = useAction(async (p: Partial<MembershipPlan> & { benefitsText?: string }) => {
    if (!p.name?.trim()) throw new Error("Name is required");
    if (!(Number(p.price) >= 0)) throw new Error("Enter a valid price");
    if (p.duration_unit !== "lifetime" && !(Number(p.duration) > 0)) throw new Error("Enter a duration");
    await api.savePlan({ ...p, price: Number(p.price), duration: p.duration_unit === "lifetime" ? null : Number(p.duration), benefits: (p.benefitsText ?? "").split("\n").map((s) => s.trim()).filter(Boolean) });
  }, { invalidate: [["admin", "plans"], ["plans"]], success: "Plan saved", onDone: () => setEdit(null) });
  const toggle = useAction((p: MembershipPlan) => api.savePlan({ ...p, status: p.status === "active" ? "inactive" : "active" }), { invalidate: [["admin", "plans"], ["plans"]], success: "Plan updated" });
  const del = useAction((id: string) => api.deletePlan(id), { invalidate: [["admin", "plans"], ["plans"]], success: "Plan deleted" });
  return (<><AdminTitle title="Membership plans"><Button onClick={() => setEdit({ name: "", price: 0, duration: 1, duration_unit: "months", status: "inactive", benefitsText: "" })}><Plus className="h-4 w-4" /> New plan</Button></AdminTitle>
    <QueryBoundary query={q} empty={{ title: "No plans yet" }}>{(list) => (
      <Table head={["Plan", "Price", "Duration", "Benefits", "Status", ""]}>{list.map((p) => <tr key={p.id}><td className="font-semibold">{p.name}<div className="max-w-xs text-xs font-normal text-muted-foreground">{p.description}</div></td><td>{formatINR(p.price)}</td><td>{p.duration_unit === "lifetime" ? "Lifetime" : `${p.duration} ${p.duration_unit}`}</td><td>{p.benefits?.length ?? 0} features</td><td><Badge status={p.status} /></td>
        <td className="whitespace-nowrap text-right"><Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)}>{p.status === "active" ? "Deactivate" : "Activate"}</Button><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ ...p, benefitsText: (p.benefits ?? []).join("\n") })}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm(`Delete the ${p.name} plan? Plans already attached to memberships cannot be deleted.`) && del.mutate(p.id)}>Delete</Button></td></tr>)}</Table>)}</QueryBoundary>
    {edit && <Modal title={edit.id ? "Edit plan" : "New plan"} onClose={() => setEdit(null)}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" className="md:col-span-2"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Description" className="md:col-span-2"><Textarea className="min-h-[70px]" value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
        <Field label="Price (₹)"><Input type="number" min={0} value={edit.price ?? 0} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field>
        <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as MembershipPlan["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
        <Field label="Duration unit"><Select value={edit.duration_unit} onChange={(e) => setEdit({ ...edit, duration_unit: e.target.value as MembershipPlan["duration_unit"] })}><option value="days">Days</option><option value="months">Months (3 = quarterly, 6 = half-yearly)</option><option value="years">Years</option><option value="lifetime">Lifetime</option></Select></Field>
        {edit.duration_unit !== "lifetime" && <Field label="Duration"><Input type="number" min={1} value={edit.duration ?? 1} onChange={(e) => setEdit({ ...edit, duration: Number(e.target.value) })} /></Field>}
        <Field label="Benefits (one per line)" className="md:col-span-2"><Textarea value={edit.benefitsText ?? ""} onChange={(e) => setEdit({ ...edit, benefitsText: e.target.value })} /></Field>
        <div className="md:col-span-2"><Button loading={save.isPending} onClick={() => save.mutate(edit)}>Save plan</Button></div></div></Modal>}</>);
}

// ---------- Members ----------
export function Members() {
  const { isAdmin } = useAuth();
  const pageSize = 25;
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("all"); const [planId, setPlanId] = useState(""); const [sort, setSort] = useState("newest");
  const [purchaseFrom, setPurchaseFrom] = useState(""); const [purchaseTo, setPurchaseTo] = useState(""); const [expiryFrom, setExpiryFrom] = useState(""); const [expiryTo, setExpiryTo] = useState(""); const [page, setPage] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false); const [userSearch, setUserSearch] = useState(""); const [selectedUser, setSelectedUser] = useState<{ id: string; full_name: string | null; email: string | null; phone: string | null } | null>(null);
  const [historyUser, setHistoryUser] = useState<{ id: string; name: string } | null>(null);
  const [planChoice, setPlanChoice] = useState(""); const [startsAt, setStartsAt] = useState(""); const [expiresAt, setExpiresAt] = useState(""); const [extend, setExtend] = useState(false);
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: api.adminPlans });
  const overview = useQuery({ queryKey: ["admin", "members", search, status, planId, purchaseFrom, purchaseTo, expiryFrom, expiryTo, sort, page], queryFn: () => api.adminMembershipOverview({ search, status, planId, purchaseFrom, purchaseTo, expiryFrom, expiryTo, sort, limit: pageSize, offset: page * pageSize }) });
  const users = useQuery({ queryKey: ["admin", "membership-users", userSearch], queryFn: () => api.searchMembershipUsers(userSearch), enabled: assignOpen && !selectedUser });
  const history = useQuery({ queryKey: ["admin", "membership-history", historyUser?.id], queryFn: () => api.adminMembershipHistory(historyUser!.id), enabled: !!historyUser });
  const set = useAction((v: { id: string; status: "active" | "suspended" | "cancelled" }) => api.setMembershipStatus(v.id, v.status), { invalidate: [["admin", "members"], ["admin", "stats"], ["admin", "membership-stats"]], success: "Membership updated" });
  const assign = useAction(() => api.assignMembership({ userId: selectedUser!.id, planId: planChoice, startsAt: startsAt ? new Date(`${startsAt}T00:00:00`).toISOString() : new Date().toISOString(), expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : "", extend }), { invalidate: [["admin", "members"], ["admin", "stats"], ["admin", "membership-stats"], ["memberships"]], success: extend ? "Membership extended" : "Membership assigned", onDone: () => { setAssignOpen(false); setSelectedUser(null); setUserSearch(""); setPlanChoice(""); setStartsAt(""); setExpiresAt(""); setExtend(false); } });
  const resetFilters = () => { setSearch(""); setStatus("all"); setPlanId(""); setPurchaseFrom(""); setPurchaseTo(""); setExpiryFrom(""); setExpiryTo(""); setSort("newest"); setPage(0); };
  return (<><AdminTitle title="Membership management">{isAdmin && <Button onClick={() => setAssignOpen(true)}><UserPlus className="h-4 w-4" /> Assign membership</Button>}</AdminTitle>
    <div className="mb-5 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Name, email or user ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label>
      <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="all">All statuses</option><option value="active">Active</option><option value="expired">Expired</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option><option value="suspended">Suspended</option><option value="not_subscribed">Not subscribed</option></Select>
      <Select value={planId} onChange={(e) => { setPlanId(e.target.value); setPage(0); }}><option value="">All plans</option>{plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <div className="flex gap-2"><Select aria-label="Sort customers" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }}><option value="newest">Newest users</option><option value="name_asc">Name A–Z</option><option value="purchase_desc">Recent membership</option><option value="expiry_asc">Soonest expiry</option></Select><Button size="sm" variant="ghost" onClick={resetFilters}>Clear</Button></div>
      <Field label="Purchase from"><Input type="date" value={purchaseFrom} onChange={(e) => { setPurchaseFrom(e.target.value); setPage(0); }} /></Field>
      <Field label="Purchase to"><Input type="date" value={purchaseTo} onChange={(e) => { setPurchaseTo(e.target.value); setPage(0); }} /></Field>
      <Field label="Expiry from"><Input type="date" value={expiryFrom} onChange={(e) => { setExpiryFrom(e.target.value); setPage(0); }} /></Field>
      <Field label="Expiry to"><Input type="date" value={expiryTo} onChange={(e) => { setExpiryTo(e.target.value); setPage(0); }} /></Field>
    </div>
    <QueryBoundary query={overview} empty={{ title: "No matching users", hint: "Try changing the filters or search." }}>{(result) => <>
      <p className="mb-3 text-xs text-muted-foreground">{result.total} registered customers · showing {result.rows.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, result.total)}</p>
      <Table head={["Customer", "Plan / source", "Purchase", "Payment / transaction", "Membership", "Period", ""]}>{result.rows.map((m) => {
        const statusLabel = m.current_status.replace(/_/g, " ");
        return <tr key={m.id}><td className="min-w-48"><span className="font-medium">{m.full_name || "Unnamed customer"}</span><br/><span className="text-xs text-muted-foreground">{m.email || "—"}</span><br/><span className="font-mono text-[10px] text-muted-foreground">{m.id}</span>{m.phone && <><br/><span className="text-xs text-muted-foreground">{m.phone}</span></>}</td>
          <td>{m.plan_snapshot?.name ?? "—"}{m.source === "admin" && <span className="mt-1 block text-[10px] uppercase tracking-wider text-primary">Admin assigned</span>}</td>
          <td>{m.purchased_at ? formatDate(m.purchased_at) : "—"}</td>
          <td><Badge status={m.source === "admin" ? "complimentary" : m.payment_status ?? "not subscribed"} />{m.transaction_id && <span className="mt-1 block max-w-40 truncate font-mono text-[10px] text-muted-foreground" title={m.transaction_id}>{m.transaction_id}</span>}</td>
          <td><Badge status={statusLabel} /></td><td className="whitespace-nowrap">{m.starts_at ? formatDate(m.starts_at) : "—"}<br/><span className="text-xs text-muted-foreground">to {m.expires_at ? formatDate(m.expires_at) : m.membership_id ? "Lifetime" : "—"}</span></td>
          <td className="whitespace-nowrap text-right"><Button size="sm" variant="ghost" onClick={() => setHistoryUser({ id: m.id, name: m.full_name || m.email || m.id })}><History className="h-3.5 w-3.5" /> History</Button>{m.membership_id && m.current_status === "suspended" && (!m.expires_at || new Date(m.expires_at) > new Date()) && <Button size="sm" variant="outline" onClick={() => set.mutate({ id: m.membership_id!, status: "active" })}>Reinstate</Button>}{m.membership_id && ["active","pending"].includes(m.current_status) && <><Button size="sm" variant="ghost" onClick={() => set.mutate({ id: m.membership_id!, status: "suspended" })}>Suspend</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm(`Revoke ${m.plan_snapshot?.name ?? "this"} membership for ${m.email}?`) && set.mutate({ id: m.membership_id!, status: "cancelled" })}>Revoke</Button></>}</td></tr>;
      })}</Table>
      <div className="mt-4 flex items-center justify-between"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-xs text-muted-foreground">Page {page + 1} of {Math.max(1, Math.ceil(result.total / pageSize))}</span><Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= result.total} onClick={() => setPage(page + 1)}>Next</Button></div>
    </>}</QueryBoundary>
    {assignOpen && <Modal title="Assign membership" onClose={() => { setAssignOpen(false); setSelectedUser(null); }} wide>
      <div className="space-y-4">
        {!selectedUser ? <><Field label="Find registered customer"><Input autoFocus placeholder="Search by name, email or user ID" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></Field>
          {users.data?.length ? <div className="max-h-56 overflow-y-auto border border-border">{users.data.map((u) => <button key={u.id} className="block w-full border-b border-border p-3 text-left hover:bg-accent" onClick={() => setSelectedUser(u)}><span className="block text-sm">{u.full_name || "Unnamed customer"} · {u.email}</span><span className="text-xs text-muted-foreground">{u.id}{u.phone ? ` · ${u.phone}` : ""}</span></button>)}</div> : <p className="text-sm text-muted-foreground">Search to find a registered customer.</p>}</>
          : <div className="flex items-center justify-between border border-border bg-secondary p-3"><div><p className="text-sm">{selectedUser.full_name || "Unnamed customer"}</p><p className="text-xs text-muted-foreground">{selectedUser.email} · {selectedUser.id}</p></div><Button size="sm" variant="ghost" onClick={() => setSelectedUser(null)}>Change</Button></div>}
        <Field label="Membership plan"><Select value={planChoice} onChange={(e) => setPlanChoice(e.target.value)}><option value="">Select a plan</option>{plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatINR(p.price)} · {p.duration_unit === "lifetime" ? "Lifetime" : `${p.duration} ${p.duration_unit}`}</option>)}</Select></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={extend} onChange={(e) => setExtend(e.target.checked)} /> Extend or change the customer’s active membership</label>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Start date"><Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field><Field label="Custom expiry (optional)"><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></Field></div>
        <p className="text-xs leading-5 text-muted-foreground">Leave the expiry empty to use the selected plan duration. Assignments are complimentary and recorded in the customer’s membership history.</p>
        <Button loading={assign.isPending} disabled={!selectedUser || !planChoice} onClick={() => assign.mutate(undefined as never)}>Assign membership</Button>
      </div>
    </Modal>}
    {historyUser && <Modal title={`Membership history · ${historyUser.name}`} onClose={() => setHistoryUser(null)} wide>
      {history.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading history…</p> : history.error ? <p className="py-8 text-sm text-destructive">Could not load membership history.</p> : !history.data?.length ? <p className="py-8 text-sm text-muted-foreground">No membership events recorded.</p> : <div className="max-h-[65vh] overflow-auto"><Table head={["Date", "Event", "Period", "Payment", "Amount"]}>{history.data.map((e: any) => <tr key={e.id}><td className="whitespace-nowrap">{formatDateTime(e.created_at)}</td><td>{titleCase(e.kind)}</td><td className="whitespace-nowrap">{e.period_start ? formatDate(e.period_start) : "—"} → {e.period_end ? formatDate(e.period_end) : "Lifetime / —"}</td><td className="font-mono text-xs">{e.payments?.razorpay_payment_id ?? "—"}{e.payments?.status && <span className="block font-sans text-muted-foreground">{titleCase(e.payments.status)}</span>}</td><td>{formatINR(e.amount)}</td></tr>)}</Table></div>}
    </Modal>}
  </>);
}

// ---------- Customers / Payments ----------
export function Customers() {
  const q = useQuery({ queryKey: ["admin", "customers"], queryFn: api.adminCustomers });
  return (<><AdminTitle title="Customers" /><QueryBoundary query={q} empty={{ title: "No customers yet" }}>{(list) => (
    <Table head={["Name", "Email", "Phone", "Joined"]}>{list.map((c) => <tr key={c.id}><td className="font-semibold">{c.full_name || "—"}</td><td>{c.email}</td><td>{c.phone || "—"}</td><td>{formatDate(c.created_at)}</td></tr>)}</Table>)}</QueryBoundary></>);
}

export function Payments() {
  const q = useQuery({ queryKey: ["admin", "payments"], queryFn: api.adminPayments });
  return (<><AdminTitle title="Payments" /><QueryBoundary query={q} empty={{ title: "No payments yet" }}>{(list) => (
    <Table head={["Date", "Customer", "For", "Razorpay IDs", "Status", "Amount", "Refunded"]}>{list.map((p) => <tr key={p.id}><td>{formatDateTime(p.created_at)}</td><td>{p.profiles?.full_name || p.profiles?.email}</td><td>{titleCase(p.purpose)}</td>
      <td className="font-mono text-xs">{p.razorpay_order_id}<br />{p.razorpay_payment_id ?? "—"}</td><td><Badge status={p.status} /></td><td>{formatINR(p.amount)}</td><td>{Number(p.refunded_amount) > 0 ? formatINR(p.refunded_amount) : "—"}</td></tr>)}</Table>)}</QueryBoundary>
    <p className="mt-4 text-xs text-muted-foreground">Refunds are issued from the Razorpay dashboard; the webhook records them here automatically (reconciliation).</p></>);
}

// ---------- Coupons ----------
export function Coupons() {
  const q = useQuery({ queryKey: ["admin", "coupons"], queryFn: api.adminCoupons });
  const [edit, setEdit] = useState<Partial<Coupon> | null>(null);
  const save = useAction(async (c: Partial<Coupon>) => {
    if (!c.code?.trim()) throw new Error("Enter a code");
    if (!(Number(c.discount_value) > 0)) throw new Error("Enter a discount value");
    if (c.discount_type === "percent" && Number(c.discount_value) > 100) throw new Error("Percent cannot exceed 100");
    await api.saveCoupon({ ...c, discount_value: Number(c.discount_value), min_order_amount: Number(c.min_order_amount ?? 0), max_uses: c.max_uses ? Number(c.max_uses) : null, starts_at: c.starts_at || null, expires_at: c.expires_at || null });
  }, { invalidate: [["admin", "coupons"]], success: "Coupon saved", onDone: () => setEdit(null) });
  return (<><AdminTitle title="Coupons"><Button onClick={() => setEdit({ code: "", discount_type: "percent", discount_value: 10, min_order_amount: 0, is_active: true })}><Plus className="h-4 w-4" /> New coupon</Button></AdminTitle>
    <QueryBoundary query={q} empty={{ title: "No coupons yet" }}>{(list) => (
      <Table head={["Code", "Discount", "Min order", "Used", "Expires", "Status", ""]}>{list.map((c) => <tr key={c.id}><td className="font-mono font-semibold">{c.code}</td><td>{c.discount_type === "percent" ? `${c.discount_value}%` : formatINR(c.discount_value)}</td><td>{formatINR(c.min_order_amount)}</td><td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td><td>{formatDate(c.expires_at)}</td><td><Badge status={c.is_active ? "active" : "inactive"} /></td>
        <td className="text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button></td></tr>)}</Table>)}</QueryBoundary>
    {edit && <Modal title={edit.id ? "Edit coupon" : "New coupon"} onClose={() => setEdit(null)}><div className="grid gap-4 md:grid-cols-2">
      <Field label="Code"><Input value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
      <Field label="Type"><Select value={edit.discount_type} onChange={(e) => setEdit({ ...edit, discount_type: e.target.value as Coupon["discount_type"] })}><option value="percent">Percent</option><option value="fixed">Fixed (₹)</option></Select></Field>
      <Field label="Value"><Input type="number" min={0} value={edit.discount_value ?? 0} onChange={(e) => setEdit({ ...edit, discount_value: Number(e.target.value) })} /></Field>
      <Field label="Minimum order (₹)"><Input type="number" min={0} value={edit.min_order_amount ?? 0} onChange={(e) => setEdit({ ...edit, min_order_amount: Number(e.target.value) })} /></Field>
      <Field label="Max uses (blank = unlimited)"><Input type="number" min={1} value={edit.max_uses ?? ""} onChange={(e) => setEdit({ ...edit, max_uses: e.target.value ? Number(e.target.value) : null })} /></Field>
      <Field label="Expires"><Input type="date" value={edit.expires_at?.slice(0, 10) ?? ""} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null })} /></Field>
      <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" className="accent-white" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Active</label>
      <div className="md:col-span-2"><Button loading={save.isPending} onClick={() => save.mutate(edit)}>Save coupon</Button></div></div></Modal>}</>);
}
