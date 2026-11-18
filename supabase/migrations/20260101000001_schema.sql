-- BLACK WOLF — core schema
-- Supabase installs PostgreSQL extensions in the `extensions` schema.
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;
set search_path to public, extensions;

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- roles / profiles ----------
create type public.app_role as enum ('super_admin','admin','staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- ---------- catalog ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  regular_price numeric(12,2) not null check (regular_price >= 0),
  member_price numeric(12,2) check (member_price >= 0),
  is_featured boolean not null default false,
  is_new_arrival boolean not null default false,
  is_exclusive boolean not null default false,
  is_customizable boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_price is null or member_price <= regular_price)
);
create index products_category_idx on public.products(category_id);
create index products_status_idx on public.products(status);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  size text not null,
  color text not null,
  price_override numeric(12,2) check (price_override >= 0),
  member_price_override numeric(12,2) check (member_price_override >= 0),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index product_variants_product_idx on public.product_variants(product_id);

-- ---------- membership ----------
create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  duration int check (duration > 0),
  duration_unit text not null check (duration_unit in ('days','months','years','lifetime')),
  benefits jsonb not null default '[]'::jsonb,
  status text not null default 'inactive' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((duration_unit = 'lifetime' and duration is null) or (duration_unit <> 'lifetime' and duration is not null))
);

create sequence public.membership_number_seq start 100001;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id),
  membership_number text unique,
  status text not null default 'pending' check (status in ('pending','active','expired','suspended','cancelled')),
  plan_snapshot jsonb not null,
  starts_at timestamptz,
  expires_at timestamptz,            -- null + active = lifetime
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memberships_user_idx on public.memberships(user_id);
create index memberships_status_idx on public.memberships(status);

create table public.membership_cards (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null unique references public.memberships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verification_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  issued_at timestamptz not null default now()
);

-- ---------- addresses / cart ----------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'IN',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses(user_id);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0 and quantity <= 20),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ---------- coupons ----------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order_amount numeric(12,2) not null default 0,
  max_uses int,
  used_count int not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- custom designs ----------
create table public.custom_design_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  clothing_type text not null,
  size text not null,
  color text not null,
  quantity int not null default 1 check (quantity > 0),
  instructions text,
  status text not null default 'submitted' check (status in
    ('submitted','under_review','approved','rejected','quotation_sent','accepted','paid','in_production','completed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cdr_user_idx on public.custom_design_requests(user_id);
create index cdr_status_idx on public.custom_design_requests(status);

create table public.custom_design_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_design_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create table public.custom_design_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_design_requests(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  status text not null default 'sent' check (status in ('sent','accepted','declined','paid','expired')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index cdq_request_idx on public.custom_design_quotes(request_id);

create table public.design_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.admin_designs (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references public.design_collections(id) on delete set null,
  name text not null,
  storage_path text not null,
  extra_price numeric(12,2) not null default 0 check (extra_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_designs (
  product_id uuid not null references public.products(id) on delete cascade,
  design_id uuid not null references public.admin_designs(id) on delete cascade,
  primary key (product_id, design_id)
);

-- ---------- orders / payments ----------
create sequence public.order_number_seq start 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('BW-' || nextval('public.order_number_seq')),
  user_id uuid not null references public.profiles(id),
  order_type text not null default 'product' check (order_type in ('product','custom')),
  custom_request_id uuid references public.custom_design_requests(id),
  status text not null default 'pending_payment' check (status in
    ('pending_payment','paid','processing','shipped','delivered','cancelled','refunded','failed')),
  is_member_pricing boolean not null default false,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  shipping_total numeric(12,2) not null default 0 check (shipping_total >= 0),
  total numeric(12,2) not null check (total >= 0),
  coupon_id uuid references public.coupons(id),
  shipping_address jsonb not null,
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id);
create index orders_status_idx on public.orders(status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  size text not null,
  color text not null,
  image_path text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  purpose text not null check (purpose in ('product_order','membership_purchase','membership_renewal','custom_order')),
  order_id uuid references public.orders(id),
  membership_id uuid references public.memberships(id),
  custom_quote_id uuid references public.custom_design_quotes(id),
  plan_id uuid references public.membership_plans(id),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','paid','failed','refunded','partially_refunded')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  razorpay_signature text,
  refunded_amount numeric(12,2) not null default 0,
  fulfilled boolean not null default false,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments(user_id);

create table public.membership_transactions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  payment_id uuid unique references public.payments(id),
  kind text not null check (kind in ('purchase','renewal','suspension','cancellation','expiry','reactivation')),
  amount numeric(12,2) not null default 0,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------- shipping / inventory ----------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier_name text,
  tracking_number text,
  tracking_url text,
  status text not null default 'pending' check (status in ('pending','packed','shipped','in_transit','out_for_delivery','delivered','returned')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  change int not null,
  reason text not null,
  order_id uuid references public.orders(id),
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_logs_variant_idx on public.inventory_logs(variant_id);

-- ---------- misc ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  quote text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','product_variants','membership_plans','memberships',
    'addresses','carts','custom_design_requests','orders','payments','shipments']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
