alter table public.playlist_songs
alter column user_saved_album_id drop not null;

alter table public.playlist_songs
alter column track_number drop not null;

alter table public.playlist_songs
add column if not exists source_provider text,
add column if not exists source_song_id text,
add column if not exists song_name text,
add column if not exists artist_name text,
add column if not exists album_title text,
add column if not exists cover_url text;

alter table public.playlist_songs
drop constraint if exists playlist_songs_track_number_positive;

alter table public.playlist_songs
add constraint playlist_songs_track_number_positive
check (track_number is null or track_number > 0);

alter table public.playlist_songs
drop constraint if exists playlist_songs_unique_track;

create unique index if not exists playlist_songs_unique_local_track
on public.playlist_songs (playlist_id, user_saved_album_id, track_number)
where user_saved_album_id is not null and track_number is not null;

create unique index if not exists playlist_songs_unique_external_song
on public.playlist_songs (playlist_id, source_provider, source_song_id)
where source_provider is not null and source_song_id is not null;

alter table public.playlist_songs
drop constraint if exists playlist_songs_entry_shape_check;

alter table public.playlist_songs
add constraint playlist_songs_entry_shape_check check (
  (
    user_saved_album_id is not null
    and track_number is not null
    and source_provider is null
    and source_song_id is null
  )
  or
  (
    user_saved_album_id is null
    and track_number is null
    and source_provider is not null
    and source_song_id is not null
    and song_name is not null
    and char_length(trim(song_name)) > 0
    and artist_name is not null
    and char_length(trim(artist_name)) > 0
  )
);

drop policy if exists "playlist_songs_insert_own" on public.playlist_songs;
create policy "playlist_songs_insert_own"
on public.playlist_songs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.playlists playlist
    where playlist.id = playlist_songs.playlist_id
      and playlist.user_id = auth.uid()
  )
  and (
    (
      playlist_songs.user_saved_album_id is not null
      and playlist_songs.track_number is not null
      and exists (
        select 1
        from public.user_saved_albums saved_album
        where saved_album.id = playlist_songs.user_saved_album_id
          and saved_album.user_id = auth.uid()
      )
    )
    or
    (
      playlist_songs.user_saved_album_id is null
      and playlist_songs.track_number is null
      and playlist_songs.source_provider is not null
      and playlist_songs.source_song_id is not null
      and playlist_songs.song_name is not null
      and char_length(trim(playlist_songs.song_name)) > 0
      and playlist_songs.artist_name is not null
      and char_length(trim(playlist_songs.artist_name)) > 0
    )
  )
);

drop policy if exists "playlist_songs_update_own" on public.playlist_songs;
create policy "playlist_songs_update_own"
on public.playlist_songs
for update
to authenticated
using (
  exists (
    select 1
    from public.playlists playlist
    where playlist.id = playlist_songs.playlist_id
      and playlist.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.playlists playlist
    where playlist.id = playlist_songs.playlist_id
      and playlist.user_id = auth.uid()
  )
  and (
    (
      playlist_songs.user_saved_album_id is not null
      and playlist_songs.track_number is not null
      and exists (
        select 1
        from public.user_saved_albums saved_album
        where saved_album.id = playlist_songs.user_saved_album_id
          and saved_album.user_id = auth.uid()
      )
    )
    or
    (
      playlist_songs.user_saved_album_id is null
      and playlist_songs.track_number is null
      and playlist_songs.source_provider is not null
      and playlist_songs.source_song_id is not null
      and playlist_songs.song_name is not null
      and char_length(trim(playlist_songs.song_name)) > 0
      and playlist_songs.artist_name is not null
      and char_length(trim(playlist_songs.artist_name)) > 0
    )
  )
);
