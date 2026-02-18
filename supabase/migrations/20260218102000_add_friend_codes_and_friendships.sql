alter table public.profiles
add column if not exists friend_code text;

create unique index if not exists profiles_friend_code_unique_idx
on public.profiles (friend_code)
where friend_code is not null;

create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  next_code text;
begin
  loop
    next_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    exit when not exists (
      select 1
      from public.profiles
      where friend_code = next_code
    );
  end loop;

  return next_code;
end;
$$;

update public.profiles
set friend_code = public.generate_friend_code()
where friend_code is null;

alter table public.profiles
alter column friend_code set default public.generate_friend_code();

alter table public.profiles
alter column friend_code set not null;

alter table public.profiles
drop constraint if exists profiles_friend_code_format_check;

alter table public.profiles
add constraint profiles_friend_code_format_check
check (friend_code ~ '^[A-Z0-9]{10}$');

create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_no_self_check check (user_id <> friend_user_id),
  constraint friendships_pair_order_check check (user_id < friend_user_id),
  constraint friendships_unique_pair unique (user_id, friend_user_id)
);

create index if not exists friendships_user_id_idx
on public.friendships (user_id);

create index if not exists friendships_friend_user_id_idx
on public.friendships (friend_user_id);

alter table public.friendships enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "friendships_select_member" on public.friendships;
create policy "friendships_select_member"
on public.friendships
for select
to authenticated
using (auth.uid() = user_id or auth.uid() = friend_user_id);

drop policy if exists "friendships_insert_member" on public.friendships;
create policy "friendships_insert_member"
on public.friendships
for insert
to authenticated
with check (auth.uid() = user_id or auth.uid() = friend_user_id);
