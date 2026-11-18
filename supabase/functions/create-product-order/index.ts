// POST { items:[{variant_id,quantity}], address, coupon_code? }
// Creates a pending order with server-calculated prices (member pricing decided server-side) and a Razorpay order.
import { adminClient, handler, json, readJson, requireUser, HttpError } from "../_shared/common.ts";
import { productOrderSchema, startProductPayment } from "../_shared/payments.ts";

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const parsed = productOrderSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "invalid_request", "Please check your cart and address.");
  return json(await startProductPayment(admin, user, parsed.data));
}));
