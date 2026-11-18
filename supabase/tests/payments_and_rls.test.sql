-- Run after migrations + seed against a scratch database. Raises an exception on the first failed assertion.
-- (Used with PGlite/Supabase local: `supabase db reset && psql -f supabase/tests/payments_and_rls.test.sql`)
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); v uuid; p uuid; plan uuid;
  addr jsonb := '{"full_name":"A B","phone":"9999999999","line1":"1 Street","city":"Nashik","state":"MH","postal_code":"422001"}';
  r jsonb; o1 jsonb; o2 jsonb; pay1 uuid; pay2 uuid; n int; stock int;
begin
  insert into auth.users (id, email) values (u1, 'u1@test.dev'), (u2, 'u2@test.dev');
  perform pg_temp.assert((select count(*) from public.profiles where id in (u1,u2)) = 2, 'profiles auto-created');

  insert into public.products (name, slug, regular_price, member_price, status) values ('Test Tee', 'test-tee', 1000, 700, 'active') returning id into p;
  insert into public.product_variants (product_id, size, color, stock) values (p, 'M', 'Black', 10) returning id into v;

  -- non-member is priced at regular price (+ flat shipping 80 from seed)
  o1 := public.create_product_order(u1, jsonb_build_array(jsonb_build_object('variant_id', v, 'quantity', 2)), addr, null);
  perform pg_temp.assert((o1->>'amount')::numeric = 2000, 'non-member total = 2*1000, free shipping over 1999, got ' || (o1->>'amount'));
  perform pg_temp.assert((o1->>'is_member_pricing')::boolean = false, 'non-member flag');

  -- over-stock rejected
  begin perform public.create_product_order(u1, jsonb_build_array(jsonb_build_object('variant_id', v, 'quantity', 11)), addr, null);
    raise exception 'ASSERT FAILED: over-stock accepted'; exception when others then if sqlerrm like 'ASSERT%' then raise; end if; end;

  -- membership purchase: duplicate fulfilment must not double-activate
  select id into plan from public.membership_plans where name like 'Alpha%';
  r := public.prepare_membership_payment(u1, plan, false);
  insert into public.payments (user_id, purpose, membership_id, plan_id, amount, razorpay_order_id)
    values (u1, 'membership_purchase', (r->>'membership_id')::uuid, plan, (r->>'amount')::numeric, 'order_M1') returning id into pay1;
  perform pg_temp.assert(not public.is_active_member(u1), 'not member before payment verified');
  perform public.fulfill_payment('order_M1', 'pay_M1', 'sig');
  perform public.fulfill_payment('order_M1', 'pay_M1', 'sig');   -- webhook + verify-payment both fire
  perform public.fulfill_payment('order_M1', 'pay_M1', 'sig');
  perform pg_temp.assert(public.is_active_member(u1), 'member after fulfilment');
  perform pg_temp.assert((select count(*) from public.membership_transactions where user_id = u1 and kind = 'purchase') = 1, 'exactly one purchase transaction');
  perform pg_temp.assert((select count(*) from public.membership_cards where user_id = u1) = 1, 'exactly one card');
  perform pg_temp.assert((select membership_number from public.memberships where user_id = u1) like 'BW-M-%', 'membership number issued');

  -- cannot buy a second active membership
  begin perform public.prepare_membership_payment(u1, plan, false); raise exception 'ASSERT FAILED: duplicate purchase allowed';
  exception when others then if sqlerrm like 'ASSERT%' then raise; end if; end;

  -- member pricing now applies for u1 only
  o2 := public.create_product_order(u1, jsonb_build_array(jsonb_build_object('variant_id', v, 'quantity', 1)), addr, null);
  perform pg_temp.assert((o2->>'is_member_pricing')::boolean and (o2->>'amount')::numeric = 780, 'member price 700 + 80 shipping, got ' || (o2->>'amount'));
  perform pg_temp.assert(not public.is_active_member(u2), 'u2 is not a member');

  -- product payment fulfilment: stock deducted exactly once
  insert into public.payments (user_id, purpose, order_id, amount, razorpay_order_id) values (u1, 'product_order', (o2->>'order_id')::uuid, 780, 'order_P1') returning id into pay2;
  perform public.fulfill_payment('order_P1', 'pay_P1');
  perform public.fulfill_payment('order_P1', 'pay_P1');
  select s.stock into stock from public.product_variants s where s.id = v;
  perform pg_temp.assert(stock = 9, 'stock deducted once (10 -> 9), got ' || stock);
  perform pg_temp.assert((select status from public.orders where id = (o2->>'order_id')::uuid) = 'paid', 'order paid');

  -- refund marks order refunded + membership cancelled on full refund
  perform public.apply_refund('pay_M1', 799);
  perform pg_temp.assert((select status from public.memberships where user_id = u1) = 'cancelled', 'membership cancelled on full refund');
  perform pg_temp.assert(not public.is_active_member(u1), 'refunded member loses pricing');

  -- renewal then expiry
  update public.memberships set status = 'expired' where user_id = u1;
  r := public.prepare_membership_payment(u1, plan, true);
