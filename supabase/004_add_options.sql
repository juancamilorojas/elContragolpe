-- ============================================
-- El Contragolpe — Migration: Add options to prediction_types
-- Run this in Supabase SQL Editor
-- ============================================

-- Add options column (array of up to 6 answer choices)
ALTER TABLE prediction_types
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;

-- Add a comment for documentation
COMMENT ON COLUMN prediction_types.options IS 'Array of answer option strings, max 6. Empty array means free-text input.';
