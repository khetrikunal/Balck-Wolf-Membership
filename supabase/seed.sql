-- BLACK WOLF seed data (starter catalogue; editable from the admin dashboard)
insert into public.categories (name, slug, sort_order) values
  ('T-shirts', 't-shirts', 1),
  ('Track Pants', 'track-pants', 2),
  ('Custom Designs', 'custom-designs', 3),
  ('New Arrivals', 'new-arrivals', 4),
  ('Exclusive Collections', 'exclusive-collections', 5)
on conflict (slug) do nothing;

insert into public.membership_plans (name, description, price, duration, duration_unit, benefits, status) values
  ('Wolf Pack — 6 Months', 'Member pricing on every product for six months.', 499, 6, 'months',
   '["Exclusive member prices","Early access to drops","Digital membership card"]', 'active'),
  ('Alpha — 1 Year', 'A full year of member pricing and priority perks.', 799, 1, 'years',
   '["Exclusive member prices","Early access to drops","Priority support","Digital membership card"]', 'active'),
  ('Black Wolf Lifetime', 'One payment. Member pricing forever.', 1999, null, 'lifetime',
   '["Lifetime member prices","First access to limited collections","Priority support","Digital membership card"]', 'active')
on conflict do nothing;

insert into public.site_settings (key, value) values
  ('shipping', '{"flat_rate": 80, "free_above": 1999}'),
  ('contact', '{"email": "support@blackwolf.example", "phone": "", "address": ""}'),
  ('hero', '{"headline": "BLACK WOLF", "subheadline": "Premium streetwear. Made to stand apart."}')
on conflict (key) do nothing;

-- Products, prices, sizes and images are intentionally NOT seeded:
-- add them in Admin → Products so nothing is hardcoded.

-- First super admin (run AFTER the owner has registered through the site):
-- insert into public.user_roles (user_id, role)
-- select id, 'super_admin' from auth.users where email = 'owner@example.com';
