export type AppRole = "super_admin" | "admin" | "staff";

export interface Category { id: string; name: string; slug: string; description: string | null; sort_order: number; is_active: boolean }
export interface ProductImage { id: string; product_id: string; storage_path: string; alt: string | null; sort_order: number }
export interface ProductVariant {
  id: string; product_id: string; sku: string | null; size: string; color: string;
  price_override: number | null; member_price_override: number | null; stock: number; low_stock_threshold: number; is_active: boolean;
}
export interface Product {
  id: string; category_id: string | null; name: string; slug: string; description: string | null;
  regular_price: number; member_price: number | null;
  is_featured: boolean; is_new_arrival: boolean; is_exclusive: boolean; is_customizable: boolean;
  status: "draft" | "active" | "archived"; created_at: string;
  product_images?: ProductImage[]; product_variants?: ProductVariant[]; categories?: Category | null;
}
export interface MembershipPlan {
  id: string; name: string; description: string | null; price: number; duration: number | null;
  duration_unit: "days" | "months" | "years" | "lifetime"; benefits: string[]; status: "active" | "inactive";
}
export interface Membership {
  id: string; user_id: string; plan_id: string; membership_number: string | null;
  status: "pending" | "active" | "expired" | "suspended" | "cancelled";
  plan_snapshot: MembershipPlan; starts_at: string | null; expires_at: string | null; created_at: string;
  membership_cards?: { verification_token: string; issued_at: string }[] | { verification_token: string; issued_at: string } | null;
}
export interface Address {
  id: string; user_id: string; label: string | null; full_name: string; phone: string; line1: string; line2: string | null;
  city: string; state: string; postal_code: string; country: string; is_default: boolean;
}
export interface OrderItem { id: string; order_id: string; product_name: string; size: string; color: string; image_path: string | null; unit_price: number; quantity: number; line_total: number }
export interface Shipment { id: string; order_id: string; courier_name: string | null; tracking_number: string | null; tracking_url: string | null; status: string; shipped_at: string | null; delivered_at: string | null }
export interface Order {
  id: string; order_number: string; user_id: string; order_type: "product" | "custom"; status: string;
  is_member_pricing: boolean; subtotal: number; discount_total: number; shipping_total: number; total: number;
  shipping_address: Record<string, string>; created_at: string; order_items?: OrderItem[]; shipments?: Shipment[] | Shipment | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}
export interface Payment {
  id: string; user_id: string; purpose: string; amount: number; status: string; razorpay_order_id: string | null;
  razorpay_payment_id: string | null; refunded_amount: number; created_at: string;
}
export interface CustomRequest {
  id: string; user_id: string; clothing_type: string; size: string; color: string; quantity: number; instructions: string | null;
  status: string; admin_notes: string | null; created_at: string;
  custom_design_files?: { id: string; storage_path: string; mime_type: string }[];
  custom_design_quotes?: CustomQuote[];
  profiles?: { full_name: string | null; email: string | null } | null;
}
export interface CustomQuote { id: string; request_id: string; amount: number; notes: string | null; status: string; created_at: string }
export interface Coupon { id: string; code: string; discount_type: "percent" | "fixed"; discount_value: number; min_order_amount: number; max_uses: number | null; used_count: number; starts_at: string | null; expires_at: string | null; is_active: boolean }
export interface Notification { id: string; title: string; body: string | null; is_read: boolean; created_at: string }
export interface CartItem { id: string; variant_id: string; quantity: number; product_variants: ProductVariant & { products: Product & { product_images: ProductImage[] } } }
