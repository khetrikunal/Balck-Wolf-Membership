import { supabase } from "@/lib/supabase";
import type { Category, MembershipPlan, Product } from "@/types/db";

const PRODUCT_SELECT = "*, product_images(*), product_variants(*), categories(*)";

export interface ProductFilters { categorySlug?: string; featured?: boolean; newArrival?: boolean; exclusive?: boolean; search?: string; limit?: number; sort?: "new" | "price_asc" | "price_desc" }

export async function fetchProducts(f: ProductFilters = {}): Promise<Product[]> {
  let q = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active");
  if (f.featured) q = q.eq("is_featured", true);
  if (f.newArrival) q = q.eq("is_new_arrival", true);
  if (f.exclusive) q = q.eq("is_exclusive", true);
  if (f.search) q = q.ilike("name", `%${f.search.replace(/[%_]/g, "")}%`);
  if (f.categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", f.categorySlug).maybeSingle();
    if (!cat) return [];
    q = q.eq("category_id", cat.id);
  }
  q = f.sort === "price_asc" ? q.order("regular_price") : f.sort === "price_desc" ? q.order("regular_price", { ascending: false }) : q.order("created_at", { ascending: false });
  if (f.limit) q = q.limit(f.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Product[];
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
