create or replace function public.update_my_username(next_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  cleaned_username text;
  updated_profile public.profiles;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated.';
  end if;

  cleaned_username := nullif(trim(coalesce(next_username, '')), '');
  if cleaned_username is null then
    raise exception 'Username is required.';
  end if;

  if char_length(cleaned_username) < 3 or char_length(cleaned_username) > 32 then
    raise exception 'Username must be between 3 and 32 characters.';
  end if;

  insert into public.profiles (user_id, username)
  values (current_user_id, cleaned_username)
  on conflict (user_id) do update
    set username = excluded.username
  returning * into updated_profile;

  return updated_profile;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'That username is already in use.';
end;
$$;

revoke all on function public.update_my_username(text) from public;
grant execute on function public.update_my_username(text) to authenticated;
