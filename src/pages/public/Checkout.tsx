import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressForm, type AddressValues } from "@/components/common/AddressForm";
import { EmptyState, Loading } from "@/components/common/States";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useCart, useIsMember } from "@/hooks/useShop";
import { fetchAddresses, startProductOrder } from "@/services/account";
import { runPayment } from "@/lib/payFlow";
import { cartLine } from "@/pages/public/Cart";
import { cn, errorMessage, formatINR } from "@/lib/utils";

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isMember } = useIsMember();
  const cart = useCart();
  const addresses = useQuery({ queryKey: ["addresses", user?.id], queryFn: fetchAddresses, enabled: !!user });
  const [selected, setSelected] = useState<string | "new">();
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);

  if (cart.isLoading || addresses.isLoading) return <Loading />;
  const items = cart.data ?? [];
  if (items.length === 0) return <EmptyState title="Your cart is empty" action={<Button asChild><Link to="/shop">Shop now</Link></Button>} />;

  const subtotal = items.reduce((s, i) => s + cartLine(i, isMember).total, 0);
  const saved = addresses.data ?? [];
  const chosen = selected === "new" ? undefined : saved.find((a) => a.id === (selected ?? saved.find((x) => x.is_default)?.id ?? saved[0]?.id));
  const showForm = selected === "new" || saved.length === 0;

  async function pay(addr: AddressValues) {
    setBusy(true);
    try {
      const body = {
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
        address: { ...addr, line2: addr.line2 || null },
        coupon_code: coupon.trim() || null,
      };
      const start = await startProductOrder(body);          // server prices the order
      const res = await runPayment(start, { name: addr.full_name, email: user?.email ?? undefined, contact: addr.phone }, `Order ${start.order_number}`);
      await qc.invalidateQueries();
      navigate(`/order/success?order=${res.order_id}${res.status === "pending" ? "&pending=1" : ""}`);
    } catch (e) {
      const msg = errorMessage(e);
      if (msg === "Payment cancelled") toast.info("Payment cancelled. Your cart is still here.");
      else navigate(`/order/failure?reason=${encodeURIComponent(msg)}`);
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Checkout" />
      <div className="container grid gap-10 py-10 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-4 text-3xl">Shipping address</h2>
          {saved.length > 0 && (
            <div className="mb-6 grid gap-3 md:grid-cols-2">
              {saved.map((a) => (
                <button key={a.id} onClick={() => setSelected(a.id)} className={cn("rounded-lg border p-4 text-left text-sm", chosen?.id === a.id && !showForm ? "border-silver bg-accent" : "border-border hover:border-silver/50")}>
                  <p className="font-semibold">{a.full_name}</p><p className="text-muted-foreground">{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.postal_code}<br />{a.phone}</p></button>))}
              <button onClick={() => setSelected("new")} className={cn("rounded-lg border border-dashed p-4 text-sm", showForm ? "border-silver" : "border-border text-muted-foreground")}>+ Use a new address</button>
            </div>)}
          {showForm
            ? <AddressForm submitLabel={`Pay securely`} busy={busy} onSubmit={pay} />
            : chosen && <Button size="lg" loading={busy} onClick={() => pay({ ...chosen, line2: chosen.line2 ?? "" } as AddressValues)}>Pay securely</Button>}
        </section>
        <aside className="h-fit rounded-lg border border-border bg-card p-6">
          <h2 className="text-2xl">Order summary</h2>
          <ul className="mt-4 space-y-3 text-sm">{items.map((i) => { const l = cartLine(i, isMember); return (
            <li key={i.id} className="flex justify-between gap-3"><span>{l.p.name} <span className="text-muted-foreground">· {l.v.size}/{l.v.color} × {i.quantity}</span></span><span>{formatINR(l.total)}</span></li>); })}</ul>
          <div className="mt-4 flex gap-2"><Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} aria-label="Coupon code" /></div>
          <div className="mt-4 flex justify-between border-t border-border pt-4"><span className="text-muted-foreground">Subtotal{isMember && " (member prices)"}</span><span className="font-semibold">{formatINR(subtotal)}</span></div>
          <p className="mt-2 text-xs text-muted-foreground">Shipping and coupon discount are applied by our server; the amount in the payment window is final.</p>
        </aside>
      </div>
    </>
  );
}
