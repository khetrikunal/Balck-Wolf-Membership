// POST { plan_id } → manual renewal. Active members extend from their current expiry; expired members restart from now.
import { z } from "npm:zod@3.23.8";
import { adminClient, handler, json, readJson, requireUser, HttpError } from "../_shared/common.ts";
import { startMembershipPayment } from "../_shared/payments.ts";

const schema = z.object({ plan_id: z.string().uuid() });

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "invalid_request", "Invalid plan.");
  return json(await startMembershipPayment(admin, user, parsed.data.plan_id, true));
}));
