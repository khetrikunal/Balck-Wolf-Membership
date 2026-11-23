import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart, useCartMutations, useIsMember } from "@/hooks/useShop";
import { displayPrice, productImage } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/supabase";
import { formatINR } from "@/lib/utils";

export function MiniCart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const cart = useCart();
  const { setQty } = useCartMutations();
  const { isMember } = useIsMember();
  const items = cart.data ?? [];
  const subtotal = items.reduce((sum, item) => sum + displayPrice(item.product_variants.products, item.product_variants, isMember).price * item.quantity, 0);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  if (!open) return null;

  return <div className="fixed inset-0 z-[60] bg-black/70" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="mini-cart-title" className="ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-300">
      <header className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="eyebrow">BLACK WOLF</p><h2 id="mini-cart-title" className="font-display text-3xl">Your bag <span className="font-sans text-sm">({items.reduce((n, item) => n + item.quantity, 0)})</span></h2></div><button onClick={onClose} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Close cart"><X /></button></header>
      <div className="flex-1 overflow-y-auto px-5">
        {cart.isLoading ? <div role="status" className="py-10 text-center text-sm text-muted-foreground">Loading your bag…</div> : items.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center"><p className="font-display text-4xl">Your bag is waiting.</p><p className="mt-2 text-sm text-muted-foreground">Find a piece that feels like you.</p><Link onClick={onClose} to="/shop" className="mt-5 inline-flex min-h-11 items-center text-sm uppercase tracking-wider text-primary underline">Explore the collection</Link></div> : <ul className="divide-y divide-border">{items.map((item) => {
          const variant = item.product_variants;
          const product = variant.products;
          const image = productImage(product)[0];
          const price = displayPrice(product, variant, isMember).price;
          return <li key={item.id} className="flex gap-3 py-5">
            <Link onClick={onClose} to={`/product/${product.slug}`} className="h-28 w-24 shrink-0 bg-secondary">{image && <img src={publicImageUrl(image.storage_path)} alt={image.alt ?? product.name} className="h-full w-full object-cover" />}</Link>
            <div className="flex min-w-0 flex-1 flex-col justify-between"><div><Link onClick={onClose} to={`/product/${product.slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary">{product.name}</Link><p className="mt-1 text-sm text-muted-foreground">{variant.color} · {variant.size}</p><p className="mt-1 text-sm">{formatINR(price)}</p></div>
              <div className="flex items-center justify-between"><div className="flex items-center border border-border"><button aria-label="Decrease quantity" className="flex h-10 w-10 items-center justify-center hover:text-primary" onClick={() => setQty.mutate({ itemId: item.id, quantity: item.quantity - 1 })}><Minus className="h-3.5 w-3.5" /></button><span className="w-7 text-center text-sm">{item.quantity}</span><button aria-label="Increase quantity" className="flex h-10 w-10 items-center justify-center hover:text-primary" onClick={() => setQty.mutate({ itemId: item.id, quantity: item.quantity + 1 })}><Plus className="h-3.5 w-3.5" /></button></div><button aria-label={`Remove ${product.name}`} className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-primary" onClick={() => setQty.mutate({ itemId: item.id, quantity: 0 })}><Trash2 className="h-4 w-4" /></button></div>
            </div>
          </li>;
        })}</ul>}
      </div>
      {items.length > 0 && <footer className="border-t border-border p-5"><div className="mb-4 flex items-center justify-between"><span className="text-sm text-muted-foreground">Subtotal</span><span className="text-lg font-semibold">{formatINR(subtotal)}</span></div><p className="mb-4 text-sm text-muted-foreground">Shipping and eligible offers are calculated at checkout.</p><Link onClick={onClose} to={user ? "/checkout" : "/login"} state={!user ? { from: "/cart" } : undefined} className="flex min-h-12 items-center justify-center bg-primary px-6 text-sm uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-[hsl(2_100%_38%)]">Checkout</Link><Link onClick={onClose} to="/cart" className="mt-3 flex min-h-11 items-center justify-center text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground">View full bag</Link></footer>}
    </aside>
  </div>;
}
