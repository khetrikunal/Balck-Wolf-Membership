-- Secure membership administration: source attribution, assignment history and paged overview.
alter table public.memberships
  add column if not exists source text not null default 'purchase'
    check (source in ('purchase','admin')),
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null;

alter table public.membership_transactions
  drop constraint if exists membership_transactions_kind_check;
alter table public.membership_transactions
  add constraint membership_transactions_kind_check check (kind in (
    'purchase','renewal','suspension','cancellation','expiry','reactivation',
    'admin_assignment','admin_extension','plan_change','admin_revocation'
  ));

create or replace function public.expire_memberships() returns int
language plpgsql security definer set search_path = public as $$
declare v_membership record; v_count int := 0;
begin
  for v_membership in
    update public.memberships set status='expired'
      where status='active' and expires_at is not null and expires_at<=now()
      returning id,user_id,starts_at,expires_at,plan_snapshot
  loop
    insert into public.membership_transactions(membership_id,user_id,kind,period_start,period_end)
      values(v_membership.id,v_membership.user_id,'expiry',v_membership.starts_at,v_membership.expires_at);
    perform public.notify(v_membership.user_id,'Membership expired',
      'Your ' || coalesce(v_membership.plan_snapshot->>'name','membership') || ' has expired. View available plans to renew and restore your member benefits.');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.admin_assign_membership(
  p_user_id uuid,
  p_plan_id uuid,
  p_starts_at timestamptz default now(),
  p_expires_at timestamptz default null,
  p_extend boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.membership_plans;
  v_membership public.memberships;
  v_start timestamptz := coalesce(p_starts_at, now());
  v_expiry timestamptz;
  v_kind text := 'admin_assignment';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'user_not_found'; end if;
  select * into v_plan from public.membership_plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found'; end if;

  if p_expires_at is not null then
    if p_expires_at <= greatest(v_start,now()) then raise exception 'expiry_must_follow_start'; end if;
    v_expiry := p_expires_at;
  elsif v_plan.duration_unit = 'lifetime' then
    v_expiry := null;
  else
    v_expiry := v_start + case v_plan.duration_unit
      when 'days' then make_interval(days => v_plan.duration)
      when 'months' then make_interval(months => v_plan.duration)
      when 'years' then make_interval(years => v_plan.duration)
      else make_interval(months => v_plan.duration)
    end;
  end if;

  if not p_extend and v_start <= now() and exists (
    select 1 from public.memberships m where m.user_id=p_user_id and m.status='active'
      and (m.starts_at is null or m.starts_at<=now()) and (m.expires_at is null or m.expires_at>now())
  ) then raise exception 'active_membership_exists'; end if;

  if p_extend then
    select * into v_membership from public.memberships
      where user_id = p_user_id and status = 'active'
        and (expires_at is null or expires_at > now())
      order by created_at desc limit 1 for update;
  end if;

  if found and p_extend then
    if v_membership.expires_at is null and v_plan.duration_unit = 'lifetime' and p_expires_at is null then
      v_expiry := null;
    elsif v_membership.expires_at is null and p_expires_at is null then
      v_expiry := v_start + case v_plan.duration_unit
        when 'days' then make_interval(days => v_plan.duration)
        when 'months' then make_interval(months => v_plan.duration)
        when 'years' then make_interval(years => v_plan.duration)
        else make_interval(months => v_plan.duration)
      end;
    elsif p_expires_at is null and v_plan.duration_unit <> 'lifetime' then
      v_expiry := greatest(v_membership.expires_at, v_start) + case v_plan.duration_unit
        when 'days' then make_interval(days => v_plan.duration)
        when 'months' then make_interval(months => v_plan.duration)
        when 'years' then make_interval(years => v_plan.duration)
        else make_interval(months => v_plan.duration)
      end;
    end if;
    v_start := coalesce(v_membership.starts_at, v_start);
    v_kind := case when v_membership.plan_id = p_plan_id then 'admin_extension' else 'plan_change' end;
    update public.memberships set plan_id = p_plan_id, plan_snapshot = to_jsonb(v_plan),
      source = 'admin', assigned_by = auth.uid(), starts_at = v_start, expires_at = v_expiry,
      status = case when v_start <= now() then 'active' else 'pending' end
      where id = v_membership.id returning * into v_membership;
  else
    insert into public.memberships(user_id,plan_id,status,plan_snapshot,starts_at,expires_at,source,assigned_by)
      values(p_user_id,p_plan_id,case when v_start <= now() then 'active' else 'pending' end,
        to_jsonb(v_plan),v_start,v_expiry,'admin',auth.uid()) returning * into v_membership;
  end if;

  if v_membership.status = 'active' then
    update public.memberships set membership_number = coalesce(membership_number,
      'BW-M-' || nextval('public.membership_number_seq')) where id = v_membership.id returning * into v_membership;
    insert into public.membership_cards(membership_id,user_id) values(v_membership.id,p_user_id)
      on conflict (membership_id) do nothing;
  end if;

  insert into public.membership_transactions(membership_id,user_id,kind,amount,period_start,period_end)
    values(v_membership.id,p_user_id,v_kind,0,v_start,v_expiry);
  perform public.notify(p_user_id,
    case when v_kind = 'admin_extension' then 'Membership extended' else 'Membership assigned' end,
    'Your ' || v_plan.name || ' membership was ' || case when v_kind = 'admin_extension' then 'extended.' else 'assigned by the Black Wolf team.' end);
  return v_membership.id;
end $$;

create or replace function public.admin_set_membership_status(p_membership_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_membership public.memberships;
declare v_kind text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('active','suspended','cancelled') then raise exception 'invalid_status'; end if;
  select * into v_membership from public.memberships where id = p_membership_id for update;
  if not found then raise exception 'membership_not_found'; end if;
  v_kind := case
    when p_status = 'cancelled' then 'admin_revocation'
    when p_status = 'suspended' then 'suspension'
    else 'reactivation' end;
  update public.memberships set status = p_status,
    membership_number = case when p_status = 'active' then coalesce(membership_number,'BW-M-' || nextval('public.membership_number_seq')) else membership_number end
    where id = p_membership_id returning * into v_membership;
  if p_status = 'active' then
    insert into public.membership_cards(membership_id,user_id) values(v_membership.id,v_membership.user_id)
      on conflict (membership_id) do nothing;
  end if;
  insert into public.membership_transactions(membership_id,user_id,kind,amount,period_start,period_end)
    values(v_membership.id,v_membership.user_id,v_kind,0,v_membership.starts_at,v_membership.expires_at);
  perform public.notify(v_membership.user_id,
    case when p_status = 'cancelled' then 'Membership cancelled' when p_status = 'suspended' then 'Membership suspended' else 'Membership reinstated' end,
    'Your ' || v_membership.plan_snapshot->>'name' || ' membership status was updated by the Black Wolf team.');
end $$;

create or replace function public.admin_membership_overview(
  p_search text default '', p_status text default 'all', p_plan_id uuid default null,
  p_purchase_from date default null, p_purchase_to date default null,
  p_expiry_from date default null, p_expiry_to date default null,
  p_sort text default 'newest', p_limit int default 25, p_offset int default 0
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  with latest as (
    select distinct on (m.user_id) m.*
    from public.memberships m
    order by m.user_id,m.created_at desc
  ), all_users as (
    select p.id,p.full_name,p.email,p.phone,p.created_at as joined_at,
      l.id as membership_id,l.plan_id,l.plan_snapshot,l.status as raw_status,l.starts_at,l.expires_at,
      l.created_at as purchased_at,l.source,l.assigned_by,l.membership_number,
      case when l.id is null then 'not_subscribed'
        when l.status = 'active' and l.expires_at is not null and l.expires_at <= now() then 'expired'
        else l.status end as current_status,
      pay.status as payment_status,pay.razorpay_payment_id as transaction_id
    from public.profiles p
    left join latest l on l.user_id = p.id
    left join lateral (
      select x.status,x.razorpay_payment_id from public.payments x
      where x.user_id = p.id and x.purpose in ('membership_purchase','membership_renewal')
      order by x.created_at desc limit 1
    ) pay on true
  ), filtered as (
    select * from all_users u where
      (coalesce(p_search,'') = '' or u.id::text ilike '%'||p_search||'%' or coalesce(u.full_name,'') ilike '%'||p_search||'%' or coalesce(u.email,'') ilike '%'||p_search||'%') and
      (coalesce(p_status,'all') = 'all' or u.current_status = p_status) and
      (p_plan_id is null or u.plan_id = p_plan_id) and
      (p_purchase_from is null or u.purchased_at::date >= p_purchase_from) and
      (p_purchase_to is null or u.purchased_at::date <= p_purchase_to) and
      (p_expiry_from is null or u.expires_at::date >= p_expiry_from) and
      (p_expiry_to is null or u.expires_at::date <= p_expiry_to)
  )
  select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((
    select jsonb_agg(to_jsonb(page) order by page.joined_at desc) from (
      select * from filtered order by
        case when p_sort='name_asc' then lower(coalesce(full_name,'')) end asc nulls last,
        case when p_sort='expiry_asc' then expires_at end asc nulls last,
        case when p_sort='purchase_desc' then purchased_at end desc nulls last,
        joined_at desc
      limit greatest(1,least(p_limit,100)) offset greatest(0,p_offset)
    ) page
  ),'[]'::jsonb)) into result;
  return result;
end $$;

create or replace function public.admin_search_membership_users(p_search text)
returns table(id uuid,full_name text,email text,phone text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select p.id,p.full_name,p.email,p.phone from public.profiles p
    where (coalesce(p_search,'') = '' or p.id::text ilike '%'||p_search||'%' or coalesce(p.full_name,'') ilike '%'||p_search||'%' or coalesce(p.email,'') ilike '%'||p_search||'%')
    order by p.full_name nulls last,p.email limit 25;
end $$;

create or replace function public.admin_membership_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'registered_users',(select count(*) from public.profiles),
    'active_members',(select count(distinct user_id) from public.memberships where status='active' and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now())),
    'expired_memberships',(select count(*) from public.memberships where status='expired' or (status='active' and expires_at<=now())),
    'pending_memberships',(select count(*) from public.memberships where status='pending'),
    'membership_revenue',coalesce((select sum(amount-refunded_amount) from public.payments where purpose in ('membership_purchase','membership_renewal') and status in ('paid','partially_refunded')),0),
    'plan_distribution',coalesce((select jsonb_agg(jsonb_build_object('plan',x.name,'members',x.members)) from (select p.name,count(m.id)::int members from public.membership_plans p left join public.memberships m on m.plan_id=p.id and m.status='active' and (m.expires_at is null or m.expires_at>now()) group by p.id,p.name order by p.name) x),'[]'::jsonb)
  );
end $$;

create table if not exists public.membership_expiry_reminders (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  reminder_days int not null check (reminder_days > 0),
  sent_at timestamptz not null default now(),
  primary key (membership_id, reminder_days)
);
alter table public.membership_expiry_reminders enable row level security;

create or replace function public.notify_membership_expiring()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with due as (
    select m.id,m.user_id,m.expires_at,m.plan_snapshot->>'name' as plan_name
    from public.memberships m
    where m.status='active' and m.expires_at > now() and m.expires_at <= now() + interval '7 days'
      and not exists(select 1 from public.membership_expiry_reminders r where r.membership_id=m.id and r.reminder_days=7)
  ), logged as (
    insert into public.membership_expiry_reminders(membership_id,reminder_days)
    select id,7 from due on conflict do nothing returning membership_id
  ), notices as (
    insert into public.notifications(user_id,title,body)
    select d.user_id,'Membership expiring soon',coalesce(d.plan_name,'Your') || ' membership expires on ' || to_char(d.expires_at at time zone 'UTC','DD Mon YYYY') || '. Renew to keep your member benefits.'
    from due d join logged l on l.membership_id=d.id returning 1
  ) select count(*) into v_count from notices;
  return v_count;
end $$;

revoke all on function public.notify_membership_expiring() from public,anon,authenticated;

revoke all on function public.admin_assign_membership(uuid,uuid,timestamptz,timestamptz,boolean) from public,anon;
grant execute on function public.admin_assign_membership(uuid,uuid,timestamptz,timestamptz,boolean) to authenticated;
revoke all on function public.admin_set_membership_status(uuid,text) from public,anon;
grant execute on function public.admin_set_membership_status(uuid,text) to authenticated;
revoke all on function public.admin_membership_overview(text,text,uuid,date,date,date,date,text,int,int) from public,anon;
grant execute on function public.admin_membership_overview(text,text,uuid,date,date,date,date,text,int,int) to authenticated;
revoke all on function public.admin_search_membership_users(text) from public,anon;
grant execute on function public.admin_search_membership_users(text) to authenticated;
revoke all on function public.admin_membership_stats() from public,anon;
grant execute on function public.admin_membership_stats() to authenticated;

do $$ begin
  perform cron.schedule('membership-expiry-reminders','0 9 * * *',$c$select public.notify_membership_expiring()$c$);
exception when others then
  raise notice 'pg_cron is unavailable; expiry notifications will require a scheduled invocation.';
end $$;
