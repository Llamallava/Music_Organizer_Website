create table if not exists public.to_listen_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_name text not null,
  artist_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint to_listen_songs_song_name_nonempty check (char_length(trim(song_name)) > 0),
  constraint to_listen_songs_artist_name_nonempty check (char_length(trim(artist_name)) > 0)
);

create trigger to_listen_songs_set_updated_at
before update on public.to_listen_songs
for each row execute function public.set_updated_at();

create index if not exists to_listen_songs_user_id_created_at_idx
on public.to_listen_songs (user_id, created_at desc);

alter table public.to_listen_songs enable row level security;

create policy "to_listen_songs_select_own"
on public.to_listen_songs
for select
to authenticated
using (auth.uid() = user_id);

create policy "to_listen_songs_insert_own"
on public.to_listen_songs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "to_listen_songs_update_own"
on public.to_listen_songs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "to_listen_songs_delete_own"
on public.to_listen_songs
for delete
to authenticated
using (auth.uid() = user_id);
