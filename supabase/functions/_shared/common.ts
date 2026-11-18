// Shared helpers for BLACK WOLF Edge Functions
import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2";

const SITE_URL = Deno.env.get("SITE_URL") ?? "*";

export const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

/** Database exception codes raised by our SQL functions → friendly HTTP errors. */
const DB_ERRORS: Record<string, [number, string]> = {
  plan_unavailable: [404, "This membership plan is not available."],
  membership_suspended: [403, "Your membership is suspended. Please contact support."],
  already_active: [409, "You already have an active membership. Use renewal instead."],
  already_lifetime: [409, "You already have a lifetime membership."],
  no_membership_to_renew: [409, "No membership found to renew."],
  invalid_items: [400, "Your cart is empty or invalid."],
  invalid_address: [400, "Please provide a complete shipping address."],
  item_unavailable: [409, "One or more items are no longer available."],
  invalid_quantity: [400, "Invalid item quantity."],
  insufficient_stock: [409, "One or more items are out of stock."],
  invalid_coupon: [400, "This coupon is not valid."],
  quote_not_accepted: [409, "Please accept the quotation before paying."],
  forbidden: [403, "Forbidden."],
  not_found: [404, "Not found."],
};

export function mapDbError(message: string): HttpError {
  for (const key of Object.keys(DB_ERRORS)) {
    if (message.includes(key)) return new HttpError(DB_ERRORS[key][0], key, DB_ERRORS[key][1]);
  }
  console.error("db error:", message);
  return new HttpError(500, "internal_error", "Something went wrong.");
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve the caller from their JWT. Roles are never read from the request body. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<User> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "unauthorized", "Please sign in.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Please sign in.");
  return data.user;
}

export async function rateLimit(admin: SupabaseClient, key: string, limit: number, windowSeconds: number) {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) throw mapDbError(error.message);
  if (data === false) throw new HttpError(429, "rate_limited", "Too many requests. Please try again shortly.");
}

/** Wrap a handler with CORS, method check and uniform error handling. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      console.error("unhandled:", e);
      return json({ error: "internal_error", message: "Something went wrong." }, 500);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new HttpError(400, "invalid_json", "Invalid request body."); }
}
