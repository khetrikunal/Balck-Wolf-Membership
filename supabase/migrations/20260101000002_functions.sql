-- BLACK WOLF — business logic functions
-- Functions marked SERVICE ONLY are executable by service_role (Edge Functions) exclusively.

-- ---------- role helpers ----------
create or replace function public.has_role(_uid uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role = _role)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin','super_admin'))
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
$$;

create or replace function public.my_roles() returns setof public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

-- ---------- new user bootstrap ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  insert into public.carts (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- membership eligibility (server-side truth) ----------
create or replace function public.is_active_member(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = p_user
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.expires_at is null or m.expires_at > now())
  )
$$;

-- callable by the signed-in user to learn their own pricing tier
create or replace function public.my_pricing_tier() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_member(auth.uid())
$$;

create or replace function public.expire_memberships() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with e as (
    update public.memberships set status = 'expired'
    where status = 'active' and expires_at is not null and expires_at <= now()
    returning id, user_id
  ), t as (
    insert into public.membership_transactions (membership_id, user_id, kind)
    select id, user_id, 'expiry' from e returning 1
  )
  select count(*) into n from e;
  return n;
end $$;

-- public QR verification: returns no personal data
create or replace function public.verify_membership_token(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  select m.membership_number, m.status, m.expires_at, m.plan_snapshot->>'name' as plan_name
    into r
  from public.membership_cards c join public.memberships m on m.id = c.membership_id
  where c.verification_token = p_token;
  if not found then return jsonb_build_object('valid', false); end if;
  return jsonb_build_object(
    'valid', (r.status = 'active' and (r.expires_at is null or r.expires_at > now())),
    'membership_number', r.membership_number,
    'plan', r.plan_name,
    'status', r.status,
    'expires_at', r.expires_at);
end $$;

-- ---------- notifications ----------
create or replace function public.notify(p_user uuid, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body) values (p_user, p_title, p_body)
$$;
revoke execute on function public.notify(uuid, text, text) from public, anon, authenticated;

-- ---------- rate limiting (SERVICE ONLY) ----------
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.rate_limits as r (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into c;
  return c <= p_limit;
end $$;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- ---------- membership payment preparation (SERVICE ONLY) ----------
create or replace function public.prepare_membership_payment(p_user uuid, p_plan_id uuid, p_renewal boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare plan public.membership_plans; mem public.memberships;
begin
  select * into plan from public.membership_plans where id = p_plan_id and status = 'active';
  if not found then raise exception 'plan_unavailable'; end if;

  select * into mem from public.memberships
  where user_id = p_user and status in ('pending','active','expired','suspended')
  order by created_at desc limit 1 for update;

  if found then
    if mem.status = 'suspended' then raise exception 'membership_suspended'; end if;
    if mem.status = 'active' and mem.expires_at is null then raise exception 'already_lifetime'; end if;
    if not p_renewal and mem.status = 'active' and mem.expires_at > now() then raise exception 'already_active'; end if;
    if p_renewal and mem.status = 'pending' then raise exception 'no_membership_to_renew'; end if;
  else
    if p_renewal then raise exception 'no_membership_to_renew'; end if;
    insert into public.memberships (user_id, plan_id, status, plan_snapshot)
    values (p_user, plan.id, 'pending', to_jsonb(plan)) returning * into mem;
  end if;

  -- remember the plan being bought without touching an active period
  if mem.status = 'pending' then
    update public.memberships set plan_id = plan.id, plan_snapshot = to_jsonb(plan) where id = mem.id;
  end if;

  return jsonb_build_object('membership_id', mem.id, 'plan_id', plan.id, 'amount', plan.price, 'plan_name', plan.name);
end $$;
revoke execute on function public.prepare_membership_payment(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.prepare_membership_payment(uuid, uuid, boolean) to service_role;

-- ---------- product order creation (SERVICE ONLY) ----------
create or replace function public.create_product_order(p_user uuid, p_items jsonb, p_address jsonb, p_coupon text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  is_member boolean := public.is_active_member(p_user);
  v_order public.orders;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_coupon public.coupons;
  v_settings jsonb;
  v_lines jsonb;
  n int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items';
  end if;
  if p_address is null or coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'line1','') = ''
     or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'postal_code','') = '' then
    raise exception 'invalid_address';
  end if;

  select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) into v_lines from (
    with req as (
      select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
      from jsonb_array_elements(p_items) e group by 1
    )
    select v.id as variant_id, p.id as product_id, p.name as product_name, v.size, v.color, v.stock, req.qty,
      (select pi.storage_path from public.product_images pi where pi.product_id = p.id order by pi.sort_order limit 1) as image_path,
      case when is_member
        then coalesce(v.member_price_override, p.member_price, v.price_override, p.regular_price)
        else coalesce(v.price_override, p.regular_price) end as unit_price
    from req
    join public.product_variants v on v.id = req.variant_id and v.is_active
    join public.products p on p.id = v.product_id and p.status = 'active'
  ) l;

  n := jsonb_array_length(v_lines);
  if n <> (select count(distinct (e->>'variant_id')) from jsonb_array_elements(p_items) e) then
    raise exception 'item_unavailable';
  end if;
  if exists (select 1 from jsonb_to_recordset(v_lines) as x(qty int) where x.qty <= 0 or x.qty > 20) then
    raise exception 'invalid_quantity';
  end if;
  if exists (select 1 from jsonb_to_recordset(v_lines) as x(qty int, stock int) where x.stock < x.qty) then
    raise exception 'insufficient_stock';
  end if;

  select sum(x.unit_price * x.qty) into v_subtotal
  from jsonb_to_recordset(v_lines) as x(unit_price numeric, qty int);

  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_coupon from public.coupons
    where upper(code) = upper(trim(p_coupon)) and is_active
      and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now())
      and (max_uses is null or used_count < max_uses) and min_order_amount <= v_subtotal;
    if not found then raise exception 'invalid_coupon'; end if;
    v_discount := case v_coupon.discount_type
      when 'percent' then round(v_subtotal * least(v_coupon.discount_value, 100) / 100, 2)
      else least(v_coupon.discount_value, v_subtotal) end;
  end if;

  select value into v_settings from public.site_settings where key = 'shipping';
  if v_settings is not null then
    v_shipping := case when (v_settings->>'free_above') is not null and (v_subtotal - v_discount) >= (v_settings->>'free_above')::numeric
      then 0 else coalesce((v_settings->>'flat_rate')::numeric, 0) end;
  end if;

  insert into public.orders (user_id, order_type, is_member_pricing, subtotal, discount_total, shipping_total, total, coupon_id, shipping_address)
  values (p_user, 'product', is_member, v_subtotal, v_discount, v_shipping, v_subtotal - v_discount + v_shipping, v_coupon.id, p_address)
  returning * into v_order;

  insert into public.order_items (order_id, variant_id, product_id, product_name, size, color, image_path, unit_price, quantity, line_total)
  select v_order.id, x.variant_id, x.product_id, x.product_name, x.size, x.color, x.image_path, x.unit_price, x.qty, x.unit_price * x.qty
  from jsonb_to_recordset(v_lines) as x(variant_id uuid, product_id uuid, product_name text, size text, color text, image_path text, unit_price numeric, qty int);

  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'amount', v_order.total, 'is_member_pricing', is_member);
