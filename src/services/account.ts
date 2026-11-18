import { supabase, invokeFn } from "@/lib/supabase";
import type { Address, CartItem, CustomRequest, Membership, Notification, Order, Payment, Product } from "@/types/db";

export async function fetchPricingTier(): Promise<boolean> {
  const { data, error } = await supabase.rpc("my_pricing_tier");
  if (error) throw error;
  return Boolean(data);
}

export async function fetchMyMemberships(): Promise<Membership[]> {
  const { data, error } = await supabase.from("memberships").select("*, membership_cards(verification_token, issued_at)").order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as Membership[];
}

export async function fetchMyMembershipHistory() {
  const { data, error } = await supabase.from("membership_transactions").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as { id: string; kind: string; amount: number; period_start: string | null; period_end: string | null; created_at: string }[];
}

export async function fetchMyPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

export async function fetchMyOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from("orders").select("*, order_items(*), shipments(*)").neq("status", "pending_payment").order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as Order[];
}

export async function fetchOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase.from("orders").select("*, order_items(*), shipments(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Order | null;
}

export async function fetchAddresses(): Promise<Address[]> {
  const { data, error } = await supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at");
  if (error) throw error;
  return data as Address[];
}

export async function saveAddress(a: Partial<Address> & { user_id: string }) {
  const { error } = a.id ? await supabase.from("addresses").update(a).eq("id", a.id) : await supabase.from("addresses").insert(a);
  if (error) throw error;
}
export async function deleteAddress(id: string) {
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data as Notification[];
}
export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

// ----- wishlist -----
export async function fetchWishlist(): Promise<Product[]> {
  const { data, error } = await supabase.from("wishlist_items").select("products(*, product_images(*), product_variants(*))").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => r.products).filter(Boolean) as Product[];
}
export async function fetchWishlistIds(): Promise<string[]> {
  const { data, error } = await supabase.from("wishlist_items").select("product_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.product_id);
}
export async function toggleWishlist(userId: string, productId: string, on: boolean) {
  const { error } = on
    ? await supabase.from("wishlist_items").insert({ user_id: userId, product_id: productId })
    : await supabase.from("wishlist_items").delete().eq("user_id", userId).eq("product_id", productId);
  if (error && error.code !== "23505") throw error;
}

// ----- cart (stored per signed-in user; prices are recalculated on the server at checkout) -----
export async function fetchCart(): Promise<CartItem[]> {
  const { data, error } = await supabase.from("cart_items")
    .select("id, variant_id, quantity, product_variants(*, products(*, product_images(*)))").order("created_at");
  if (error) throw error;
  return (data ?? []) as unknown as CartItem[];
}
async function myCartId(userId: string): Promise<string> {
  const { data } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
  if (error) throw error;
  return created.id;
}
export async function addToCart(userId: string, variantId: string, quantity: number) {
  const cartId = await myCartId(userId);
  const { data: existing } = await supabase.from("cart_items").select("id, quantity").eq("cart_id", cartId).eq("variant_id", variantId).maybeSingle();
  const { error } = existing
    ? await supabase.from("cart_items").update({ quantity: Math.min(20, existing.quantity + quantity) }).eq("id", existing.id)
    : await supabase.from("cart_items").insert({ cart_id: cartId, variant_id: variantId, quantity });
  if (error) throw error;
}
export async function setCartQty(itemId: string, quantity: number) {
  const { error } = quantity <= 0 ? await supabase.from("cart_items").delete().eq("id", itemId) : await supabase.from("cart_items").update({ quantity: Math.min(20, quantity) }).eq("id", itemId);
  if (error) throw error;
}

// ----- custom designs -----
export async function fetchMyCustomRequests(): Promise<CustomRequest[]> {
  const { data, error } = await supabase.from("custom_design_requests").select("*, custom_design_files(*), custom_design_quotes(*)").order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as CustomRequest[];
}

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function submitCustomRequest(userId: string, input: { clothing_type: string; size: string; color: string; quantity: number; instructions: string; files: File[] }) {
  for (const f of input.files) {
    if (!ALLOWED_MIME.includes(f.type)) throw new Error(`${f.name}: only JPG, PNG or WebP images are allowed`);
    if (f.size > MAX_UPLOAD_BYTES) throw new Error(`${f.name}: file is larger than 10 MB`);
  }
  const { data: req, error } = await supabase.from("custom_design_requests").insert({
    user_id: userId, clothing_type: input.clothing_type, size: input.size, color: input.color, quantity: input.quantity, instructions: input.instructions || null,
  }).select("id").single();
  if (error) throw error;
  for (const f of input.files) {
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${req.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("custom-designs").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) throw up.error;
    const { error: e2 } = await supabase.from("custom_design_files").insert({ request_id: req.id, user_id: userId, storage_path: path, mime_type: f.type, size_bytes: f.size });
    if (e2) throw e2;
  }
  return req.id as string;
}

export async function signedDesignUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("custom-designs").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function acceptQuote(quoteId: string) {
  const { error } = await supabase.rpc("accept_quote", { p_quote_id: quoteId });
  if (error) throw error;
}

// ----- payments -----
export interface PaymentStart { payment_id: string; razorpay_order_id: string; amount: number; currency: string; key_id: string; order_id?: string; order_number?: string }
export const startMembership = (planId: string, renewal: boolean) => invokeFn<PaymentStart>(renewal ? "renew-membership" : "purchase-membership", { plan_id: planId });
export const startProductOrder = (body: unknown) => invokeFn<PaymentStart>("create-product-order", body);
export const startCustomOrder = (body: unknown) => invokeFn<PaymentStart>("create-payment-order", { purpose: "custom_order", ...(body as object) });
export const verifyPayment = (body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
  invokeFn<{ status: "paid" | "pending"; purpose?: string; order_id?: string }>("verify-payment", body);
