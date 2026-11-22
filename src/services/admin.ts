import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/utils";
import type { Category, Coupon, CustomRequest, Membership, MembershipPlan, Order, Payment, Product, ProductVariant, Shipment } from "@/types/db";

const ok = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export const adminStats = async () => { const { data, error } = await supabase.rpc("admin_dashboard_stats"); ok(error); return data as Record<string, any>; };

// ----- catalogue -----
export async function adminProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*, product_images(*), product_variants(*), categories(*)").order("created_at", { ascending: false }); ok(error); return data as Product[];
}
export async function adminCategories(): Promise<Category[]> { const { data, error } = await supabase.from("categories").select("*").order("sort_order"); ok(error); return data as Category[]; }

export interface ProductInput {
  id?: string; name: string; description: string; category_id: string | null; regular_price: number; member_price: number | null;
  is_featured: boolean; is_new_arrival: boolean; is_exclusive: boolean; is_customizable: boolean; status: "draft" | "active" | "archived";
}
export async function saveProduct(p: ProductInput): Promise<string> {
  const row = { ...p, slug: undefined as string | undefined };
  if (p.id) { const { error } = await supabase.from("products").update({ ...row, id: undefined }).eq("id", p.id); ok(error); return p.id; }
  const slug = `${slugify(p.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase.from("products").insert({ ...row, id: undefined, slug }).select("id").single(); ok(error); return data!.id;
}
export async function setProductStatus(id: string, status: Product["status"]) { const { error } = await supabase.from("products").update({ status }).eq("id", id); ok(error); }

export async function uploadProductImage(productId: string, file: File, sort: number) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Only JPG, PNG or WebP images");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type }); ok(up.error);
  const { error } = await supabase.from("product_images").insert({ product_id: productId, storage_path: path, sort_order: sort }); ok(error);
}
export async function deleteProductImage(id: string, path: string) {
  await supabase.storage.from("product-images").remove([path]);
  const { error } = await supabase.from("product_images").delete().eq("id", id); ok(error);
}
export async function saveVariant(v: Partial<ProductVariant> & { product_id: string }) {
  const { error } = v.id ? await supabase.from("product_variants").update(v).eq("id", v.id) : await supabase.from("product_variants").insert(v); ok(error);
}
export async function deleteVariant(id: string) { const { error } = await supabase.from("product_variants").update({ is_active: false }).eq("id", id); ok(error); }

export async function saveCategory(c: Partial<Category> & { name: string }) {
  const { error } = c.id ? await supabase.from("categories").update({ name: c.name, description: c.description, sort_order: c.sort_order, is_active: c.is_active }).eq("id", c.id)
    : await supabase.from("categories").insert({ name: c.name, slug: slugify(c.name), description: c.description ?? null, sort_order: c.sort_order ?? 0 }); ok(error);
}

// ----- inventory -----
export async function adminVariants() {
  const { data, error } = await supabase.from("product_variants").select("*, products(name)").order("stock"); ok(error);
  return data as (ProductVariant & { products: { name: string } })[];
}
export async function adjustStock(variantId: string, delta: number, reason: string, actorId: string) {
  const { data: v, error } = await supabase.from("product_variants").select("stock").eq("id", variantId).single(); ok(error);
  const next = v!.stock + delta; if (next < 0) throw new Error("Stock cannot go below zero");
  const u = await supabase.from("product_variants").update({ stock: next }).eq("id", variantId); ok(u.error);
  const l = await supabase.from("inventory_logs").insert({ variant_id: variantId, change: delta, reason, actor_id: actorId }); ok(l.error);
}
export async function inventoryLogs() {
  const { data, error } = await supabase.from("inventory_logs").select("*, product_variants(size,color,products(name))").order("created_at", { ascending: false }).limit(100); ok(error); return data as any[];
}

// ----- plans / members -----
export async function adminPlans(): Promise<MembershipPlan[]> { const { data, error } = await supabase.from("membership_plans").select("*").order("price"); ok(error); return data as MembershipPlan[]; }
export async function savePlan(p: Partial<MembershipPlan>) {
  const row = { name: p.name, description: p.description, price: p.price, duration: p.duration_unit === "lifetime" ? null : p.duration, duration_unit: p.duration_unit, benefits: p.benefits ?? [], status: p.status ?? "inactive" };
  const { error } = p.id ? await supabase.from("membership_plans").update(row).eq("id", p.id) : await supabase.from("membership_plans").insert(row); ok(error);
}
export async function deletePlan(id: string) { const { error } = await supabase.from("membership_plans").delete().eq("id", id); ok(error); }
export interface MembershipOverviewRow {
  id: string; full_name: string | null; email: string | null; phone: string | null; joined_at: string;
  membership_id: string | null; plan_id: string | null; plan_snapshot: MembershipPlan | null; raw_status: Membership["status"] | null;
  current_status: string; starts_at: string | null; expires_at: string | null; purchased_at: string | null;
  source: "purchase" | "admin" | null; assigned_by: string | null; membership_number: string | null;
  payment_status: string | null; transaction_id: string | null;
}
export async function adminMembershipOverview(filters: { search: string; status: string; planId: string; purchaseFrom: string; purchaseTo: string; expiryFrom: string; expiryTo: string; sort: string; limit: number; offset: number }) {
  const { data, error } = await supabase.rpc("admin_membership_overview", {
    p_search: filters.search, p_status: filters.status, p_plan_id: filters.planId || null,
    p_purchase_from: filters.purchaseFrom || null, p_purchase_to: filters.purchaseTo || null,
    p_expiry_from: filters.expiryFrom || null, p_expiry_to: filters.expiryTo || null,
    p_sort: filters.sort, p_limit: filters.limit, p_offset: filters.offset,
  }); ok(error);
  return data as { total: number; rows: MembershipOverviewRow[] };
}
export async function searchMembershipUsers(search: string) { const { data, error } = await supabase.rpc("admin_search_membership_users", { p_search: search }); ok(error); return data as { id: string; full_name: string | null; email: string | null; phone: string | null }[]; }
export async function assignMembership(input: { userId: string; planId: string; startsAt: string; expiresAt: string; extend: boolean }) {
  const { data, error } = await supabase.rpc("admin_assign_membership", { p_user_id: input.userId, p_plan_id: input.planId, p_starts_at: input.startsAt || null, p_expires_at: input.expiresAt || null, p_extend: input.extend }); ok(error); return data as string;
}
export async function setMembershipStatus(id: string, status: "active" | "suspended" | "cancelled") { const { error } = await supabase.rpc("admin_set_membership_status", { p_membership_id: id, p_status: status }); ok(error); }
export async function adminMembershipStats() { const { data, error } = await supabase.rpc("admin_membership_stats"); ok(error); return data as Record<string, any>; }
export async function adminMembershipHistory(userId: string) {
  const { data, error } = await supabase.from("membership_transactions").select("*, payments(razorpay_payment_id,status)").eq("user_id", userId).order("created_at", { ascending: false }); ok(error); return data as any[];
}

// ----- custom designs -----
export async function adminCustomRequests() {
  const { data, error } = await supabase.from("custom_design_requests").select("*, custom_design_files(*), custom_design_quotes(*), profiles(full_name,email)").order("created_at", { ascending: false }); ok(error);
  return data as unknown as CustomRequest[];
}
export async function updateRequest(id: string, patch: { status?: string; admin_notes?: string }) { const { error } = await supabase.from("custom_design_requests").update(patch).eq("id", id); ok(error); }
export async function sendQuote(requestId: string, amount: number, notes: string) { const { error } = await supabase.rpc("send_quote", { p_request_id: requestId, p_amount: amount, p_notes: notes || null }); ok(error); }
export async function adminQuotes() {
  const { data, error } = await supabase.from("custom_design_quotes").select("*, custom_design_requests(clothing_type, profiles(full_name,email))").order("created_at", { ascending: false }); ok(error); return data as any[];
}

export async function adminCollections() { const { data, error } = await supabase.from("design_collections").select("*, admin_designs(*)").order("created_at", { ascending: false }); ok(error); return data as any[]; }
export async function saveCollection(name: string) { const { error } = await supabase.from("design_collections").insert({ name, slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}` }); ok(error); }
export async function uploadAdminDesign(collectionId: string, name: string, price: number, file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Only JPG, PNG or WebP images");
  const path = `${collectionId}/${crypto.randomUUID()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
  const up = await supabase.storage.from("admin-designs").upload(path, file, { contentType: file.type }); ok(up.error);
  const { error } = await supabase.from("admin_designs").insert({ collection_id: collectionId, name, storage_path: path, extra_price: price }); ok(error);
}
export async function attachDesign(productId: string, designId: string, on: boolean) {
  const { error } = on ? await supabase.from("product_designs").insert({ product_id: productId, design_id: designId }) : await supabase.from("product_designs").delete().eq("product_id", productId).eq("design_id", designId); ok(error);
}

// ----- orders / shipping / customers / payments -----
export async function adminOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from("orders").select("*, order_items(*), shipments(*), profiles(full_name,email)").neq("status", "pending_payment").order("created_at", { ascending: false }).limit(300); ok(error); return data as unknown as Order[];
}
export async function setOrderStatus(id: string, status: string) { const { error } = await supabase.from("orders").update({ status }).eq("id", id); ok(error); }
export async function saveShipment(orderId: string, s: Partial<Shipment>) {
  const patch: Record<string, unknown> = { ...s, order_id: orderId };
  if (s.status === "shipped" && !s.shipped_at) patch.shipped_at = new Date().toISOString();
  if (s.status === "delivered") patch.delivered_at = new Date().toISOString();
  const { error } = await supabase.from("shipments").upsert(patch, { onConflict: "order_id" }); ok(error);
  if (s.status === "shipped") await setOrderStatus(orderId, "shipped");
  if (s.status === "delivered") await setOrderStatus(orderId, "delivered");
}
export async function adminCustomers() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500); ok(error); return data as { id: string; full_name: string | null; email: string | null; phone: string | null; created_at: string }[];
}
export async function adminPayments() {
  const { data, error } = await supabase.from("payments").select("*, profiles(full_name,email)").order("created_at", { ascending: false }).limit(300); ok(error); return data as unknown as (Payment & { profiles: { full_name: string | null; email: string | null } })[];
}

// ----- coupons / settings / roles / audit -----
export async function adminCoupons(): Promise<Coupon[]> { const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false }); ok(error); return data as Coupon[]; }
export async function saveCoupon(c: Partial<Coupon>) {
  const row = { ...c, code: c.code?.trim().toUpperCase() };
  const { error } = c.id ? await supabase.from("coupons").update(row).eq("id", c.id) : await supabase.from("coupons").insert(row); ok(error);
}
export async function saveSetting(key: string, value: unknown) { const { error } = await supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }); ok(error); }
export async function adminTestimonials() { const { data, error } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false }); ok(error); return data as { id: string; author: string; quote: string; is_active: boolean }[]; }
export async function saveTestimonial(t: { id?: string; author: string; quote: string; is_active?: boolean }) { const { error } = t.id ? await supabase.from("testimonials").update(t).eq("id", t.id) : await supabase.from("testimonials").insert(t); ok(error); }
export async function deleteTestimonial(id: string) { const { error } = await supabase.from("testimonials").delete().eq("id", id); ok(error); }
export async function listRoles() { const { data, error } = await supabase.from("user_roles").select("id, role, user_id, profiles:user_id(full_name,email)"); ok(error); return data as any[]; }
export async function grantRole(email: string, role: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("email", email.trim().toLowerCase()).maybeSingle(); ok(error);
  if (!data) throw new Error("No registered user with that email. They must register first.");
  const r = await supabase.from("user_roles").insert({ user_id: data.id, role }); ok(r.error);
}
export async function revokeRole(id: string) { const { error } = await supabase.from("user_roles").delete().eq("id", id); ok(error); }
export async function auditLogs() { const { data, error } = await supabase.from("audit_logs").select("*, profiles:actor_id(full_name,email)").order("created_at", { ascending: false }).limit(200); ok(error); return data as any[]; }
