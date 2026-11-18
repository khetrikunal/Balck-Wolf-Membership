import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { QueryBoundary } from "@/components/common/States";
import { AdminTitle, Modal, Table, useAction } from "@/components/admin/ui";
import { useAuth } from "@/hooks/useAuth";
import * as api from "@/services/admin";
import { signedDesignUrl } from "@/services/account";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import type { CustomRequest, Order, Shipment } from "@/types/db";

const ORDER_STATUSES = ["paid", "processing", "shipped", "delivered", "cancelled", "refunded"];
const SHIP_STATUSES = ["pending", "packed", "shipped", "in_transit", "out_for_delivery", "delivered", "returned"];
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined);

// ---------- Orders & shipping ----------
function ShipmentForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const s = one<Shipment>(order.shipments);
  const [f, setF] = useState({ courier_name: s?.courier_name ?? "", tracking_number: s?.tracking_number ?? "", tracking_url: s?.tracking_url ?? "", status: s?.status ?? "pending" });
  const save = useAction(async () => {
    if (f.tracking_url && !/^https?:\/\//i.test(f.tracking_url)) throw new Error("Tracking URL must start with http:// or https://");
    await api.saveShipment(order.id, { courier_name: f.courier_name || null, tracking_number: f.tracking_number || null, tracking_url: f.tracking_url || null, status: f.status, shipped_at: s?.shipped_at ?? null });
  }, { invalidate: [["admin", "orders"]], success: "Shipment updated", onDone });
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Courier"><Input value={f.courier_name} onChange={(e) => setF({ ...f, courier_name: e.target.value })} /></Field>
      <Field label="Tracking number"><Input value={f.tracking_number} onChange={(e) => setF({ ...f, tracking_number: e.target.value })} /></Field>
      <Field label="Tracking URL" className="md:col-span-2"><Input value={f.tracking_url} onChange={(e) => setF({ ...f, tracking_url: e.target.value })} placeholder="https://…" /></Field>
      <Field label="Shipment status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{SHIP_STATUSES.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select></Field>
      <div className="flex items-end gap-2"><Button loading={save.isPending} onClick={() => save.mutate(undefined as never)}>Save shipment</Button>
        <Button variant="outline" onClick={() => { setF({ ...f, status: "delivered" }); }}>Mark delivered</Button></div>
    </div>);
}

function OrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const setStatus = useAction((status: string) => api.setOrderStatus(order.id, status), { invalidate: [["admin", "orders"]], success: "Order updated" });
  const a = order.shipping_address;
  return (
    <Modal title={`Order ${order.order_number}`} onClose={onClose} wide>
      <div className="space-y-6 text-sm">
        <div className="flex flex-wrap items-center gap-3"><Badge status={order.status} /><span className="text-muted-foreground">{formatDateTime(order.created_at)} · {order.profiles?.full_name || order.profiles?.email}</span>
          <Select className="ml-auto w-44" value={order.status} onChange={(e) => setStatus.mutate(e.target.value)} aria-label="Order status">{[...new Set([order.status, ...ORDER_STATUSES])].map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select></div>
        <Table head={["Item", "Qty", "Price", "Total"]}>{order.order_items?.map((i) => <tr key={i.id}><td>{i.product_name} <span className="text-muted-foreground">{i.color}/{i.size}</span></td><td>{i.quantity}</td><td>{formatINR(i.unit_price)}</td><td>{formatINR(i.line_total)}</td></tr>)}</Table>
        <p>Total <strong>{formatINR(order.total)}</strong>{order.is_member_pricing && " · member pricing applied"}</p>
        <p className="text-muted-foreground">Ship to: {a.full_name}, {a.line1}{a.line2 && `, ${a.line2}`}, {a.city}, {a.state} {a.postal_code} · {a.phone}</p>
        <div><h3 className="mb-2 text-2xl">Shipping</h3><ShipmentForm order={order} onDone={onClose} /></div>
      </div>
    </Modal>);
}

