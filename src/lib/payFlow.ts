import { openCheckout } from "@/lib/razorpay";
import { verifyPayment, type PaymentStart } from "@/services/account";

/**
 * Runs Razorpay Checkout for a server-created order, then asks the SERVER to verify.
 * The browser callback alone never marks anything as paid.
 */
export async function runPayment(start: PaymentStart, prefill: { name?: string; email?: string; contact?: string }, description: string) {
  const result = await openCheckout(start, prefill, description);
  const verified = await verifyPayment(result);
  return { ...verified, order_id: verified.order_id ?? start.order_id };
}
