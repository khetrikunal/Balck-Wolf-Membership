import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, QueryBoundary } from "@/components/common/States";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useCart, useCartMutations, useIsMember } from "@/hooks/useShop";
import { displayPrice, productImage } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/supabase";
import { formatINR } from "@/lib/utils";
import type { CartItem } from "@/types/db";

export function cartLine(i: CartItem, isMember: boolean) {
  const v = i.product_variants; const p = v.products;
  const { price } = displayPrice(p, v, isMember);
  return { price, total: price * i.quantity, p, v };
}

export default function Cart() {
  const { user } = useAuth();
  const { isMember } = useIsMember();
  const cart = useCart();
  const { setQty } = useCartMutations();

  if (!user) return (<><PageHeader title="Cart" /><EmptyState title="Sign in to view your cart" hint="Your cart is saved to your account." action={<Button asChild><Link to="/login" state={{ from: "/cart" }}>Sign in</Link></Button>} /></>);

  return (
    <>
      <PageHeader title="Cart" />
      <div className="container py-10">
        <QueryBoundary query={cart} empty={{ title: "Your cart is empty", hint: "Find something you like.", action: <Button asChild><Link to="/shop">Shop now</Link></Button> }}>
          {(items) => {
            const subtotal = items.reduce((s, i) => s + cartLine(i, isMember).total, 0);
            return (
              <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
                <ul className="divide-y divide-border">
                  {items.map((i) => {
                    const { price, p, v } = cartLine(i, isMember);
                    const img = productImage(p)[0];
                    return (
                      <li key={i.id} className="flex gap-4 py-5">
                        <Link to={`/product/${p.slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-md bg-muted">{img && <img src={publicImageUrl(img.storage_path)} alt="" className="h-full w-full object-cover" />}</Link>
                        <div className="flex flex-1 flex-col justify-between">
                          <div><Link to={`/product/${p.slug}`} className="font-semibold">{p.name}</Link>
                            <p className="text-sm text-muted-foreground">{v.color} · {v.size}</p>
                            {v.stock < i.quantity && <p className="text-xs text-destructive">Only {v.stock} in stock</p>}</div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center rounded-md border border-input">
                              <button className="p-2" aria-label="Decrease" onClick={() => setQty.mutate({ itemId: i.id, quantity: i.quantity - 1 })}><Minus className="h-3.5 w-3.5" /></button>
                              <span className="w-8 text-center text-sm">{i.quantity}</span>
                              <button className="p-2" aria-label="Increase" onClick={() => setQty.mutate({ itemId: i.id, quantity: i.quantity + 1 })}><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                            <span className="font-semibold">{formatINR(price * i.quantity)}</span>
                          </div>
                        </div>
                        <button aria-label="Remove" className="self-start text-muted-foreground hover:text-destructive" onClick={() => setQty.mutate({ itemId: i.id, quantity: 0 })}><Trash2 className="h-4 w-4" /></button>
                      </li>);
                  })}
                </ul>
                <aside className="h-fit rounded-lg border border-border bg-card p-6">
                  <h2 className="text-2xl">Summary</h2>
                  <div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Subtotal{isMember && " (member prices)"}</span><span>{formatINR(subtotal)}</span></div>
                  <p className="mt-2 text-xs text-muted-foreground">Shipping, coupons and the final amount are calculated securely at checkout.</p>
                  <Button className="mt-6 w-full" size="lg" asChild><Link to="/checkout">Checkout</Link></Button>
                </aside>
              </div>);
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
