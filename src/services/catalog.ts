import { supabase } from "@/lib/supabase";
import type { Category, MembershipPlan, Product } from "@/types/db";

const PRODUCT_SELECT = "*, product_images(*), product_variants(*), categories(*)";

export interface ProductFilters { categorySlug?: string; featured?: boolean; newArrival?: boolean; exclusive?: boolean; search?: string; limit?: number; sort?: "new" | "popular" | "price_asc" | "price_desc" }

export async function fetchProducts(f: ProductFilters = {}): Promise<Product[]> {
  let q = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active");
  if (f.featured) q = q.eq("is_featured", true);
  if (f.newArrival) q = q.eq("is_new_arrival", true);
  if (f.exclusive) q = q.eq("is_exclusive", true);
  const search = f.search?.trim().replace(/[%_(),"]/g, "");
  if (search) {
    const pattern = `%${search}%`;
    const { data: matchingCategories, error: categoryError } = await supabase.from("categories").select("id").eq("is_active", true).ilike("name", pattern);
    if (categoryError) throw categoryError;
    const conditions = [`name.ilike.${pattern}`, `description.ilike.${pattern}`];
    if (matchingCategories?.length) conditions.push(`category_id.in.(${matchingCategories.map((c) => c.id).join(",")})`);
    q = q.or(conditions.join(","));
  }
  if (f.categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", f.categorySlug).maybeSingle();
    if (!cat) return [];
    q = q.eq("category_id", cat.id);
  }
  if (f.sort === "price_asc") q = q.order("regular_price");
  else if (f.sort === "price_desc") q = q.order("regular_price", { ascending: false });
  else if (f.sort === "popular") q = q.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  if (f.limit) q = q.limit(f.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function hasProductsOnOffer(): Promise<boolean> {
  const { data, error } = await supabase.from("products").select("regular_price,member_price,product_variants(price_override,member_price_override)").eq("status", "active");
  if (error) throw error;
  return (data ?? []).some((product: any) => {
    const regular = Number(product.regular_price);
    if (product.member_price != null && Number(product.member_price) < regular) return true;
    return (product.product_variants ?? []).some((variant: any) => {
      const variantRegular = Number(variant.price_override ?? regular);
      return (variant.member_price_override != null && Number(variant.member_price_override) < variantRegular) || variantRegular < regular;
    });
  });
}

export async function fetchBestSellers(limit = 4): Promise<Product[]> {
  // Best sellers are computed from paid order items; falls back to featured when there is no sales history.
  const { data } = await supabase.from("order_items").select("product_id, quantity").not("product_id", "is", null).limit(1000);
  const totals = new Map<string, number>();
  (data ?? []).forEach((r) => totals.set(r.product_id!, (totals.get(r.product_id!) ?? 0) + r.quantity));
  const ids = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (ids.length === 0) return fetchProducts({ featured: true, limit });
  const { data: products, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", ids).eq("status", "active");
  if (error) throw error;
  return (products ?? []) as Product[];
}

export async function fetchProduct(slug: string): Promise<Product | null> {
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).eq("slug", slug).eq("status", "active").maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).in("id", ids).eq("status", "active");
  if (error) throw error;
  const products = (data ?? []) as Product[];
  return ids.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => !!product);
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
  if (error) throw error;
  return data as Category[];
}

export async function fetchPlans(): Promise<MembershipPlan[]> {
  const { data, error } = await supabase.from("membership_plans").select("*").eq("status", "active").order("price");
  if (error) throw error;
  return data as MembershipPlan[];
}

export async function fetchTestimonials() {
  const { data, error } = await supabase.from("testimonials").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(6);
  if (error) throw error;
  return data as { id: string; author: string; quote: string }[];
}

export async function fetchSetting<T>(key: string): Promise<T | null> {
  const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export async function subscribeNewsletter(email: string) {
  const { error } = await supabase.from("newsletter_subscribers").insert({ email });
  if (error && error.code !== "23505") throw error;
}

export async function sendContact(m: { name: string; email: string; message: string }) {
  const { error } = await supabase.from("contact_messages").insert(m);
  if (error) throw error;
}
