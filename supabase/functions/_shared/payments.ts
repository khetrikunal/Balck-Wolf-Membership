// Core payment creation logic shared by the entry-point functions.
// Amounts are ALWAYS computed in PostgreSQL from stored prices; the client never supplies an amount.
import { SupabaseClient, User } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { HttpError, mapDbError, rateLimit } from "./common.ts";
import { createRazorpayOrder } from "./razorpay.ts";

export const addressSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postal_code: z.string().trim().min(3).max(12),
  country: z.string().trim().length(2).default("IN"),
});

async function recordPayment(admin: SupabaseClient, row: Record<string, unknown>) {
  const { data, error } = await admin.from("payments").insert(row).select("id").single();
  if (error) { console.error("payment insert failed", error.message); throw new HttpError(500, "internal_error", "Something went wrong."); }
  return data.id as string;
}

async function startRazorpay(opts: {
  admin: SupabaseClient; user: User; purpose: string; amount: number; receipt: string;
  notes: Record<string, string>; link: Record<string, unknown>;
}) {
  if (!(opts.amount > 0)) throw new HttpError(400, "invalid_amount", "Nothing to pay.");
  const rzp = await createRazorpayOrder({ amountRupees: opts.amount, receipt: opts.receipt, notes: opts.notes });
  const paymentId = await recordPayment(opts.admin, {
    user_id: opts.user.id, purpose: opts.purpose, amount: opts.amount, currency: "INR",
    status: "created", razorpay_order_id: rzp.id, ...opts.link,
  });
  return {
    payment_id: paymentId,
    razorpay_order_id: rzp.id,
    amount: rzp.amount,              // paise, as accepted by Razorpay Checkout
    currency: rzp.currency,
    key_id: Deno.env.get("RAZORPAY_KEY_ID"),
  };
}

export async function startMembershipPayment(admin: SupabaseClient, user: User, planId: string, renewal: boolean) {
  await rateLimit(admin, `membership:${user.id}`, 10, 600);
  const { data, error } = await admin.rpc("prepare_membership_payment", {
    p_user: user.id, p_plan_id: planId, p_renewal: renewal,
  });
  if (error) throw mapDbError(error.message);
  return await startRazorpay({
    admin, user,
    purpose: renewal ? "membership_renewal" : "membership_purchase",
    amount: Number(data.amount),
    receipt: `mem_${data.membership_id}`.replace(/-/g, ""),
    notes: { purpose: renewal ? "membership_renewal" : "membership_purchase", user_id: user.id, membership_id: data.membership_id },
    link: { membership_id: data.membership_id, plan_id: data.plan_id },
  });
}

export const productOrderSchema = z.object({
  items: z.array(z.object({
    variant_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
  })).min(1).max(50),
  address: addressSchema,
  coupon_code: z.string().trim().max(40).optional().nullable(),
});

export async function startProductPayment(admin: SupabaseClient, user: User, input: z.infer<typeof productOrderSchema>) {
  await rateLimit(admin, `order:${user.id}`, 15, 600);
  const { data, error } = await admin.rpc("create_product_order", {
    p_user: user.id, p_items: input.items, p_address: input.address, p_coupon: input.coupon_code ?? null,
  });
  if (error) throw mapDbError(error.message);
  const started = await startRazorpay({
    admin, user, purpose: "product_order", amount: Number(data.amount),
    receipt: String(data.order_number),
    notes: { purpose: "product_order", user_id: user.id, order_id: data.order_id },
    link: { order_id: data.order_id },
  });
  return { ...started, order_id: data.order_id as string, order_number: data.order_number as string };
}

export const customOrderSchema = z.object({
  quote_id: z.string().uuid(),
  address: addressSchema,
});

export async function startCustomPayment(admin: SupabaseClient, user: User, input: z.infer<typeof customOrderSchema>) {
  await rateLimit(admin, `custom:${user.id}`, 10, 600);
  const { data, error } = await admin.rpc("prepare_custom_order", {
    p_user: user.id, p_quote_id: input.quote_id, p_address: input.address,
  });
  if (error) throw mapDbError(error.message);
  const started = await startRazorpay({
    admin, user, purpose: "custom_order", amount: Number(data.amount),
    receipt: `cus_${data.order_id}`.replace(/-/g, ""),
    notes: { purpose: "custom_order", user_id: user.id, order_id: data.order_id, quote_id: data.quote_id },
    link: { order_id: data.order_id, custom_quote_id: data.quote_id },
  });
  return { ...started, order_id: data.order_id as string };
}
