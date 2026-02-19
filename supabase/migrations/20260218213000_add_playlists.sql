create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playlists_name_nonempty check (char_length(trim(name)) > 0),
  constraint playlists_name_length check (char_length(name) <= 120),
  constraint playlists_user_name_unique unique (user_id, name)
);

create trigger playlists_set_updated_at
before update on public.playlists
for each row execute function public.set_updated_at();

create index if not exists playlists_user_id_created_at_idx
on public.playlists (user_id, created_at desc);

create table if not exists public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  user_saved_album_id uuid not null references public.user_saved_albums(id) on delete cascade,
  track_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playlist_songs_track_number_positive check (track_number > 0),
  constraint playlist_songs_unique_track unique (playlist_id, user_saved_album_id, track_number)
);

create trigger playlist_songs_set_updated_at
before update on public.playlist_songs
for each row execute function public.set_updated_at();

create index if not exists playlist_songs_playlist_id_created_at_idx
on public.playlist_songs (playlist_id, created_at desc);

create index if not exists playlist_songs_user_saved_album_track_idx
on public.playlist_songs (user_saved_album_id, track_number);

alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

create policy "playlists_select_own"
on public.playlists
for select
to authenticated
using (auth.uid() = user_id);

create policy "playlists_insert_own"
on public.playlists
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "playlists_update_own"
on public.playlists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "playlists_delete_own"
on public.playlists
for delete
to authenticated
using (auth.uid() = user_id);

create policy "playlist_songs_select_own"
on public.playlist_songs
for select
to authenticated
using (
  exists (
    select 1
    from public.playlists playlist
    where playlist.id = playlist_songs.playlist_id
      and playlist.user_id = auth.uid()
  )
);

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
  and exists (
    select 1
    from public.user_saved_albums saved_album
    where saved_album.id = playlist_songs.user_saved_album_id
      and saved_album.user_id = auth.uid()
  )
);

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
  and exists (
    select 1
    from public.user_saved_albums saved_album
    where saved_album.id = playlist_songs.user_saved_album_id
      and saved_album.user_id = auth.uid()
  )
);

create policy "playlist_songs_delete_own"
on public.playlist_songs
for delete
to authenticated
using (
  exists (
    select 1
    from public.playlists playlist
    where playlist.id = playlist_songs.playlist_id
      and playlist.user_id = auth.uid()
  )
);
