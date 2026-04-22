-- ============================================================
-- VISION (影境) - Supabase Database Schema
-- Execute this SQL in your Supabase project's SQL Editor
-- ============================================================

-- Enable Row Level Security
ALTER TABLE IF EXISTS generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invites ENABLE ROW LEVEL SECURITY;

-- Drop existing tables (caution: this deletes all data!)
DROP TABLE IF EXISTS generations CASCADE;
DROP TABLE IF EXISTS invites CASCADE;

-- ============================================================
-- Generations Table
-- Stores AI image generation records per user
-- ============================================================
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  picture_id TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1' CHECK (aspect_ratio IN ('1:1', '16:9', '3:4', '9:16')),
  style_strength INTEGER NOT NULL DEFAULT 75 CHECK (style_strength >= 0 AND style_strength <= 100),
  engine TEXT NOT NULL DEFAULT 'DALL-E 3',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  picture_lifecycle TEXT DEFAULT 'pending'
    CHECK (picture_lifecycle IN ('pending', 'generating', 'active', 'expiring', 'expired')),
  picture_expires_at TIMESTAMPTZ,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own generations
CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON generations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations"
  ON generations FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast queries
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX idx_generations_picture_id ON generations(picture_id);

-- ============================================================
-- Invites Table
-- Tracks invite relationships between users
-- ============================================================
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own invites"
  ON invites FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Anyone can insert invites"
  ON invites FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own invites"
  ON invites FOR UPDATE
  USING (auth.uid() = inviter_id);

-- Index
CREATE INDEX idx_invites_inviter_id ON invites(inviter_id);
CREATE INDEX idx_invites_invite_code ON invites(invite_code);

-- ============================================================
-- Function: Get invite count for a user
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_invite_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM invites
    WHERE inviter_id = user_uuid AND invitee_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: Auto-update invite record when new user registers with invite code
-- ============================================================
CREATE OR REPLACE FUNCTION handle_invite_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Check if user signed up with an invite code in metadata
  IF NEW.raw_user_meta_data->>'invite_code' IS NOT NULL THEN
    -- Find the invite record
    SELECT * INTO invite_record
    FROM invites
    WHERE invite_code = NEW.raw_user_meta_data->>'invite_code'
      AND invitee_id IS NULL;

    IF FOUND THEN
      -- Update the invite record with the new user id
      UPDATE invites
      SET invitee_id = NEW.id
      WHERE id = invite_record.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_invite_on_signup();

-- ============================================================
-- Storage Bucket for generated images
-- ============================================================
-- Note: Create the "images" bucket manually in the Supabase Dashboard
-- Storage > New Bucket > Name: "images" > Public: true

-- Storage RLS policies (apply after creating the bucket)
-- CREATE POLICY "Users can upload own images"
--   ON storage.objects FOR INSERT
--   WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own images"
--   ON storage.objects FOR SELECT
--   USING (auth.uid()::text = (storage.foldername(name))[1]);
