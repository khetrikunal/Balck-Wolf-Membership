// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Called by the browser after Checkout. The browser's callback is NOT trusted: this function verifies the HMAC
// signature, confirms with Razorpay's API that the payment is captured for the exact amount, and only then
// calls the idempotent fulfill_payment() SQL function. The webhook performs the same fulfilment as a backstop.
import { z } from "npm:zod@3.23.8";
import { adminClient, handler, json, mapDbError, rateLimit, readJson, requireUser, HttpError } from "../_shared/common.ts";
import { fetchRazorpayPayment, toPaise, verifyCheckoutSignature } from "../_shared/razorpay.ts";

const schema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
});

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  await rateLimit(admin, `verify:${user.id}`, 30, 600);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "invalid_request", "Invalid payment details.");
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = parsed.data;

  // The payment record must exist and belong to the caller.
  const { data: pay } = await admin.from("payments")
    .select("id,user_id,amount,fulfilled,purpose,order_id").eq("razorpay_order_id", orderId).maybeSingle();
  if (!pay || pay.user_id !== user.id) throw new HttpError(404, "not_found", "Payment not found.");

  if (pay.fulfilled) return json({ status: "paid", purpose: pay.purpose, order_id: pay.order_id });

  if (!(await verifyCheckoutSignature(orderId, paymentId, sig))) {
    await admin.rpc("mark_payment_failed", { p_razorpay_order_id: orderId, p_reason: "invalid_signature" });
    throw new HttpError(400, "invalid_signature", "Payment verification failed.");
  }

  const rzpPayment = await fetchRazorpayPayment(paymentId);
  if (rzpPayment.order_id !== orderId || rzpPayment.amount !== toPaise(Number(pay.amount)) || rzpPayment.currency !== "INR") {
    console.error("payment mismatch", { orderId, paymentId });
    throw new HttpError(400, "payment_mismatch", "Payment details do not match.");
  }
  if (rzpPayment.status !== "captured") {
    // e.g. authorized-but-not-captured, or still processing. The webhook will finish the job if it captures.
    return json({ status: "pending", message: "Payment is still being confirmed." }, 202);
  }

  const { data, error } = await admin.rpc("fulfill_payment", {
    p_razorpay_order_id: orderId, p_razorpay_payment_id: paymentId, p_signature: sig,
  });
  if (error) throw mapDbError(error.message);
  return json({ status: "paid", purpose: data.purpose, order_id: pay.order_id });
}));
