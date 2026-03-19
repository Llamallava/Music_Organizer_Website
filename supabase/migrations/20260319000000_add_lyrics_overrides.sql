CREATE TABLE user_lyrics_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_saved_album_id uuid NOT NULL REFERENCES user_saved_albums(id) ON DELETE CASCADE,
  track_number integer NOT NULL,
  lyrics text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, user_saved_album_id, track_number)
);

ALTER TABLE user_lyrics_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_lyrics_overrides_select ON user_lyrics_overrides
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY user_lyrics_overrides_insert ON user_lyrics_overrides
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_lyrics_overrides_update ON user_lyrics_overrides
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY user_lyrics_overrides_delete ON user_lyrics_overrides
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
