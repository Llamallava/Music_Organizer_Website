-- Stores the user's chosen home page background album cover URL.

alter table public.profiles
  add column if not exists home_background_cover_url text;

-- RPC so users can update only their own background without needing a broad update policy.
create or replace function public.set_home_background(next_cover_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set home_background_cover_url = next_cover_url
  where user_id = auth.uid();
end;
$$;
