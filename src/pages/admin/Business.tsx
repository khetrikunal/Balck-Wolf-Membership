import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { QueryBoundary } from "@/components/common/States";
import { AdminTitle, Modal, Table, useAction } from "@/components/admin/ui";
import * as api from "@/services/admin";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import type { Category, Coupon, MembershipPlan } from "@/types/db";

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
  return (<><AdminTitle title="Membership plans"><Button onClick={() => setEdit({ name: "", price: 0, duration: 1, duration_unit: "months", status: "inactive", benefitsText: "" })}><Plus className="h-4 w-4" /> New plan</Button></AdminTitle>
    <QueryBoundary query={q} empty={{ title: "No plans yet" }}>{(list) => (
      <Table head={["Plan", "Price", "Duration", "Status", ""]}>{list.map((p) => <tr key={p.id}><td className="font-semibold">{p.name}</td><td>{formatINR(p.price)}</td><td>{p.duration_unit === "lifetime" ? "Lifetime" : `${p.duration} ${p.duration_unit}`}</td><td><Badge status={p.status} /></td>
        <td className="whitespace-nowrap text-right"><Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)}>{p.status === "active" ? "Deactivate" : "Activate"}</Button><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ ...p, benefitsText: (p.benefits ?? []).join("\n") })}><Pencil className="h-4 w-4" /></Button></td></tr>)}</Table>)}</QueryBoundary>
    {edit && <Modal title={edit.id ? "Edit plan" : "New plan"} onClose={() => setEdit(null)}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" className="md:col-span-2"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
        <Field label="Description" className="md:col-span-2"><Textarea className="min-h-[70px]" value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
        <Field label="Price (₹)"><Input type="number" min={0} value={edit.price ?? 0} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field>
        <Field label="Status"><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as MembershipPlan["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
        <Field label="Duration unit"><Select value={edit.duration_unit} onChange={(e) => setEdit({ ...edit, duration_unit: e.target.value as MembershipPlan["duration_unit"] })}><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option><option value="lifetime">Lifetime</option></Select></Field>
        {edit.duration_unit !== "lifetime" && <Field label="Duration"><Input type="number" min={1} value={edit.duration ?? 1} onChange={(e) => setEdit({ ...edit, duration: Number(e.target.value) })} /></Field>}
        <Field label="Benefits (one per line)" className="md:col-span-2"><Textarea value={edit.benefitsText ?? ""} onChange={(e) => setEdit({ ...edit, benefitsText: e.target.value })} /></Field>
        <div className="md:col-span-2"><Button loading={save.isPending} onClick={() => save.mutate(edit)}>Save plan</Button></div></div></Modal>}</>);
}

// ---------- Members ----------
export function Members() {
  const q = useQuery({ queryKey: ["admin", "members"], queryFn: api.adminMembers });
  const set = useAction((v: { id: string; status: "active" | "suspended" | "cancelled" }) => api.setMembershipStatus(v.id, v.status), { invalidate: [["admin", "members"], ["admin", "stats"]], success: "Membership updated" });
  return (<><AdminTitle title="Members" />
    <QueryBoundary query={q} empty={{ title: "No members yet" }}>{(list) => (
      <Table head={["Member", "No.", "Plan", "Status", "Expires", ""]}>{list.map((m) => { const live = m.status === "active" && (!m.expires_at || new Date(m.expires_at) > new Date()); return (
        <tr key={m.id}><td>{m.profiles?.full_name || m.profiles?.email}<br /><span className="text-xs text-muted-foreground">{m.profiles?.email}</span></td><td className="font-mono text-xs">{m.membership_number ?? "—"}</td><td>{m.plan_snapshot?.name}</td>
          <td><Badge status={m.status === "active" && !live ? "expired" : m.status} /></td><td>{m.status === "active" && !m.expires_at ? "Lifetime" : formatDate(m.expires_at)}</td>
          <td className="whitespace-nowrap text-right">{m.status === "suspended"
            ? <Button size="sm" variant="outline" onClick={() => set.mutate({ id: m.id, status: m.expires_at && new Date(m.expires_at) < new Date() ? "cancelled" : "active" })}>Reinstate</Button>
            : m.status === "active" && <Button size="sm" variant="ghost" onClick={() => set.mutate({ id: m.id, status: "suspended" })}>Suspend</Button>}</td></tr>); })}</Table>)}</QueryBoundary></>);
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
