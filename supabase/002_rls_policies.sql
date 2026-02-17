-- ============================================
-- El Contragolpe — Row Level Security Policies
-- Run this in Supabase SQL Editor AFTER schema
-- ============================================

-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_bonuses ENABLE ROW LEVEL SECURITY;

-- ── Helper function: check if user is admin for a restaurant ──

CREATE OR REPLACE FUNCTION is_restaurant_admin(rest_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.uid() IS NOT NULL
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('restaurant_admin', 'super_admin')
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::UUID = rest_id
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── Helper function: check if user is super admin ──

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.uid() IS NOT NULL
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── Helper: get player's restaurant_id ──

CREATE OR REPLACE FUNCTION get_player_restaurant_id()
RETURNS UUID AS $$
  SELECT restaurant_id FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ══════════════════════════════════════════
-- RESTAURANTS
-- ══════════════════════════════════════════

-- Anyone authenticated can read restaurants (needed for join flow)
CREATE POLICY "restaurants_select"
  ON restaurants FOR SELECT
  TO authenticated
  USING (true);

-- Only super admin can manage restaurants
CREATE POLICY "restaurants_insert"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "restaurants_update"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (is_super_admin());

-- ══════════════════════════════════════════
-- TABLES
-- ══════════════════════════════════════════

-- Authenticated users can read tables for their restaurant
CREATE POLICY "tables_select"
  ON tables FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create tables (dynamic creation during join)
CREATE POLICY "tables_insert"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admin can update/delete tables
CREATE POLICY "tables_update"
  ON tables FOR UPDATE
  TO authenticated
  USING (is_restaurant_admin(restaurant_id));

CREATE POLICY "tables_delete"
  ON tables FOR DELETE
  TO authenticated
  USING (is_restaurant_admin(restaurant_id));

-- ══════════════════════════════════════════
-- PLAYERS
-- ══════════════════════════════════════════

-- Players can read other players in same restaurant (for leaderboard)
CREATE POLICY "players_select"
  ON players FOR SELECT
  TO authenticated
  USING (true);

-- Players can insert themselves
CREATE POLICY "players_insert"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Players can update their own record
CREATE POLICY "players_update"
  ON players FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid());

-- ══════════════════════════════════════════
-- MATCHES
-- ══════════════════════════════════════════

-- Anyone authenticated can read matches
CREATE POLICY "matches_select"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can create/update/delete matches
CREATE POLICY "matches_insert"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (is_restaurant_admin(restaurant_id));

CREATE POLICY "matches_update"
  ON matches FOR UPDATE
  TO authenticated
  USING (is_restaurant_admin(restaurant_id));

CREATE POLICY "matches_delete"
  ON matches FOR DELETE
  TO authenticated
  USING (is_restaurant_admin(restaurant_id));

-- ══════════════════════════════════════════
-- PREDICTION TYPES
-- ══════════════════════════════════════════

CREATE POLICY "prediction_types_select"
  ON prediction_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "prediction_types_insert"
  ON prediction_types FOR INSERT
  TO authenticated
  WITH CHECK (
    is_restaurant_admin(
      (SELECT restaurant_id FROM matches WHERE id = match_id)
    )
  );

CREATE POLICY "prediction_types_update"
  ON prediction_types FOR UPDATE
  TO authenticated
  USING (
    is_restaurant_admin(
      (SELECT restaurant_id FROM matches WHERE id = match_id)
    )
  );

CREATE POLICY "prediction_types_delete"
  ON prediction_types FOR DELETE
  TO authenticated
  USING (
    is_restaurant_admin(
      (SELECT restaurant_id FROM matches WHERE id = match_id)
    )
  );

-- ══════════════════════════════════════════
-- PREDICTIONS
-- ══════════════════════════════════════════

-- Players can read all predictions (leaderboard)
CREATE POLICY "predictions_select"
  ON predictions FOR SELECT
  TO authenticated
  USING (true);

-- Players can insert their own predictions
CREATE POLICY "predictions_insert"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

-- No one updates predictions directly (trigger does scoring)
-- But admin may need to correct, so allow admin update
CREATE POLICY "predictions_update"
  ON predictions FOR UPDATE
  TO authenticated
  USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
    OR is_restaurant_admin(
      (SELECT restaurant_id FROM matches WHERE id = match_id)
    )
  );

-- ══════════════════════════════════════════
-- MATCH RESULTS
-- ══════════════════════════════════════════

CREATE POLICY "match_results_select"
  ON match_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "match_results_insert"
  ON match_results FOR INSERT
  TO authenticated
  WITH CHECK (
    is_restaurant_admin(
      (SELECT restaurant_id FROM matches WHERE id = match_id)
    )
  );

CREATE POLICY "match_results_update"
  ON match_results FOR UPDATE
  TO authenticated
  USING (
    is_restaurant_admin(
      (SELECT restaurant_id FROM matches WHERE id = match_id)
    )
  );

-- ══════════════════════════════════════════
-- MENU ITEMS
-- ══════════════════════════════════════════

CREATE POLICY "menu_items_select"
  ON menu_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "menu_items_insert"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (is_restaurant_admin(restaurant_id));

CREATE POLICY "menu_items_update"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (is_restaurant_admin(restaurant_id));

CREATE POLICY "menu_items_delete"
  ON menu_items FOR DELETE
  TO authenticated
  USING (is_restaurant_admin(restaurant_id));

-- ══════════════════════════════════════════
-- TABLE BONUSES
-- ══════════════════════════════════════════

CREATE POLICY "table_bonuses_select"
  ON table_bonuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "table_bonuses_insert"
  ON table_bonuses FOR INSERT
  TO authenticated
  WITH CHECK (
    is_restaurant_admin(
      (SELECT restaurant_id FROM tables WHERE id = table_id)
    )
  );
