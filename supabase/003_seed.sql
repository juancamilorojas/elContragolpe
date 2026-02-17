-- ============================================
-- El Contragolpe — Seed Data
-- Run after schema + policies to set up a demo restaurant
-- ============================================

-- Create a demo restaurant
INSERT INTO restaurants (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'El Contragolpe Demo',
  'demo'
);

-- Create some sample tables
INSERT INTO tables (restaurant_id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Terraza 1'),
  ('00000000-0000-0000-0000-000000000001', 'Terraza 2'),
  ('00000000-0000-0000-0000-000000000001', 'Barra'),
  ('00000000-0000-0000-0000-000000000001', 'Mesa Roja'),
  ('00000000-0000-0000-0000-000000000001', 'VIP');

-- Create sample menu items (for bonus triggers)
INSERT INTO menu_items (restaurant_id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Nachos Especiales', 'Nachos with guacamole and jalapeños'),
  ('00000000-0000-0000-0000-000000000001', 'Jarra de Cerveza', 'Pitcher of draft beer'),
  ('00000000-0000-0000-0000-000000000001', 'Alitas BBQ', 'BBQ chicken wings x12');

-- NOTE: To make a user a restaurant admin, run:
-- UPDATE auth.users
-- SET raw_app_meta_data = jsonb_set(
--   COALESCE(raw_app_meta_data, '{}'::jsonb),
--   '{role}', '"restaurant_admin"'
-- ) || jsonb_build_object('restaurant_id', '00000000-0000-0000-0000-000000000001')
-- WHERE email = 'admin@example.com';
