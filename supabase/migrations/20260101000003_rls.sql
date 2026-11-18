-- BLACK WOLF — Row Level Security + Storage policies
-- Roles: staff (operations), admin (catalog/config), super_admin (roles, everything)

do $$
declare t text;
begin
  foreach t in array array['profiles','user_roles','categories','products','product_images','product_variants',
    'membership_plans','memberships','membership_cards','membership_transactions','addresses','carts','cart_items',
    'wishlist_items','coupons','custom_design_requests','custom_design_files','custom_design_quotes',
    'design_collections','admin_designs','product_designs','orders','order_items','payments',
    'payment_webhook_events','shipments','inventory_logs','notifications','audit_logs','site_settings',
    'newsletter_subscribers','contact_messages','testimonials','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- user_roles (only super_admin can grant; users can read their own)
create policy roles_select on public.user_roles for select using (user_id = auth.uid() or public.is_super_admin());
create policy roles_write on public.user_roles for all using (public.is_super_admin()) with check (public.is_super_admin());

-- catalog (public read of active items; admin write)
create policy categories_read on public.categories for select using (is_active or public.is_staff());
create policy categories_write on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select using (status = 'active' or public.is_staff());
create policy products_write on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy product_images_read on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or public.is_staff())));
create policy product_images_write on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy variants_read on public.product_variants for select using (
  (is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')) or public.is_staff());
create policy variants_write on public.product_variants for all using (public.is_admin()) with check (public.is_admin());
-- staff may adjust stock through inventory screens
create policy variants_staff_stock on public.product_variants for update using (public.is_staff()) with check (public.is_staff());

-- memberships
create policy plans_read on public.membership_plans for select using (status = 'active' or public.is_staff());
create policy plans_write on public.membership_plans for all using (public.is_admin()) with check (public.is_admin());

create policy memberships_select on public.memberships for select using (user_id = auth.uid() or public.is_staff());
create policy memberships_admin_update on public.memberships for update using (public.is_admin()) with check (public.is_admin());

create policy cards_select on public.membership_cards for select using (user_id = auth.uid() or public.is_staff());
create policy mtx_select on public.membership_transactions for select using (user_id = auth.uid() or public.is_staff());

-- addresses / cart / wishlist
create policy addresses_own on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy carts_own on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy wishlist_own on public.wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- coupons: admin only (validated server-side at checkout)
create policy coupons_admin on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- custom design
create policy cdr_select on public.custom_design_requests for select using (user_id = auth.uid() or public.is_staff());
create policy cdr_insert on public.custom_design_requests for insert
  with check (user_id = auth.uid() and status = 'submitted' and admin_notes is null);
create policy cdr_staff_update on public.custom_design_requests for update using (public.is_staff()) with check (public.is_staff());

create policy cdf_select on public.custom_design_files for select using (user_id = auth.uid() or public.is_staff());
create policy cdf_insert on public.custom_design_files for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.custom_design_requests r where r.id = request_id and r.user_id = auth.uid())
  and storage_path like auth.uid()::text || '/%');

create policy cdq_select on public.custom_design_quotes for select using (
  public.is_staff() or exists (select 1 from public.custom_design_requests r where r.id = request_id and r.user_id = auth.uid()));
-- quotes are created via send_quote() and accepted via accept_quote(); no direct writes

create policy collections_read on public.design_collections for select using (is_active or public.is_staff());
create policy collections_write on public.design_collections for all using (public.is_admin()) with check (public.is_admin());
create policy admin_designs_read on public.admin_designs for select using (is_active or public.is_staff());
create policy admin_designs_write on public.admin_designs for all using (public.is_admin()) with check (public.is_admin());
create policy product_designs_read on public.product_designs for select using (true);
create policy product_designs_write on public.product_designs for all using (public.is_admin()) with check (public.is_admin());

-- orders / payments (no client inserts: Edge Functions only)
create policy orders_select on public.orders for select using (user_id = auth.uid() or public.is_staff());
create policy orders_staff_update on public.orders for update using (public.is_staff()) with check (public.is_staff());
create policy order_items_select on public.order_items for select using (
  public.is_staff() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

create policy payments_select on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy webhook_events_admin on public.payment_webhook_events for select using (public.is_admin());

-- shipping / inventory
create policy shipments_select on public.shipments for select using (
  public.is_staff() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy shipments_staff_write on public.shipments for all using (public.is_staff()) with check (public.is_staff());
create policy inventory_logs_staff on public.inventory_logs for select using (public.is_staff());
create policy inventory_logs_insert on public.inventory_logs for insert with check (public.is_staff());

-- notifications
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());

-- audit logs: read only for admins; written by trigger
create policy audit_select on public.audit_logs for select using (public.is_admin());

-- site content
create policy settings_read on public.site_settings for select using (true);
create policy settings_write on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy testimonials_read on public.testimonials for select using (is_active or public.is_staff());
create policy testimonials_write on public.testimonials for all using (public.is_admin()) with check (public.is_admin());
create policy newsletter_insert on public.newsletter_subscribers for insert with check (true);
create policy newsletter_admin on public.newsletter_subscribers for select using (public.is_admin());
create policy contact_insert on public.contact_messages for insert with check (true);
create policy contact_staff on public.contact_messages for select using (public.is_staff());
-- rate_limits: RLS on with no policies = no client access

-- ---------- column-level hardening ----------
-- Clients must not be able to touch server-managed columns.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('admin-designs', 'admin-designs', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('custom-designs', 'custom-designs', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "public read product images" on storage.objects for select using (bucket_id = 'product-images');
create policy "admin write product images" on storage.objects for all
  using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());

create policy "public read admin designs" on storage.objects for select using (bucket_id = 'admin-designs');
create policy "admin write admin designs" on storage.objects for all
  using (bucket_id = 'admin-designs' and public.is_admin()) with check (bucket_id = 'admin-designs' and public.is_admin());

-- private customer uploads: path must be <user_id>/<request_id>/<file>
create policy "customer upload own designs" on storage.objects for insert to authenticated
  with check (bucket_id = 'custom-designs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "customer read own designs" on storage.objects for select to authenticated
  using (bucket_id = 'custom-designs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
create policy "customer delete own designs" on storage.objects for delete to authenticated
  using (bucket_id = 'custom-designs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- grants for RPCs the browser may call ----------
grant execute on function public.verify_membership_token(text) to anon, authenticated;
grant execute on function public.my_pricing_tier() to authenticated;
grant execute on function public.my_roles() to authenticated;
grant execute on function public.accept_quote(uuid) to authenticated;
grant execute on function public.send_quote(uuid, numeric, text) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
revoke execute on function public.expire_memberships() from public, anon, authenticated;
grant execute on function public.expire_memberships() to service_role;
