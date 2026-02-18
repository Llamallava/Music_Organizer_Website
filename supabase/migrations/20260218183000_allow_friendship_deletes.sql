drop policy if exists "friendships_delete_member" on public.friendships;
create policy "friendships_delete_member"
on public.friendships
for delete
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_user_id);
