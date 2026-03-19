-- Song tags: per-user, per-track freeform labels.
-- Tags are normalized to lowercase at the application layer.

create table if not exists public.song_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_saved_album_id uuid not null references public.user_saved_albums(id) on delete cascade,
  track_number integer not null,
  tag text not null,
  created_at timestamptz not null default now(),
  constraint song_tags_track_number_positive check (track_number > 0),
  constraint song_tags_tag_nonempty check (char_length(trim(tag)) > 0),
  constraint song_tags_tag_length check (char_length(tag) <= 50),
  constraint song_tags_unique unique (user_id, user_saved_album_id, track_number, tag)
);

create index if not exists song_tags_user_id_idx on public.song_tags (user_id);
create index if not exists song_tags_user_saved_album_id_idx on public.song_tags (user_saved_album_id);

alter table public.song_tags enable row level security;

create policy "song_tags_select_own"
on public.song_tags
for select
to authenticated
using (auth.uid() = user_id);

create policy "song_tags_insert_own"
on public.song_tags
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.user_saved_albums usa
    where usa.id = song_tags.user_saved_album_id
      and usa.user_id = auth.uid()
  )
);

create policy "song_tags_delete_own"
on public.song_tags
for delete
to authenticated
using (auth.uid() = user_id);