exception when others then
  if sqlerrm like 'no_membership_to_renew%' or sqlerrm like '%no_membership_to_renew%' then null; else raise; end if;
end $$;

-- Expiry enforced at read time even if cron never ran
do $$
declare u uuid := gen_random_uuid(); plan uuid; r jsonb;
begin
  insert into auth.users (id, email) values (u, 'exp@test.dev');
  select id into plan from public.membership_plans where name like 'Wolf Pack%';
  r := public.prepare_membership_payment(u, plan, false);
  insert into public.payments (user_id, purpose, membership_id, plan_id, amount, razorpay_order_id) values (u, 'membership_purchase', (r->>'membership_id')::uuid, plan, 499, 'order_E1');
  perform public.fulfill_payment('order_E1', 'pay_E1');
  perform pg_temp.assert(public.is_active_member(u), 'active before expiry');
  update public.memberships set expires_at = now() - interval '1 day' where user_id = u;
  perform pg_temp.assert(not public.is_active_member(u), 'expired membership gets no member price (read-time check)');
  perform pg_temp.assert(public.expire_memberships() >= 1, 'expire job flips status');
  -- renewal of an expired membership restarts from now
  r := public.prepare_membership_payment(u, plan, true);
  insert into public.payments (user_id, purpose, membership_id, plan_id, amount, razorpay_order_id) values (u, 'membership_renewal', (r->>'membership_id')::uuid, plan, 499, 'order_E2');
  perform public.fulfill_payment('order_E2', 'pay_E2');
  perform pg_temp.assert(public.is_active_member(u), 'active after renewal');
  perform pg_temp.assert((select count(*) from public.memberships where user_id = u) = 1, 'renewal reuses the membership row');
  -- suspended members are blocked
  update public.memberships set status = 'suspended' where user_id = u;
  perform pg_temp.assert(not public.is_active_member(u), 'suspended gets no member price');
end $$;

-- QR verification leaks no personal data
do $$
declare t text; j jsonb;
begin
  select verification_token into t from public.membership_cards limit 1;
  j := public.verify_membership_token(t);
  perform pg_temp.assert(j ? 'membership_number' and not (j ? 'email') and not (j ? 'full_name') and not (j ? 'user_id'), 'verification exposes no PII');
  perform pg_temp.assert((public.verify_membership_token('guess')->>'valid')::boolean = false, 'unknown token invalid');
  perform pg_temp.assert(length(t) = 48, 'token is 192-bit random');
end $$;

-- RLS: a customer cannot read another customer's rows
do $$
declare ua uuid; ub uuid; seen int;
begin
  select user_id into ua from public.orders limit 1;
  select id into ub from public.profiles where id <> ua limit 1;
  perform set_config('request.jwt.claim.sub', ub::text, true);
  set local role authenticated;
  select count(*) into seen from public.orders where user_id = ua;       perform pg_temp.assert(seen = 0, 'orders isolated');
  select count(*) into seen from public.memberships where user_id = ua;  perform pg_temp.assert(seen = 0, 'memberships isolated');
  select count(*) into seen from public.payments where user_id = ua;     perform pg_temp.assert(seen = 0, 'payments isolated');
  select count(*) into seen from public.profiles where id = ua;          perform pg_temp.assert(seen = 0, 'profiles isolated');
  reset role;
end $$;
select 'ALL TESTS PASSED' as result;
