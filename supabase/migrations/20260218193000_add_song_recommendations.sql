create table if not exists public.song_recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  receiver_user_id uuid not null references auth.users(id) on delete cascade,
  song_name text not null,
  artist_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint song_recommendations_no_self_check check (sender_user_id <> receiver_user_id),
  constraint song_recommendations_song_name_nonempty check (char_length(trim(song_name)) > 0),
  constraint song_recommendations_artist_name_nonempty check (char_length(trim(artist_name)) > 0)
);

create trigger song_recommendations_set_updated_at
before update on public.song_recommendations
for each row execute function public.set_updated_at();

create index if not exists song_recommendations_receiver_created_at_idx
on public.song_recommendations (receiver_user_id, created_at desc);

create index if not exists song_recommendations_sender_created_at_idx
on public.song_recommendations (sender_user_id, created_at desc);

alter table public.song_recommendations enable row level security;

create policy "song_recommendations_select_participant"
on public.song_recommendations
for select
to authenticated
using (auth.uid() = sender_user_id or auth.uid() = receiver_user_id);

create policy "song_recommendations_insert_sender_to_friend"
on public.song_recommendations
for insert
to authenticated
with check (
  auth.uid() = sender_user_id
  and exists (
    select 1
    from public.friendships friendship
    where (
      friendship.user_id = auth.uid()
      and friendship.friend_user_id = receiver_user_id
    ) or (
      friendship.friend_user_id = auth.uid()
      and friendship.user_id = receiver_user_id
    )
  )
);

create policy "song_recommendations_delete_receiver"
on public.song_recommendations
for delete
to authenticated
using (auth.uid() = receiver_user_id);
