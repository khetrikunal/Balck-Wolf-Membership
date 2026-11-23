import { Link } from "react-router-dom";
import { Heart, Minus, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, QueryBoundary } from "@/components/common/States";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useCart, useCartMutations, useIsMember, useToggleWishlist } from "@/hooks/useShop";
import { displayPrice, productImage } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/supabase";
import { formatINR } from "@/lib/utils";
import type { CartItem } from "@/types/db";
import { fetchSetting } from "@/services/catalog";

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
  const wishlist = useToggleWishlist();
  const shipping = useQuery({ queryKey: ["setting", "shipping"], queryFn: () => fetchSetting<{ flat_rate?: number; free_above?: number }>("shipping") });

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
                <ul className="divide-y divide-border border-y border-border">
                  {items.map((i) => {
                    const { price, p, v } = cartLine(i, isMember);
                    const img = productImage(p)[0];
                    return (
                      <li key={i.id} className="flex gap-3 py-5 sm:gap-5">
                        <Link to={`/product/${p.slug}`} className="h-32 w-24 shrink-0 overflow-hidden bg-muted">{img && <img src={publicImageUrl(img.storage_path)} alt={img.alt ?? p.name} className="h-full w-full object-cover" />}</Link>
                        <div className="flex flex-1 flex-col justify-between">
                          <div><Link to={`/product/${p.slug}`} className="text-base font-semibold hover:text-primary">{p.name}</Link>
                            <p className="text-sm text-muted-foreground">{v.color} · Size {v.size}</p>
                            {v.stock < i.quantity && <p className="text-xs text-destructive">Only {v.stock} in stock</p>}</div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center border border-input">
                              <button className="flex h-10 w-10 items-center justify-center" aria-label="Decrease" onClick={() => setQty.mutate({ itemId: i.id, quantity: i.quantity - 1 })}><Minus className="h-3.5 w-3.5" /></button>
                              <span className="w-8 text-center text-sm">{i.quantity}</span>
                              <button className="flex h-10 w-10 items-center justify-center" aria-label="Increase" onClick={() => setQty.mutate({ itemId: i.id, quantity: i.quantity + 1 })}><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                            <span className="font-semibold">{formatINR(price * i.quantity)}</span>
                          </div>
                          <button className="mt-2 inline-flex min-h-10 items-center gap-2 self-start text-sm text-muted-foreground hover:text-primary" onClick={() => wishlist.mutate({ productId: p.id, on: true }, { onSuccess: () => setQty.mutate({ itemId: i.id, quantity: 0 }) })}><Heart className="h-4 w-4" />Move to wishlist</button>
                        </div>
                        <button aria-label="Remove" className="self-start text-muted-foreground hover:text-destructive" onClick={() => setQty.mutate({ itemId: i.id, quantity: 0 })}><Trash2 className="h-4 w-4" /></button>
                      </li>);
                  })}
                </ul>
                <aside className="h-fit border border-border bg-card p-6 lg:sticky lg:top-24">
                  <h2 className="font-display text-3xl">Order summary</h2>
                  <div className="mt-4 flex justify-between text-sm"><span className="text-muted-foreground">Subtotal{isMember && " (member prices)"}</span><span>{formatINR(subtotal)}</span></div>
                  {Number(shipping.data?.free_above) > 0 && <div className="mt-5 border-t border-border pt-4"><p className="text-sm text-muted-foreground">{subtotal >= Number(shipping.data?.free_above) ? "Free shipping unlocked." : `Add ${formatINR(Number(shipping.data?.free_above) - subtotal)} for free shipping.`}</p><div className="mt-2 h-1.5 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, subtotal / Number(shipping.data?.free_above) * 100)}%` }} /></div></div>}
                  <p className="mt-3 text-sm text-muted-foreground">Shipping, coupons and the final amount are calculated securely at checkout.</p>
                  <Button className="mt-6 w-full" size="lg" asChild><Link to="/checkout">Checkout</Link></Button>
                </aside>
              </div>);
          }}
        </QueryBoundary>
      </div>
    </>
  );
}