export function Orders({ shippingView = false }: { shippingView?: boolean }) {
  const q = useQuery({ queryKey: ["admin", "orders"], queryFn: api.adminOrders });
  const [open, setOpen] = useState<Order | null>(null);
  const [filter, setFilter] = useState("");
  return (<><AdminTitle title={shippingView ? "Shipping" : "Orders"}>
    <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter status"><option value="">All statuses</option>{ORDER_STATUSES.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select></AdminTitle>
    <QueryBoundary query={q} empty={{ title: "No orders yet" }}>{(list) => (
      <Table head={["Order", "Customer", "Date", "Total", "Status", shippingView ? "Shipment" : "Items", ""]}>{list.filter((o) => !filter || o.status === filter).map((o) => { const s = one<Shipment>(o.shipments); return (
        <tr key={o.id}><td className="font-semibold">{o.order_number}</td><td>{o.profiles?.full_name || o.profiles?.email}</td><td>{formatDate(o.created_at)}</td><td>{formatINR(o.total)}</td><td><Badge status={o.status} /></td>
          <td>{shippingView ? (s ? `${titleCase(s.status)}${s.tracking_number ? ` · ${s.tracking_number}` : ""}` : "—") : o.order_items?.length}</td>
          <td className="text-right"><Button size="sm" variant="outline" onClick={() => setOpen(o)}>Manage</Button></td></tr>); })}</Table>)}</QueryBoundary>
    {open && <OrderModal order={open} onClose={() => setOpen(null)} />}</>);
}
export const Shipping = () => <Orders shippingView />;

// ---------- Inventory ----------
export function Inventory() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["admin", "variants"], queryFn: api.adminVariants });
  const logs = useQuery({ queryKey: ["admin", "inv-logs"], queryFn: api.inventoryLogs });
  const [adj, setAdj] = useState<Record<string, string>>({});
  const apply = useAction((v: { id: string; delta: number }) => api.adjustStock(v.id, v.delta, "manual adjustment", user!.id), { invalidate: [["admin", "variants"], ["admin", "inv-logs"], ["admin", "stats"]], success: "Stock updated" });
  return (<><AdminTitle title="Inventory" />
    <QueryBoundary query={q} empty={{ title: "No variants yet", hint: "Add sizes and colours to products first." }}>{(list) => (
      <Table head={["Product", "Variant", "Stock", "Adjust (+/−)", ""]}>{list.filter((v) => v.is_active).map((v) => (
        <tr key={v.id}><td className="font-semibold">{v.products.name}</td><td>{v.size} / {v.color}</td>
          <td className={v.stock === 0 ? "text-destructive" : v.stock <= v.low_stock_threshold ? "text-amber-400" : ""}>{v.stock}{v.stock <= v.low_stock_threshold && " ⚠"}</td>
          <td><Input className="h-9 w-24" type="number" value={adj[v.id] ?? ""} onChange={(e) => setAdj({ ...adj, [v.id]: e.target.value })} aria-label={`Adjust ${v.products.name}`} /></td>
          <td><Button size="sm" variant="outline" disabled={!adj[v.id] || Number(adj[v.id]) === 0} onClick={() => { apply.mutate({ id: v.id, delta: parseInt(adj[v.id], 10) }); setAdj({ ...adj, [v.id]: "" }); }}>Apply</Button></td></tr>))}</Table>)}</QueryBoundary>
    <h2 className="mb-3 mt-10 text-3xl">Recent stock movements</h2>
    <QueryBoundary query={logs} empty={{ title: "No stock movements yet" }}>{(rows) => (
      <Table head={["Date", "Product", "Change", "Reason"]}>{rows.map((r: any) => <tr key={r.id}><td>{formatDateTime(r.created_at)}</td><td>{r.product_variants?.products?.name} {r.product_variants?.size}/{r.product_variants?.color}</td><td className={r.change < 0 ? "text-destructive" : "text-emerald-400"}>{r.change > 0 ? `+${r.change}` : r.change}</td><td>{r.reason}</td></tr>)}</Table>)}</QueryBoundary></>);
}

