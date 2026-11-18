// Generic entry point. POST { purpose, ... } where purpose is one of:
//   membership_purchase { plan_id } | membership_renewal { plan_id }
//   product_order { items, address, coupon_code? } | custom_order { quote_id, address }
// No amount is ever accepted from the client.
import { z } from "npm:zod@3.23.8";
import { adminClient, handler, json, readJson, requireUser, HttpError } from "../_shared/common.ts";
import { customOrderSchema, productOrderSchema, startCustomPayment, startMembershipPayment, startProductPayment } from "../_shared/payments.ts";

const schema = z.discriminatedUnion("purpose", [
  z.object({ purpose: z.literal("membership_purchase"), plan_id: z.string().uuid() }),
  z.object({ purpose: z.literal("membership_renewal"), plan_id: z.string().uuid() }),
  z.object({ purpose: z.literal("product_order") }).merge(productOrderSchema),
  z.object({ purpose: z.literal("custom_order") }).merge(customOrderSchema),
]);

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "invalid_request", "Invalid request.");
  const b = parsed.data;
  switch (b.purpose) {
    case "membership_purchase": return json(await startMembershipPayment(admin, user, b.plan_id, false));
    case "membership_renewal": return json(await startMembershipPayment(admin, user, b.plan_id, true));
    case "product_order": return json(await startProductPayment(admin, user, b));
    case "custom_order": return json(await startCustomPayment(admin, user, b));
  }
}));
