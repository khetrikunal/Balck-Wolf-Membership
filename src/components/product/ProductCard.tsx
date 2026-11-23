import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";
import { publicImageUrl } from "@/lib/supabase";
import { displayPrice, inStock, productImage } from "@/lib/pricing";
import { cn, formatINR } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCartMutations, useIsMember, useToggleWishlist, useWishlistIds } from "@/hooks/useShop";
import type { Product, ProductVariant } from "@/types/db";

export function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth();
  const { isMember } = useIsMember();
  const wishlist = useWishlistIds();
  const toggle = useToggleWishlist();
  const { add } = useCartMutations();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const imgs = productImage(product);
  const { price, regular, member, discounted } = displayPrice(product, undefined, isMember);
  const liked = wishlist.data?.includes(product.id) ?? false;
  const sold = !inStock(product);
  const variants = (product.product_variants ?? []).filter((variant) => variant.is_active && variant.stock > 0);

  const askForSignIn = (intent: string) => {
    toast.info(`Sign in to ${intent} this piece.`);
    navigate("/login", { state: { from: `${location.pathname}${location.search}${location.hash}` } });
  };
  const addVariant = (variant: ProductVariant) => {
    if (!user) { setQuickAddOpen(false); askForSignIn("add"); return; }
    add.mutate({ variantId: variant.id, quantity: 1 }, { onSuccess: () => setQuickAddOpen(false) });
  };

  return <article className="group relative min-w-0">
    <Link to={`/product/${product.slug}`} className="block">
      <div className="product-frame relative aspect-[3/4]">
        {imgs[0] ? <>
          <img src={publicImageUrl(imgs[0].storage_path)} alt={imgs[0].alt ?? product.name} loading="lazy" className={cn("h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]", imgs[1] && "group-hover:opacity-0")} />
          {imgs[1] && <img src={publicImageUrl(imgs[1].storage_path)} alt={imgs[1].alt ?? `${product.name}, alternate view`} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
        </> : <div className="flex h-full items-center justify-center bg-ink-2 font-display text-4xl tracking-[0.1em] text-foreground/70">BLACK WOLF</div>}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.is_new_arrival && <span className="border border-primary bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground">New</span>}
          {product.is_exclusive && <span className="border border-gold/70 bg-background/90 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-gold">Exclusive</span>}
          {sold && <span className="border border-foreground/70 bg-background/90 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-foreground">Sold out</span>}
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {product.categories?.name && <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{product.categories.name}</p>}
        <h3 className="font-sans text-base font-medium normal-case tracking-[0.02em]">{product.name}</h3>
        {product.description && <p className="line-clamp-2 max-w-sm text-sm leading-6 text-muted-foreground">{product.description.replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</p>}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm"><span className="font-medium">{formatINR(price)}</span>{discounted && <span className="text-xs text-muted-foreground line-through">{formatINR(regular)}</span>}{!isMember && member != null && member < regular && <span className="text-sm uppercase tracking-wide text-gold">Members {formatINR(member)}</span>}</div>
      </div>
    </Link>
    <button type="button" aria-label={liked ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} aria-pressed={liked} onClick={() => user ? toggle.mutate({ productId: product.id, on: !liked }) : askForSignIn("save")} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center border border-border bg-background/85 text-foreground backdrop-blur transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Heart className={cn("h-5 w-5", liked && "fill-primary text-primary")} />
    </button>
    {!sold && <button type="button" onClick={() => user ? setQuickAddOpen(true) : askForSignIn("add")} className="mt-3 min-h-11 w-full border border-primary/70 text-sm uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:translate-y-1 md:opacity-0 md:transition-all md:group-hover:translate-y-0 md:group-hover:opacity-100 md:focus-visible:translate-y-0 md:focus-visible:opacity-100">Quick add</button>}
    {quickAddOpen && <div className="absolute inset-x-0 bottom-16 z-20 border border-border bg-background/98 p-4 shadow-2xl backdrop-blur-xl" role="dialog" aria-label={`Choose a size for ${product.name}`}>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium">Choose size & color</p><button type="button" onClick={() => setQuickAddOpen(false)} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Close quick add"><X className="h-4 w-4" /></button></div>
      <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{variants.map((variant) => <button key={variant.id} type="button" disabled={add.isPending} onClick={() => addVariant(variant)} className="min-h-11 border border-border px-3 text-sm transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{variant.size} · {variant.color}</button>)}</div>
    </div>}
  </article>;
}

export function ProductRail({ products }: { products: Product[] }) {
  return <div className="grid auto-cols-[72%] grid-flow-col gap-4 overflow-x-auto pb-3 snap-x snap-mandatory sm:auto-cols-[44%] md:auto-cols-[30%] xl:auto-cols-[23%]">
    {products.map((product) => <div className="snap-start" key={product.id}><ProductCard product={product} /></div>)}
  </div>;
}

export function ProductGrid({ products }: { products: Product[] }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 md:gap-y-14 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
