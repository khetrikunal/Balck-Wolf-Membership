import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressForm, type AddressValues } from "@/components/common/AddressForm";
import { EmptyState, Loading } from "@/components/common/States";
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
  if (items.length === 0) return <div className="container py-24"><EmptyState title="Your cart is empty" hint="Your next favorite piece is waiting." action={<Button asChild><Link to="/shop">Shop now</Link></Button>} /></div>;

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

  const summary = <>
    <ul className="space-y-4">{items.map((i) => { const line = cartLine(i, isMember); return <li key={i.id} className="flex justify-between gap-4 text-sm"><span className="min-w-0">{line.p.name}<span className="block text-muted-foreground">{line.v.size} / {line.v.color} × {i.quantity}</span></span><span className="shrink-0">{formatINR(line.total)}</span></li>; })}</ul>
    <div className="mt-5 flex gap-2"><Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} aria-label="Coupon code" /></div>
    <div className="mt-5 flex justify-between border-t border-border pt-4"><span className="text-muted-foreground">Subtotal{isMember && " · member prices"}</span><span className="font-semibold">{formatINR(subtotal)}</span></div>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Shipping and coupon discounts are confirmed by our server. The payment window shows the final amount.</p>
  </>;

  return <div className="container max-w-6xl py-8 md:py-12">
      <div className="mb-8 border-b border-border pb-6"><p className="eyebrow">Your order</p><h1 className="mt-2 text-6xl leading-none">Checkout</h1><ol className="mt-6 flex flex-wrap items-center gap-4 text-sm"><li className="flex items-center gap-2 text-foreground"><span className="flex h-7 w-7 items-center justify-center bg-primary text-xs text-primary-foreground">1</span>Address</li><span className="h-px w-8 bg-border"/><li className="flex items-center gap-2 text-muted-foreground"><span className="flex h-7 w-7 items-center justify-center border border-border text-xs">2</span>Payment</li><span className="h-px w-8 bg-border"/><li className="flex items-center gap-2 text-muted-foreground"><span className="flex h-7 w-7 items-center justify-center border border-border text-xs">3</span>Confirmation</li></ol></div>
      <details className="mb-7 border border-border p-4 lg:hidden"><summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm uppercase tracking-wider">Order summary · {formatINR(subtotal)} <span aria-hidden="true">＋</span></summary><div className="pt-4">{summary}</div></details>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <h2 className="mb-5 font-display text-4xl">Delivery address</h2>
          {saved.length > 0 && (
            <div className="mb-6 grid gap-3 md:grid-cols-2">
              {saved.map((a) => (
              <button key={a.id} onClick={() => setSelected(a.id)} className={cn("min-h-28 border p-4 text-left text-base transition-colors", chosen?.id === a.id && !showForm ? "border-primary bg-accent" : "border-border hover:border-primary/60")}>
                  <p className="font-semibold">{a.full_name}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.postal_code}<br />{a.phone}</p></button>))}
              <button onClick={() => setSelected("new")} className={cn("min-h-28 border border-dashed p-4 text-base transition-colors", showForm ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/60")}>+ Use a new address</button>
            </div>)}
          {showForm
            ? <AddressForm submitLabel="Continue to secure payment" busy={busy} onSubmit={pay} />
            : chosen && <Button size="lg" loading={busy} onClick={() => pay({ ...chosen, line2: chosen.line2 ?? "" } as AddressValues)}>Continue to secure payment</Button>}
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" />Your payment is processed securely by Razorpay.</p>
        </section>
        <aside className="hidden h-fit border border-border bg-card p-6 lg:sticky lg:top-24 lg:block"><h2 className="mb-5 font-display text-3xl">Order summary</h2>{summary}</aside>
      </div>
    </div>;
}
