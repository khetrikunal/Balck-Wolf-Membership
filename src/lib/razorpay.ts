// Razorpay Checkout loader. The key secret is never in the browser; amounts come from the server's order.
declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } } }

let loading: Promise<void> | null = null;
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error("Could not load Razorpay. Check your connection.")); };
      document.body.appendChild(s);
    });
  }
  return loading;
}

export interface StartedPayment {
  razorpay_order_id: string; amount: number; currency: string; key_id: string; payment_id: string;
}
export interface RazorpaySuccess { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

export async function openCheckout(started: StartedPayment, prefill: { name?: string; email?: string; contact?: string }, description: string): Promise<RazorpaySuccess> {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: started.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: started.amount,
      currency: started.currency,
      order_id: started.razorpay_order_id,
      name: "BLACK WOLF",
      description,
      prefill,
      theme: { color: "#0a0a0a" },
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
      handler: (r: RazorpaySuccess) => resolve(r),
    });
    rzp.on("payment.failed", () => reject(new Error("Payment failed. You have not been charged, or the amount will be refunded.")));
    rzp.open();
  });
}
