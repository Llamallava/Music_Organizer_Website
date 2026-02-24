create table if not exists public.playlist_shares (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shared_with_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint playlist_shares_no_self_check check (owner_user_id <> shared_with_user_id),
  constraint playlist_shares_pkey primary key (playlist_id, shared_with_user_id)
);

create index if not exists playlist_shares_owner_user_id_created_at_idx
on public.playlist_shares (owner_user_id, created_at desc);

create index if not exists playlist_shares_shared_with_user_id_created_at_idx
on public.playlist_shares (shared_with_user_id, created_at desc);

alter table public.playlist_shares enable row level security;

drop policy if exists "playlist_shares_select_member" on public.playlist_shares;
create policy "playlist_shares_select_member"
on public.playlist_shares
for select
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = shared_with_user_id);

drop policy if exists "playlist_shares_insert_owner_to_friend" on public.playlist_shares;
create policy "playlist_shares_insert_owner_to_friend"
on public.playlist_shares
for insert
to authenticated
with check (
  auth.uid() = owner_user_id
  and exists (
    select 1
    from public.playlists playlist
    where playlist.id = playlist_shares.playlist_id
      and playlist.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.friendships friendship
    where (
      friendship.user_id = auth.uid()
      and friendship.friend_user_id = playlist_shares.shared_with_user_id
    ) or (
      friendship.friend_user_id = auth.uid()
      and friendship.user_id = playlist_shares.shared_with_user_id
    )
  )
);

drop policy if exists "playlist_shares_delete_member" on public.playlist_shares;
create policy "playlist_shares_delete_member"
on public.playlist_shares
for delete
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = shared_with_user_id);

drop policy if exists "playlists_select_own" on public.playlists;
drop policy if exists "playlists_select_visible" on public.playlists;
create policy "playlists_select_visible"
on public.playlists
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.playlist_shares share
    where share.playlist_id = playlists.id
      and share.shared_with_user_id = auth.uid()
  )
);

drop policy if exists "playlist_songs_select_own" on public.playlist_songs;
drop policy if exists "playlist_songs_select_visible" on public.playlist_songs;
create policy "playlist_songs_select_visible"
on public.playlist_songs
for select
to authenticated
using (
  exists (
    select 1
    from public.playlists playlist
    where playlist.id = playlist_songs.playlist_id
      and (
        playlist.user_id = auth.uid()
        or exists (
          select 1
          from public.playlist_shares share
          where share.playlist_id = playlist.id
            and share.shared_with_user_id = auth.uid()
        )
      )
  )
);
