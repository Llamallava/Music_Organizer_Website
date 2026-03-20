-- Stores user preference for whether the home page background cycles automatically.

alter table public.profiles
  add column if not exists auto_background_enabled boolean not null default true;

create or replace function public.set_auto_background_enabled(enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set auto_background_enabled = enabled
  where user_id = auth.uid();
end;
$$;
