-- Clears all application data for a fresh start.
-- Run in the Supabase SQL Editor (or with a privileged Postgres connection).
--
-- Maintenance note:
-- Keep the table list below in sync with schema changes in supabase/migrations.
-- If you add a new table in public, add it to the TRUNCATE list.

begin;

truncate table
  public.playlist_songs,
  public.playlists,
  public.notification_events,
  public.song_recommendations,
  public.to_listen_songs,
  public.friendships,
  public.review_sections,
  public.user_saved_albums,
  public.album_tracks,
  public.albums,
  public.profiles
restart identity cascade;

-- Removes all non-system auth users so the project is truly clean.
-- This cascades to auth identities/sessions/tokens managed by Supabase.
delete from auth.users;

commit;
