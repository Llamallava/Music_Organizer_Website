create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_username text;
begin
  metadata_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');

  if metadata_username is not null and char_length(metadata_username) not between 3 and 32 then
    metadata_username := null;
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, metadata_username)
  on conflict (user_id) do update
    set username = coalesce(public.profiles.username, excluded.username);

  return new;
end;
$$;
