import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { publicImageUrl } from "@/lib/supabase";
import { displayPrice, inStock, productImage } from "@/lib/pricing";
import { cn, formatINR } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsMember, useToggleWishlist, useWishlistIds } from "@/hooks/useShop";
import type { Product } from "@/types/db";

export function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth();
  const { isMember } = useIsMember();
  const wishlist = useWishlistIds();
  const toggle = useToggleWishlist();
  const imgs = productImage(product);
  const { price, regular, member, discounted } = displayPrice(product, undefined, isMember);
  const liked = wishlist.data?.includes(product.id) ?? false;
  const sold = !inStock(product);

  return (
    <div className="group relative">
      <Link to={`/product/${product.slug}`} className="block">
        <div className="product-frame relative aspect-[3/4]">
          {imgs[0] ? (
            <>
              <img src={publicImageUrl(imgs[0].storage_path)} alt={imgs[0].alt ?? product.name} loading="lazy"
                className={cn("h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]", imgs[1] && "group-hover:opacity-0")} />
              {imgs[1] && <img src={publicImageUrl(imgs[1].storage_path)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-ink-2 font-display text-4xl tracking-[0.1em] text-foreground/70">BLACK WOLF</div>
          )}
          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {product.is_new_arrival && <span className="border border-primary bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground backdrop-blur">New</span>}
            {product.is_exclusive && <span className="border border-gold/70 bg-background/90 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-gold backdrop-blur">Exclusive</span>}
            {sold && <span className="border border-foreground/70 bg-background/90 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-foreground">Sold out</span>}
          </div>
          <span className="absolute inset-x-0 bottom-0 translate-y-full border-t border-primary/30 bg-background/90 py-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-foreground backdrop-blur transition-transform duration-300 group-hover:translate-y-0">Discover the piece</span>
        </div>
        <div className="mt-4 space-y-1.5">
          {product.categories?.name && <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{product.categories.name}</p>}
          <h3 className="font-sans text-base font-medium normal-case tracking-[0.02em]">{product.name}</h3>
          {product.description && <p className="line-clamp-2 max-w-sm text-sm leading-6 text-muted-foreground">{product.description.replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</p>}
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
            <span className="font-medium">{formatINR(price)}</span>
            {discounted && <span className="text-xs text-muted-foreground line-through">{formatINR(regular)}</span>}
            {!isMember && member != null && member < regular && <span className="text-sm uppercase tracking-wide text-gold">Members {formatINR(member)}</span>}
          </div>
        </div>
      </Link>
      {user && (
        <button aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          onClick={() => toggle.mutate({ productId: product.id, on: !liked })}
          className="absolute right-3 top-3 border border-border/70 bg-background/75 p-2.5 text-foreground backdrop-blur transition-colors hover:border-primary hover:text-primary">
          <Heart className={cn("h-4 w-4", liked && "fill-primary text-primary")} />
        </button>
      )}
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 md:gap-y-14 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