end $$;
revoke execute on function public.create_product_order(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_product_order(uuid, jsonb, jsonb, text) to service_role;

-- ---------- custom quote workflow ----------
create or replace function public.send_quote(p_request_id uuid, p_amount numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare req public.custom_design_requests; qid uuid;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  select * into req from public.custom_design_requests where id = p_request_id for update;
  if not found then raise exception 'not_found'; end if;
  if req.status not in ('approved','quotation_sent') then raise exception 'request_not_approved'; end if;
  update public.custom_design_quotes set status = 'expired' where request_id = p_request_id and status = 'sent';
  insert into public.custom_design_quotes (request_id, amount, notes, created_by)
  values (p_request_id, p_amount, p_notes, auth.uid()) returning id into qid;
  update public.custom_design_requests set status = 'quotation_sent' where id = p_request_id;
  perform public.notify(req.user_id, 'Quotation ready', 'We have sent a quotation for your custom design request.');
  return qid;
end $$;

create or replace function public.accept_quote(p_quote_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q public.custom_design_quotes; req public.custom_design_requests;
begin
  select * into q from public.custom_design_quotes where id = p_quote_id for update;
  if not found then raise exception 'not_found'; end if;
  select * into req from public.custom_design_requests where id = q.request_id for update;
  if req.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if q.status <> 'sent' or req.status <> 'quotation_sent' then raise exception 'quote_not_open'; end if;
  update public.custom_design_quotes set status = 'accepted', accepted_at = now() where id = q.id;
  update public.custom_design_requests set status = 'accepted' where id = req.id;
end $$;

create or replace function public.prepare_custom_order(p_user uuid, p_quote_id uuid, p_address jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.custom_design_quotes; req public.custom_design_requests; o public.orders;
begin
  select * into q from public.custom_design_quotes where id = p_quote_id;
  if not found then raise exception 'not_found'; end if;
  select * into req from public.custom_design_requests where id = q.request_id;
  if req.user_id <> p_user then raise exception 'forbidden'; end if;
  if q.status <> 'accepted' then raise exception 'quote_not_accepted'; end if;
  if p_address is null or coalesce(p_address->>'line1','') = '' then raise exception 'invalid_address'; end if;

  select * into o from public.orders where custom_request_id = req.id and status = 'pending_payment' limit 1;
  if not found then
    insert into public.orders (user_id, order_type, custom_request_id, subtotal, total, shipping_address)
    values (p_user, 'custom', req.id, q.amount, q.amount, p_address) returning * into o;
    insert into public.order_items (order_id, product_name, size, color, unit_price, quantity, line_total)
    values (o.id, 'Custom ' || req.clothing_type, req.size, req.color, q.amount / req.quantity, req.quantity, q.amount);
  end if;
  return jsonb_build_object('order_id', o.id, 'amount', q.amount, 'quote_id', q.id);
end $$;
revoke execute on function public.prepare_custom_order(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_custom_order(uuid, uuid, jsonb) to service_role;

-- ---------- idempotent payment fulfilment (SERVICE ONLY) ----------
-- Called from verify-payment and razorpay-webhook. Safe to call any number of times.
create or replace function public.fulfill_payment(p_razorpay_order_id text, p_razorpay_payment_id text, p_signature text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pay public.payments; ord public.orders; mem public.memberships; plan public.membership_plans;
  it record; base timestamptz; new_exp timestamptz; qrow public.custom_design_quotes;
begin
  select * into pay from public.payments where razorpay_order_id = p_razorpay_order_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if pay.fulfilled then
    return jsonb_build_object('status', 'already_fulfilled', 'payment_id', pay.id, 'purpose', pay.purpose);
  end if;

  update public.payments set status = 'paid', fulfilled = true,
    razorpay_payment_id = coalesce(razorpay_payment_id, p_razorpay_payment_id),
    razorpay_signature = coalesce(p_signature, razorpay_signature)
  where id = pay.id;

  if pay.purpose = 'product_order' then
    select * into ord from public.orders where id = pay.order_id for update;
    if not ord.stock_deducted then
      for it in select * from public.order_items where order_id = ord.id and variant_id is not null loop
        perform 1 from public.product_variants where id = it.variant_id for update;
        if (select stock from public.product_variants where id = it.variant_id) < it.quantity then
          insert into public.inventory_logs (variant_id, change, reason, order_id)
          values (it.variant_id, 0, 'oversell_shortfall: needed ' || it.quantity, ord.id);
        end if;
        update public.product_variants set stock = greatest(stock - it.quantity, 0) where id = it.variant_id;
        insert into public.inventory_logs (variant_id, change, reason, order_id)
        values (it.variant_id, -it.quantity, 'sale', ord.id);
      end loop;
    end if;
    update public.orders set status = 'paid', stock_deducted = true where id = ord.id;
    if ord.coupon_id is not null then
      update public.coupons set used_count = used_count + 1 where id = ord.coupon_id;
    end if;
    delete from public.cart_items where cart_id in (select id from public.carts where user_id = ord.user_id);
    insert into public.shipments (order_id) values (ord.id) on conflict (order_id) do nothing;
    perform public.notify(ord.user_id, 'Order confirmed', 'Payment received for order ' || ord.order_number || '.');

  elsif pay.purpose in ('membership_purchase', 'membership_renewal') then
    select * into mem from public.memberships where id = pay.membership_id for update;
    select * into plan from public.membership_plans where id = pay.plan_id;
    base := case when mem.status = 'active' and mem.expires_at is not null and mem.expires_at > now()
                 then mem.expires_at else now() end;
    new_exp := case plan.duration_unit
      when 'days' then base + make_interval(days => plan.duration)
      when 'months' then base + make_interval(months => plan.duration)
      when 'years' then base + make_interval(years => plan.duration)
      else null end;
    update public.memberships set
      status = 'active', plan_id = plan.id, plan_snapshot = to_jsonb(plan),
      starts_at = coalesce(case when mem.status = 'active' then mem.starts_at end, now()),
      expires_at = new_exp,
      membership_number = coalesce(membership_number, 'BW-M-' || nextval('public.membership_number_seq'))
    where id = mem.id;
    insert into public.membership_cards (membership_id, user_id) values (mem.id, mem.user_id)
    on conflict (membership_id) do nothing;
    insert into public.membership_transactions (membership_id, user_id, payment_id, kind, amount, period_start, period_end)
    values (mem.id, mem.user_id, pay.id,
      case when pay.purpose = 'membership_renewal' then 'renewal' else 'purchase' end,
      pay.amount, base, new_exp)
    on conflict (payment_id) do nothing;
    perform public.notify(mem.user_id, 'Membership active', 'Your ' || plan.name || ' membership is active.');

  elsif pay.purpose = 'custom_order' then
    select * into qrow from public.custom_design_quotes where id = pay.custom_quote_id for update;
    update public.custom_design_quotes set status = 'paid' where id = qrow.id;
    update public.custom_design_requests set status = 'paid' where id = qrow.request_id;
    update public.orders set status = 'paid' where id = pay.order_id;
    insert into public.shipments (order_id) values (pay.order_id) on conflict (order_id) do nothing;
    perform public.notify(pay.user_id, 'Custom order paid', 'Payment received. We will start production soon.');
  end if;

  return jsonb_build_object('status', 'fulfilled', 'payment_id', pay.id, 'purpose', pay.purpose);
end $$;
revoke execute on function public.fulfill_payment(text, text, text) from public, anon, authenticated;
grant execute on function public.fulfill_payment(text, text, text) to service_role;

-- failed payment marker (SERVICE ONLY)
create or replace function public.mark_payment_failed(p_razorpay_order_id text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.payments set status = 'failed', failure_reason = p_reason
  where razorpay_order_id = p_razorpay_order_id and not fulfilled;
  update public.orders set status = 'failed'
  where id in (select order_id from public.payments where razorpay_order_id = p_razorpay_order_id and not fulfilled)
    and status = 'pending_payment';
end $$;
revoke execute on function public.mark_payment_failed(text, text) from public, anon, authenticated;
grant execute on function public.mark_payment_failed(text, text) to service_role;

-- refund recording (SERVICE ONLY)
create or replace function public.apply_refund(p_razorpay_payment_id text, p_refund_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
declare pay public.payments; total numeric(12,2);
begin
  select * into pay from public.payments where razorpay_payment_id = p_razorpay_payment_id for update;
  if not found then return; end if;
  total := least(pay.amount, greatest(pay.refunded_amount, p_refund_amount));  -- Razorpay sends cumulative amount
  update public.payments set refunded_amount = total,
    status = case when total >= amount then 'refunded' else 'partially_refunded' end
  where id = pay.id;
  if total >= pay.amount then
    if pay.order_id is not null then update public.orders set status = 'refunded' where id = pay.order_id; end if;
    if pay.membership_id is not null then
      update public.memberships set status = 'cancelled' where id = pay.membership_id;
      insert into public.membership_transactions (membership_id, user_id, kind, amount)
      values (pay.membership_id, pay.user_id, 'cancellation', -pay.amount);
    end if;
  end if;
end $$;
revoke execute on function public.apply_refund(text, numeric) from public, anon, authenticated;
grant execute on function public.apply_refund(text, numeric) to service_role;

-- ---------- admin analytics ----------
create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_revenue', coalesce((select sum(total) from public.orders where status in ('paid','processing','shipped','delivered')), 0),
    'total_orders', (select count(*) from public.orders where status not in ('pending_payment','failed')),
    'total_customers', (select count(*) from public.profiles p where not exists (select 1 from public.user_roles r where r.user_id = p.id)),
    'active_memberships', (select count(*) from public.memberships where status = 'active' and (expires_at is null or expires_at > now())),
    'expired_memberships', (select count(*) from public.memberships where status = 'expired' or (status = 'active' and expires_at <= now())),
    'membership_revenue', coalesce((select sum(amount) from public.payments where purpose in ('membership_purchase','membership_renewal') and status in ('paid','partially_refunded')), 0),
    'pending_custom_requests', (select count(*) from public.custom_design_requests where status in ('submitted','under_review')),
    'best_sellers', coalesce((select jsonb_agg(x) from (
        select oi.product_name as name, sum(oi.quantity)::int as units
        from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.status in ('paid','processing','shipped','delivered')
        group by oi.product_name order by units desc limit 5) x), '[]'::jsonb),
    'low_stock', coalesce((select jsonb_agg(x) from (
        select p.name, v.size, v.color, v.stock
        from public.product_variants v join public.products p on p.id = v.product_id
        where v.is_active and v.stock <= v.low_stock_threshold order by v.stock limit 10) x), '[]'::jsonb),
    'recent_orders', coalesce((select jsonb_agg(x) from (
        select id, order_number, status, total, created_at from public.orders
        where status <> 'pending_payment' order by created_at desc limit 8) x), '[]'::jsonb)
  );
end $$;

-- ---------- audit logging ----------
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if tg_op = 'DELETE' then d := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'INSERT' then d := jsonb_build_object('new', to_jsonb(new));
  else d := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)); end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), tg_op, tg_table_name, coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id')), d);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['products','product_variants','categories','membership_plans','memberships','orders',
    'coupons','user_roles','shipments','custom_design_requests','custom_design_quotes','site_settings']
  loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- site_settings has no id column: give audit trigger a safe path
-- (to_jsonb(new)->>'id' is simply null for it)

-- ---------- scheduled expiry (optional; pricing never depends on it) ----------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-memberships', '*/15 * * * *', $c$select public.expire_memberships()$c$);
exception when others then
  raise notice 'pg_cron not enabled; expiry is still enforced at read time by is_active_member()';
end $$;
