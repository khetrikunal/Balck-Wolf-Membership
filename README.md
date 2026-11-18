# BLACK WOLF — Premium Streetwear E-commerce + Paid Membership

React + Vite + TypeScript + Tailwind frontend on **Vercel**; **Supabase** (Postgres, Auth, Storage, RLS, Edge Functions) as the entire backend; **Razorpay** for payments. No separate Node/Express server.

## What is in this repo

| Path | Contents |
|---|---|
| `src/pages/public` | Home, Shop, T-shirts, Track Pants, Product Details, Membership, Custom Clothing, About, Contact, Login, Register, Cart, Checkout, Order Success/Failure, 4 policy pages, public QR verify page |
| `src/pages/account` | Customer dashboard: profile, orders + tracking, membership, digital card (preview + PNG download), membership history, payment history, custom requests (+ accept quote & pay), wishlist, addresses, notifications |
| `src/pages/admin` | Admin dashboard (separate, role-gated, code-split): analytics, products/variants/images, categories, inventory, plans, members, custom requests, quotations, design library, orders, shipping, customers, payments, coupons, reports (+CSV), website settings, roles, audit logs |
| `supabase/migrations` | `…0001_schema.sql` (all tables), `…0002_functions.sql` (pricing, membership, payment fulfilment, analytics, audit), `…0003_rls.sql` (RLS + storage policies) |
| `supabase/functions` | `create-payment-order`, `verify-payment`, `razorpay-webhook`, `purchase-membership`, `renew-membership`, `create-product-order` (+ `_shared`) — see `supabase/functions/README.md` |
| `supabase/seed.sql` | Categories, 3 starter membership plans, shipping/contact/hero settings. **No products are seeded** — add them in Admin. |
| `supabase/tests` | SQL test for pricing, idempotent fulfilment, expiry, refunds, QR privacy and RLS isolation |
| `docs/DEPLOYMENT.md`, `docs/TESTING.md` | Step-by-step deployment and test plan |

## Quick start
```bash
npm install
cp .env.example .env        # fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_RAZORPAY_KEY_ID
npm run dev
```
Backend setup (Supabase project, migrations, secrets, functions, first super admin, webhook) is in **docs/DEPLOYMENT.md**.

## Security model (summary)
- RLS is enabled on every table. Customers can only read their own orders, memberships, payments, addresses, requests and files. Staff/admin/super_admin permissions come from the `user_roles` table, read server-side — never from the client.
- Clients cannot insert orders, payments, memberships or cards. Those are created only by Edge Functions using the service-role key (never in the frontend).
- **Prices and membership eligibility are computed in PostgreSQL** (`create_product_order`, `prepare_membership_payment`, `is_active_member`). The client never sends an amount. Expiry is enforced at read time, so a missed cron run cannot leak member pricing.
- Payments: Razorpay orders are created server-side; `verify-payment` checks the HMAC signature **and** confirms capture + exact amount with Razorpay's API; the webhook verifies the signature against the raw body and de-duplicates by event id. Both paths call one idempotent `fulfill_payment()` (row-locked), so memberships activate once and stock is deducted once.
- Customer design uploads go to a **private** bucket under `<user_id>/…`, restricted to JPG/PNG/WebP ≤ 10 MB (enforced by bucket config, storage policy and client checks).
- QR cards carry only an unguessable 192-bit token; the public verify RPC returns membership number/plan/status/expiry only.
- Admin sign-up does not exist; roles are granted by a super admin (Admin → Website settings → Team & roles).

## Honest status
Verified here: TypeScript typecheck and production build pass; all three migrations + seed apply on PostgreSQL (PGlite); `supabase/tests/payments_and_rls.test.sql` passes (member pricing, duplicate-fulfilment safety, stock deduction once, expiry, suspension, refund, QR privacy, cross-customer RLS isolation).

**Not yet verified (needs your Supabase/Razorpay accounts):** the Edge Functions have not been run against live Supabase or Razorpay (test mode), the Razorpay Checkout round trip, webhook delivery, Supabase Auth email flows, storage uploads against a real project, and the Vercel deploy. Follow `docs/TESTING.md` before going live — do not treat payments as done until that checklist passes with Razorpay test keys.

## Known limitations / decisions
- Cart requires sign-in (stored in the database); there is no guest cart.
- Membership is one-time + manual renewal (v1 as specified). Renewal uses the plan's current duration.
- If stock runs out between order creation and payment capture, the sale is still fulfilled, stock floors at 0 and an `oversell_shortfall` row is written to inventory logs for you to resolve.
- Refunds are issued in the Razorpay dashboard and recorded automatically by the webhook (a refund API button is not included).
- Admin "design library" stores designs and attaches them to customizable products; the storefront does not yet render a design picker on the product page.
- Member prices are visible to everyone as an upsell ("Members pay ₹X") but only charged to active members; remove that line in `ProductCard`/`ProductDetails` if you want them fully hidden.
- Policy pages are template text — get them reviewed before launch. Place your logo at `public/logo.svg`.
- Main JS bundle is ~190 kB gzipped (admin/account are lazy-loaded); further splitting is possible.
