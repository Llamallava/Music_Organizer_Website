-- Stores user preference for whether all album covers are included in the home background rotation.

alter table public.profiles
  add column if not exists background_all_covers_enabled boolean not null default false;

create or replace function public.set_background_all_covers_enabled(enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set background_all_covers_enabled = enabled
  where user_id = auth.uid();
end;
$$;
