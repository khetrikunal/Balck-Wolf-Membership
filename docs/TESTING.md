# Testing

## Automated (included)
- `npm run typecheck` and `npm run build`.
- `supabase/tests/payments_and_rls.test.sql` — run on a scratch DB after migrations + seed (e.g. `supabase db reset` locally, then `psql "$DB_URL" -f supabase/tests/payments_and_rls.test.sql`). Expect `ALL TESTS PASSED`. Covers server pricing, member vs non-member price, over-stock rejection, duplicate-purchase rejection, idempotent fulfilment (membership, card, transaction, stock), refund, read-time expiry, suspension, renewal, QR privacy, and cross-customer RLS isolation.

## Manual checklist (Razorpay TEST mode — required before launch)
Test card: any valid test card from Razorpay docs. Use two customer accounts (A, B) and one admin.
1. Register A and B; log in/out; confirm emails if enabled.
2. Admin: create category, product with image, variants (stock), regular + member price, status Active → appears on the storefront.
3. A (non-member) sees regular price; checkout → pay → order is `paid`, stock reduced by exactly the quantity, shipment row exists.
4. A buys a membership → membership Active, number issued, card shows QR, PNG downloads; scanning QR opens `/verify/<token>` showing no personal data.
5. A now sees member prices; a new order is charged the member price. B still sees regular prices.
6. Confirm duplicates: in Razorpay dashboard re-send the `payment.captured` webhook → no second activation, no second stock deduction, `payment_webhook_events` has one row per event id.
7. Tamper tests: call `verify-payment` with a wrong signature (expect 400); call `create-product-order` with an extra `amount` field (ignored); try renewing with a suspended membership (blocked).
8. Admin suspends A's membership → member price disappears. Set `expires_at` in the past → also disappears.
9. Isolation: signed in as B, try `/account/orders/<A's order id>` (empty) and query Supabase REST for A's rows (0 rows). Staff-only pages redirect a normal user.
10. Custom flow: A uploads a PNG (and verify a PDF / >10 MB file is rejected) → admin approves, sends quote → A accepts and pays → admin moves to In production → Completed.
11. Shipping: admin adds courier/tracking → A sees it on the order page; marking delivered updates status.
12. Refund in Razorpay dashboard → webhook marks payment refunded; for a membership payment the membership becomes Cancelled.
13. Failed payment (use Razorpay failure test card) → failure page, order `failed`, cart intact.