// ---------- Custom requests ----------
function RequestModal({ req, onClose }: { req: CustomRequest; onClose: () => void }) {
  const inv = [["admin", "custom"], ["admin", "quotes"], ["admin", "stats"]];
  const [notes, setNotes] = useState(req.admin_notes ?? "");
  const [amount, setAmount] = useState("");
  const [qnotes, setQnotes] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const setStatus = useAction((status: string) => api.updateRequest(req.id, { status, admin_notes: notes || undefined }), { invalidate: inv, success: "Request updated", onDone: onClose });
  const quote = useAction(async () => { const n = Number(amount); if (!(n > 0)) throw new Error("Enter a valid quotation amount"); await api.sendQuote(req.id, n, qnotes); }, { invalidate: inv, success: "Quotation sent", onDone: onClose });
  const reveal = async (id: string, path: string) => setUrls({ ...urls, [id]: await signedDesignUrl(path) });
  const canQuote = req.status === "approved" || req.status === "quotation_sent";
  return (
    <Modal title="Custom request" onClose={onClose} wide>
      <div className="space-y-5 text-sm">
        <p><Badge status={req.status} /> <span className="ml-2 text-muted-foreground">{req.profiles?.full_name || req.profiles?.email} · {req.clothing_type} · {req.size} · {req.color} × {req.quantity}</span></p>
        {req.instructions && <p className="rounded-md bg-muted p-3">{req.instructions}</p>}
        <div className="flex flex-wrap gap-3">{req.custom_design_files?.map((f) => (
          <div key={f.id}>{urls[f.id] ? <a href={urls[f.id]} target="_blank" rel="noopener noreferrer"><img src={urls[f.id]} alt="Customer design" className="h-32 rounded border border-border" /></a> : <Button size="sm" variant="outline" onClick={() => reveal(f.id, f.storage_path)}>View design</Button>}</div>))}</div>
        <Field label="Notes to customer"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          {req.status === "submitted" && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate("under_review")}>Mark under review</Button>}
          {["submitted", "under_review"].includes(req.status) && <><Button size="sm" onClick={() => setStatus.mutate("approved")}>Approve</Button><Button size="sm" variant="destructive" onClick={() => setStatus.mutate("rejected")}>Reject</Button></>}
          {req.status === "paid" && <Button size="sm" onClick={() => setStatus.mutate("in_production")}>Start production</Button>}
          {req.status === "in_production" && <Button size="sm" onClick={() => setStatus.mutate("completed")}>Mark completed</Button>}
        </div>
        {canQuote && (<div className="space-y-3 border-t border-border pt-4"><h3 className="text-2xl">{req.status === "quotation_sent" ? "Replace quotation" : "Create quotation"}</h3>
          <div className="grid gap-3 md:grid-cols-2"><Field label="Amount (₹)"><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Quote notes"><Input value={qnotes} onChange={(e) => setQnotes(e.target.value)} /></Field></div>
          <Button loading={quote.isPending} onClick={() => quote.mutate(undefined as never)}>Send quotation</Button></div>)}
      </div>
    </Modal>);
}

export function CustomRequests() {
  const q = useQuery({ queryKey: ["admin", "custom"], queryFn: api.adminCustomRequests });
  const [open, setOpen] = useState<CustomRequest | null>(null);
  return (<><AdminTitle title="Custom requests" />
    <QueryBoundary query={q} empty={{ title: "No custom requests" }}>{(list) => (
      <Table head={["Customer", "Item", "Qty", "Submitted", "Status", ""]}>{list.map((r) => (
        <tr key={r.id}><td>{r.profiles?.full_name || r.profiles?.email}</td><td>{r.clothing_type} · {r.size} · {r.color}</td><td>{r.quantity}</td><td>{formatDate(r.created_at)}</td><td><Badge status={r.status} /></td><td className="text-right"><Button size="sm" variant="outline" onClick={() => setOpen(r)}>Review</Button></td></tr>))}</Table>)}</QueryBoundary>
    {open && <RequestModal req={open} onClose={() => setOpen(null)} />}</>);
}

export function Quotations() {
  const q = useQuery({ queryKey: ["admin", "quotes"], queryFn: api.adminQuotes });
  return (<><AdminTitle title="Quotations" />
    <QueryBoundary query={q} empty={{ title: "No quotations yet", hint: "Approve a custom request, then create a quotation from it." }}>{(rows) => (
      <Table head={["Date", "Customer", "Item", "Amount", "Status", "Notes"]}>{rows.map((r: any) => (
        <tr key={r.id}><td>{formatDate(r.created_at)}</td><td>{r.custom_design_requests?.profiles?.full_name || r.custom_design_requests?.profiles?.email}</td><td>{r.custom_design_requests?.clothing_type}</td><td>{formatINR(r.amount)}</td><td><Badge status={r.status} /></td><td className="text-muted-foreground">{r.notes}</td></tr>))}</Table>)}</QueryBoundary></>);
}
