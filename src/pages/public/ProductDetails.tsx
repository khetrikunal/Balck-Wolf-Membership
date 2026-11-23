import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loading, ErrorState, EmptyState } from "@/components/common/States";
import { fetchProduct, fetchProducts, fetchProductsByIds } from "@/services/catalog";
import { publicImageUrl } from "@/lib/supabase";
import { displayPrice, productImage } from "@/lib/pricing";
import { cn, formatINR } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCartMutations, useIsMember, useToggleWishlist, useWishlistIds } from "@/hooks/useShop";
import { Logo } from "@/components/common/Logo";
import { RichDescription } from "@/components/common/RichDescription";
import { ProductRail } from "@/components/product/ProductCard";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export default function ProductDetails() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const { isMember } = useIsMember();
  const wishlist = useWishlistIds();
  const toggleWishlist = useToggleWishlist();
  const navigate = useNavigate();
  const loc = useLocation();
  const { add } = useCartMutations();
  const q = useQuery({ queryKey: ["product", slug], queryFn: () => fetchProduct(slug) });
  const p = q.data;
  const [img, setImg] = useState(0);
  const [size, setSize] = useState<string>();
  const [color, setColor] = useState<string>();
  const [qty, setQty] = useState(1);
  const [variantError, setVariantError] = useState("");
  const touchX = useRef<number | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("blackwolf.recent-products") ?? "[]").slice(0, 6); }
    catch { return []; }
  });
  const related = useQuery({ queryKey: ["related-products", p?.category_id], queryFn: () => fetchProducts({ categorySlug: p?.categories?.slug, limit: 8 }), enabled: !!p?.categories?.slug });
  const recent = useQuery({ queryKey: ["recent-products", p?.id, recentIds], queryFn: () => fetchProductsByIds(recentIds.filter((id) => id !== p?.id)), enabled: !!p && recentIds.length > 0 });

  useEffect(() => {
    if (!p) return;
    const next = [p.id, ...recentIds.filter((id) => id !== p.id)].slice(0, 6);
    setRecentIds((current) => current.filter((id) => id !== p.id));
    localStorage.setItem("blackwolf.recent-products", JSON.stringify(next));
  }, [p?.id]);

  const variants = useMemo(() => (p?.product_variants ?? []).filter((v) => v.is_active), [p]);
  const sizes = [...new Set(variants.map((v) => v.size))];
  const colors = [...new Set(variants.map((v) => v.color))];
  const variant = variants.find((v) => v.size === size && v.color === color);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!p) return <EmptyState title="Product not found" action={<Button asChild><Link to="/shop">Back to shop</Link></Button>} />;

  const imgs = productImage(p);
  const { price, regular, member, discounted } = displayPrice(p, variant, isMember);
  const liked = wishlist.data?.includes(p.id) ?? false;
  const available = (s: string, c: string) => variants.some((v) => v.size === s && v.color === c && v.stock > 0);

  function addToCart(buyNow = false) {
    if (!user) return navigate("/login", { state: { from: loc.pathname } });
    if (!size || !color) { setVariantError("Choose a color and size to continue."); return; }
    if (!variant || variant.stock < 1) { setVariantError("That option is currently unavailable. Please choose another."); return; }
    setVariantError("");
    add.mutate({ variantId: variant.id, quantity: qty }, { onSuccess: () => { if (buyNow) navigate("/checkout"); } });
  }

  return (
    <div className="container pb-28 pt-8 md:py-14 lg:pb-14">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
      <div className="space-y-4">
        <div className="group aspect-[4/5] overflow-hidden border border-border bg-muted md:aspect-[4/4.6]" onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touchX.current == null || imgs.length < 2) return; const delta = e.changedTouches[0].clientX - touchX.current; if (Math.abs(delta) > 45) setImg((current) => (current + (delta < 0 ? 1 : -1) + imgs.length) % imgs.length); touchX.current = null; }}>
          {imgs[img] ? <img src={publicImageUrl(imgs[img].storage_path)} alt={imgs[img].alt ?? p.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            : <div className="flex h-full items-center justify-center bg-[#151412] font-display text-5xl tracking-[0.15em] text-primary/50">BLACK WOLF</div>}
        </div>
        {imgs.length > 1 && (
          <div className="grid grid-cols-5 gap-3">
            {imgs.map((im, i) => (
              <button key={im.id} aria-label={`View image ${i + 1}`} aria-pressed={i === img} onClick={() => setImg(i)} className={cn("aspect-square min-h-11 overflow-hidden border transition-opacity", i === img ? "border-primary" : "border-border opacity-60 hover:opacity-100")}>
                <img src={publicImageUrl(im.storage_path)} alt="" className="h-full w-full object-cover" /></button>))}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-28 lg:h-fit lg:py-3">
        <p className="eyebrow">{p.categories?.name}</p>
        <h1 className="mt-3 text-6xl leading-[.88] md:text-8xl">{p.name}</h1>
        <div className="mt-6 flex items-baseline gap-3 border-b border-border pb-6">
          <span className="text-2xl font-medium tracking-wide">{formatINR(price)}</span>
          {discounted && <span className="text-sm text-muted-foreground line-through">{formatINR(regular)}</span>}
          <button type="button" onClick={() => user ? toggleWishlist.mutate({ productId: p.id, on: !liked }) : (toast.info("Sign in to save this piece to your wishlist."), navigate("/login", { state: { from: loc.pathname } }))} aria-label={liked ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={liked} className="ml-auto flex h-11 w-11 items-center justify-center border border-border transition-colors hover:border-primary hover:text-primary"><Heart className={cn("h-5 w-5", liked && "fill-primary text-primary")} /></button>
        </div>
        {!isMember && member != null && member < regular && (
          <p className="mt-3 text-xs text-primary">Members pay {formatINR(member)}. <Link to="/membership" className="underline underline-offset-4">Discover membership</Link></p>)}
        {discounted && <p className="mt-3 text-xs text-primary">Member price applied</p>}
        {p.description && <div className="mt-6"><RichDescription text={p.description} /></div>}

        {variants.length === 0 ? <p className="mt-8 text-muted-foreground">Currently unavailable.</p> : (
          <div className="mt-8 space-y-7">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.19em] text-muted-foreground">Colour <span className="text-foreground">{color ?? "— Select"}</span></p>
              <div className="flex flex-wrap gap-2">{colors.map((c) => { const colorInStock = variants.some((v) => v.color === c && v.stock > 0); return (
                <button key={c} disabled={!colorInStock} onClick={() => { setColor(c); if (size && !available(size, c)) setSize(undefined); setVariantError(""); }} aria-pressed={color === c} className={cn("min-h-11 border px-4 py-2.5 text-sm transition-colors", color === c ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/70", !colorInStock && "cursor-not-allowed opacity-40 line-through")}>{c}</button>); })}</div>
            </div>
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.19em] text-muted-foreground">Size <span className="text-foreground">{size ?? "— Select"}</span></p>
              <div className="flex flex-wrap gap-2">{sizes.map((s) => {
                const ok = !color || available(s, color);
                return <button key={s} disabled={!ok} onClick={() => { setSize(s); setVariantError(""); }} aria-pressed={size === s} className={cn("min-h-11 min-w-12 border px-4 py-2.5 text-sm transition-colors", size === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/70", !ok && "cursor-not-allowed line-through opacity-40")}>{s}</button>;
              })}</div>
            </div>
            {variantError && <p role="alert" className="text-sm text-primary">{variantError}</p>}
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.19em] text-muted-foreground">Quantity</p>
              <div className="flex items-center border border-border">
                <button className="px-4 py-2 text-muted-foreground transition-colors hover:text-primary" aria-label="Decrease" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span className="w-8 text-center text-xs">{qty}</span>
                <button className="px-4 py-2 text-muted-foreground transition-colors hover:text-primary" aria-label="Increase" onClick={() => setQty(Math.min(variant ? Math.min(20, variant.stock) : 20, qty + 1))}>+</button>
              </div>
            </div>
            <div className="flex items-center justify-between border-y border-border py-4">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Availability</span>
              {variant && <span className={cn("text-xs", variant.stock <= variant.low_stock_threshold ? "text-primary" : "text-muted-foreground")}>
                {variant.stock === 0 ? "Out of stock" : variant.stock <= variant.low_stock_threshold ? `Only ${variant.stock} left` : "In stock"}</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="w-full" loading={add.isPending} disabled={!!variant && variant.stock === 0} onClick={() => addToCart()}>
              {!size || !color ? "Select colour and size" : variant?.stock === 0 ? "Out of stock" : "Add to cart"}
            </Button>
            <Button size="lg" variant="outline" className="w-full" loading={add.isPending} disabled={!!variant && variant.stock === 0} onClick={() => addToCart(true)}>Buy now</Button>
            </div>
            {p.is_customizable && <Button variant="outline" className="w-full" asChild><Link to="/custom">Customize this product</Link></Button>}
          </div>
        )}
        <div className="mt-10 divide-y divide-border border-y border-border">
          <details className="group py-4" open><summary className="flex cursor-pointer list-none items-center justify-between text-[10px] uppercase tracking-[0.18em]">Material & care <span className="text-primary transition-transform group-open:rotate-45">+</span></summary>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">Fabric composition is listed on the garment label. For care, wash inside out with similar colours on a gentle cycle. Do not bleach; reshape and air dry. Follow the care label for product-specific instructions.</p></details>
          <details className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between text-[10px] uppercase tracking-[0.18em]">Shipping & returns <span className="text-primary transition-transform group-open:rotate-45">+</span></summary>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">Available delivery options and shipping charges are shown at checkout. For return information, see our <Link className="text-primary underline underline-offset-4" to="/refund-policy">returns policy</Link>.</p></details>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <Logo className="h-10 w-24" />
          <p className="text-[9px] uppercase leading-5 tracking-[0.15em] text-muted-foreground">BLACK WOLF<br/><span className="text-primary">Wear your power.</span></p>
        </div>
      </div>
      </div>
      {(related.data?.some((product) => product.id !== p.id) || recent.data?.length) && <div className="mt-16 space-y-14 border-t border-border pt-12">
        {related.data?.some((product) => product.id !== p.id) && <section><p className="eyebrow mb-3">From the same edit</p><h2 className="mb-6 text-4xl md:text-5xl">You may also like</h2><ProductRail products={related.data.filter((product) => product.id !== p.id)} /></section>}
        {recent.data?.length ? <section><p className="eyebrow mb-3">Your trail</p><h2 className="mb-6 text-4xl md:text-5xl">Recently viewed</h2><ProductRail products={recent.data} /></section> : null}
      </div>}
      {variants.length > 0 && <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{p.name}</p><p className="text-base font-semibold">{formatINR(price)}</p></div>
        <Button size="sm" className="min-h-11 px-3" loading={add.isPending} disabled={!!variant && variant.stock === 0} onClick={() => addToCart()}>Add</Button>
        <Button size="sm" variant="outline" className="min-h-11 px-3" loading={add.isPending} disabled={!!variant && variant.stock === 0} onClick={() => addToCart(true)}>Buy now</Button>
      </div>}
    </div>
  );
}
