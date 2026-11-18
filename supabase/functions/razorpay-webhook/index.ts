// Razorpay webhook receiver (deployed with --no-verify-jwt; authenticity is the HMAC signature).
// - Signature is verified against the RAW request body.
// - Each event id is stored once (unique constraint) so duplicates are acknowledged without re-processing.
// - Handlers call idempotent SQL functions, so retries and out-of-order delivery are safe.
import { adminClient, corsHeaders } from "../_shared/common.ts";
import { fetchRazorpayPayment, verifyWebhookSignature } from "../_shared/razorpay.ts";

const ok = (body: unknown = { ok: true }, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ error: "method_not_allowed" }, 405);

  const raw = await req.text();                       // raw body, exactly as signed
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !(await verifyWebhookSignature(raw, signature))) {
    return ok({ error: "invalid_signature" }, 400);
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return ok({ error: "invalid_json" }, 400); }

  const eventId = req.headers.get("x-razorpay-event-id") ?? `${event.event}:${event.payload?.payment?.entity?.id ?? event.payload?.refund?.entity?.id ?? crypto.randomUUID()}`;
  const admin = adminClient();

  // Idempotency: record the event; if it already exists and was processed, acknowledge and stop.
  const { error: insErr } = await admin.from("payment_webhook_events")
    .insert({ event_id: eventId, event_type: event.event, payload: event });
  if (insErr) {
    if (insErr.code === "23505") {
      const { data: existing } = await admin.from("payment_webhook_events").select("processed").eq("event_id", eventId).single();
      if (existing?.processed) return ok({ ok: true, duplicate: true });
      // previously failed → fall through and retry processing
    } else {
      console.error("webhook store failed", insErr.message);
      return ok({ error: "store_failed" }, 500);          // non-2xx → Razorpay retries
    }
  }

  try {
    const payment = event.payload?.payment?.entity;
    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        const p = payment ?? event.payload?.order?.entity;
        const orderId = payment?.order_id ?? event.payload?.order?.entity?.id;
        const paymentId = payment?.id;
        if (orderId && paymentId) {
          const { error } = await admin.rpc("fulfill_payment", { p_razorpay_order_id: orderId, p_razorpay_payment_id: paymentId });
          if (error && !error.message.includes("payment_not_found")) throw error;
        }
        break;
      }
      case "payment.failed": {
        if (payment?.order_id) {
          await admin.rpc("mark_payment_failed", {
            p_razorpay_order_id: payment.order_id,
            p_reason: payment.error_description ?? "payment_failed",
          });
        }
        break;
      }
      case "refund.created":
      case "refund.processed":
      case "payment.refunded": {
        const paymentId = event.payload?.refund?.entity?.payment_id ?? payment?.id;
        if (paymentId) {
          // Ask Razorpay for the cumulative refunded amount rather than trusting a single event's delta.
          const full = await fetchRazorpayPayment(paymentId);
          await admin.rpc("apply_refund", { p_razorpay_payment_id: paymentId, p_refund_amount: (full.amount_refunded ?? 0) / 100 });
        }
        break;
      }
      default:
        break; // unhandled events are stored and acknowledged
    }
    await admin.from("payment_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString(), error: null }).eq("event_id", eventId);
    return ok();
  } catch (e) {
    console.error("webhook processing failed", e);
    await admin.from("payment_webhook_events").update({ error: String((e as Error).message ?? e) }).eq("event_id", eventId);
    return ok({ error: "processing_failed" }, 500);        // Razorpay will retry
  }
});
