# Edge Functions

All privileged work happens here (service-role key lives only in the Supabase runtime). Prices are computed in PostgreSQL; no function accepts an amount from the client.

| Function | Auth | Input | What it does |
|---|---|---|---|
| `purchase-membership` | user JWT | `{plan_id}` | Validates eligibility (no duplicate active membership, not suspended), creates a Razorpay order for the plan price, records a `payments` row. |
| `renew-membership` | user JWT | `{plan_id}` | Same for manual renewal; active members extend from current expiry. |
| `create-product-order` | user JWT | `{items[{variant_id,quantity}], address, coupon_code?}` | `create_product_order()` prices items (member pricing decided server-side), checks stock, applies coupon/shipping, creates a pending order + Razorpay order. |
| `create-payment-order` | user JWT | `{purpose, ...}` | Single entry point for membership_purchase, membership_renewal, product_order, custom_order. |
| `verify-payment` | user JWT | `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` | Verifies HMAC signature, confirms capture + amount via Razorpay API, then runs idempotent `fulfill_payment()`. |
| `razorpay-webhook` | HMAC signature (no JWT) | Razorpay event | Verifies signature on raw body, de-duplicates by event id, fulfils / fails / refunds. |

Shared code is in `_shared/`. Sensitive endpoints are rate limited via `check_rate_limit()`.

Deploy:
```
supabase functions deploy purchase-membership renew-membership create-product-order create-payment-order verify-payment
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase secrets set RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... SITE_URL=https://your-site.vercel.app
```
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase.)
