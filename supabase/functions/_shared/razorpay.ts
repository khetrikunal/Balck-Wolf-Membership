// Razorpay server-side helpers. The key secret never leaves the Edge Function runtime.
import { HttpError } from "./common.ts";

const KEY_ID = () => Deno.env.get("RAZORPAY_KEY_ID")!;
const KEY_SECRET = () => Deno.env.get("RAZORPAY_KEY_SECRET")!;

function basicAuth() {
  return "Basic " + btoa(`${KEY_ID()}:${KEY_SECRET()}`);
}

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a), bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export async function createRazorpayOrder(params: {
  amountRupees: number; receipt: string; notes: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: toPaise(params.amountRupees),
      currency: "INR",
      receipt: params.receipt.slice(0, 40),
      notes: params.notes,
    }),
  });
  if (!res.ok) {
    console.error("razorpay order error", res.status, await res.text());
    throw new HttpError(502, "payment_gateway_error", "Could not start the payment. Please try again.");
  }
  return await res.json();
}

export async function fetchRazorpayPayment(paymentId: string): Promise<any> {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: basicAuth() },
  });
  if (!res.ok) {
    console.error("razorpay fetch payment error", res.status);
    throw new HttpError(502, "payment_gateway_error", "Could not confirm the payment right now.");
  }
  return await res.json();
}

/** Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  const expected = await hmacSha256Hex(KEY_SECRET(), `${orderId}|${paymentId}`);
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw_body, webhook_secret) */
export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
  const expected = await hmacSha256Hex(Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!, rawBody);
  return safeEqual(expected, signature);
}
