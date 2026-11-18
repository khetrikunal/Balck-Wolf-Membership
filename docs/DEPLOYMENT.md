# Deployment

## 1. Supabase
1. Create a project at supabase.com. Install the CLI: `npm i -g supabase`, then `supabase login` and `supabase link --project-ref <ref>`.
2. Apply the schema: `supabase db push` (runs `supabase/migrations/*`). Then run `supabase/seed.sql` in the SQL editor.
3. Auth → URL configuration: set **Site URL** to your Vercel URL and add `http://localhost:5173` as a redirect. Decide whether email confirmation is required (Auth → Providers → Email).
4. Create the first super admin: register on the site, then in the SQL editor:
   ```sql
   insert into public.user_roles (user_id, role) select id, 'super_admin' from auth.users where email = 'you@example.com';
   ```
   Further staff are added in the app (Admin → Website settings → Team & roles).
5. (Optional) enable the `pg_cron` extension; the migration schedules `expire_memberships()` every 15 minutes. Pricing is correct even without it.
6. Storage buckets (`product-images`, `admin-designs`, `custom-designs`) and policies are created by migration `…0003`.

## 2. Razorpay
1. Create API keys (start in **Test mode**). Enable **auto-capture** for payments (verify-payment requires `captured`).
2. Webhook: Dashboard → Webhooks → URL `https://<ref>.supabase.co/functions/v1/razorpay-webhook`, set a secret, enable events: `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`.

## 3. Edge Functions
```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx SITE_URL=https://your-site.vercel.app
supabase functions deploy purchase-membership renew-membership create-product-order create-payment-order verify-payment
supabase functions deploy razorpay-webhook --no-verify-jwt
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Never put them in the frontend or GitHub.

## 4. Vercel
1. Push to GitHub (`.env` is git-ignored). Import the repo in Vercel (framework: Vite).
2. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAZORPAY_KEY_ID`.
3. Deploy. `vercel.json` already adds SPA rewrites and security headers.

## 5. Go live
Switch Razorpay to live keys (update the secrets and `VITE_RAZORPAY_KEY_ID`), re-create the webhook with live credentials, and complete `docs/TESTING.md` again in live mode with a small real payment.
