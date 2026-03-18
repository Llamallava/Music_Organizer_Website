-- purge-database.sql
-- Deletes all data from every table in dependency order.
-- Run in the Supabase SQL editor (uses service role, bypasses RLS).

delete from public.playlist_export_runs;
delete from public.spotify_oauth_states;
delete from public.spotify_connections;
delete from public.playlist_songs;
delete from public.playlist_shares;
delete from public.playlists;
delete from public.notification_events;
delete from public.song_recommendations;
delete from public.to_listen_songs;
delete from public.review_sections;
delete from public.user_saved_albums;
delete from public.album_tracks;
delete from public.albums;
delete from public.friendships;
delete from public.profiles;

-- Deletes all auth users. Cascade handles profile + all user-owned rows above,
-- but explicit deletes above ensure clean ordering regardless.
delete from auth.users;
