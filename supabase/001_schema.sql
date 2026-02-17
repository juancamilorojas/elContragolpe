-- ============================================
-- El Contragolpe — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ── Extensions ──────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tables ──────────────────────────────

-- 1. Restaurants
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurants_slug ON restaurants (slug);

-- 2. Tables (restaurant tables, NOT database tables)
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE INDEX idx_tables_restaurant_name ON tables (restaurant_id, name);
CREATE INDEX idx_tables_restaurant_active ON tables (restaurant_id, is_active);

-- 3. Matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'live', 'finished', 'archived')),
  kick_off TIMESTAMPTZ,
  final_score JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_restaurant_status ON matches (restaurant_id, status);

-- 4. Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  active_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_auth ON players (auth_user_id);
CREATE INDEX idx_players_match ON players (active_match_id);
CREATE INDEX idx_players_table ON players (table_id);
CREATE INDEX idx_players_restaurant ON players (restaurant_id);

-- 5. Prediction Types
CREATE TABLE prediction_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  points_value INT NOT NULL DEFAULT 1,
  is_bonus BOOLEAN NOT NULL DEFAULT false,
  required_menu_item_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prediction_types_match ON prediction_types (match_id, sort_order);

-- 6. Predictions
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  prediction_type_id UUID NOT NULL REFERENCES prediction_types(id) ON DELETE CASCADE,
  predicted_value TEXT NOT NULL,
  is_correct BOOLEAN,
  points_earned INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, match_id, prediction_type_id)
);

CREATE INDEX idx_predictions_match_player ON predictions (match_id, player_id);
CREATE INDEX idx_predictions_scoring ON predictions (match_id, is_correct);

-- 7. Match Results
CREATE TABLE match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  prediction_type_id UUID NOT NULL REFERENCES prediction_types(id) ON DELETE CASCADE,
  actual_value TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, prediction_type_id)
);

CREATE INDEX idx_match_results_match ON match_results (match_id);

-- 8. Menu Items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_restaurant ON menu_items (restaurant_id, is_active);

-- Add FK now that menu_items exists
ALTER TABLE prediction_types
  ADD CONSTRAINT fk_prediction_types_menu_item
  FOREIGN KEY (required_menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;

-- 9. Table Bonuses
CREATE TABLE table_bonuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  activated_by UUID NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (table_id, match_id, menu_item_id)
);

CREATE INDEX idx_table_bonuses_table_match ON table_bonuses (table_id, match_id);

-- ── Scoring Function ────────────────────
-- Called when admin records a match result.
-- Auto-scores all predictions for that prediction type.

CREATE OR REPLACE FUNCTION score_predictions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE predictions
  SET
    is_correct = (predicted_value = NEW.actual_value),
    points_earned = CASE
      WHEN predicted_value = NEW.actual_value THEN (
        SELECT points_value FROM prediction_types WHERE id = NEW.prediction_type_id
      )
      ELSE 0
    END
  WHERE
    match_id = NEW.match_id
    AND prediction_type_id = NEW.prediction_type_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: score when a result is inserted or updated
CREATE TRIGGER trg_score_predictions
  AFTER INSERT OR UPDATE ON match_results
  FOR EACH ROW
  EXECUTE FUNCTION score_predictions();

-- ── Auto-update updated_at on matches ───

CREATE OR REPLACE FUNCTION update_match_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_match_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_match_timestamp();

-- ── Enable Realtime ─────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE match_results;
ALTER PUBLICATION supabase_realtime ADD TABLE table_bonuses;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
