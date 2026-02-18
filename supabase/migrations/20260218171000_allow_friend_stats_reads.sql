drop policy if exists "user_saved_albums_select_friend" on public.user_saved_albums;
create policy "user_saved_albums_select_friend"
on public.user_saved_albums
for select
to authenticated
using (
  exists (
    select 1
    from public.friendships friendship
    where (
      friendship.user_id = auth.uid()
      and friendship.friend_user_id = user_saved_albums.user_id
    ) or (
      friendship.friend_user_id = auth.uid()
      and friendship.user_id = user_saved_albums.user_id
    )
  )
);

drop policy if exists "review_sections_select_friend" on public.review_sections;
create policy "review_sections_select_friend"
on public.review_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.user_saved_albums usa
    join public.friendships friendship
      on (
        friendship.user_id = auth.uid()
        and friendship.friend_user_id = usa.user_id
      ) or (
        friendship.friend_user_id = auth.uid()
        and friendship.user_id = usa.user_id
      )
    where usa.id = review_sections.user_saved_album_id
  )
);
