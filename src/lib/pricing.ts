import type { Product, ProductVariant } from "@/types/db";

/**
 * DISPLAY-ONLY price helper. Whether the user is a member comes from the server (my_pricing_tier RPC),
 * and the amount actually charged is recalculated in PostgreSQL at checkout.
 */
export function displayPrice(p: Product, v: ProductVariant | undefined, isMember: boolean) {
  const regular = Number(v?.price_override ?? p.regular_price);
  const memberRaw = v?.member_price_override ?? p.member_price;
  const member = memberRaw == null ? null : Number(memberRaw);
  const price = isMember && member != null ? member : regular;
  return { price, regular, member, discounted: isMember && member != null && member < regular };
}

export const productImage = (p: Product) => [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
export const inStock = (p: Product) => (p.product_variants ?? []).some((v) => v.is_active && v.stock > 0);
