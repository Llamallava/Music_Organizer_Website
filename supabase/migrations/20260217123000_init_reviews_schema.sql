-- Initial schema for Music Organizer v1 reviews flow.
-- This migration is designed for Supabase Postgres.

create extension if not exists "pgcrypto";

-- Shared trigger helper for updated_at columns.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Basic user profile row mapped 1:1 to auth.users.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_length check (username is null or char_length(username) between 3 and 32)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Optional helper to auto-create a profile row on auth signup.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Canonical album metadata table.
-- Album rows are shared across users.
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null,
  source_album_id text not null,
  title text not null,
  artist_name text not null,
  cover_url text,
  release_date date,
  total_tracks integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint albums_total_tracks_nonnegative check (total_tracks >= 0),
  constraint albums_provider_id_unique unique (source_provider, source_album_id)
);

create trigger albums_set_updated_at
before update on public.albums
for each row execute function public.set_updated_at();

create index if not exists albums_title_idx on public.albums (title);
create index if not exists albums_artist_name_idx on public.albums (artist_name);

-- Track metadata + lyrics are also persisted and shared.
create table if not exists public.album_tracks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  track_number integer not null,
  title text not null,
  duration_seconds integer,
  lyrics text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint album_tracks_track_number_positive check (track_number > 0),
  constraint album_tracks_duration_positive check (duration_seconds is null or duration_seconds > 0),
  constraint album_tracks_album_track_unique unique (album_id, track_number)
);

create trigger album_tracks_set_updated_at
before update on public.album_tracks
for each row execute function public.set_updated_at();

create index if not exists album_tracks_album_id_idx on public.album_tracks (album_id);

-- User-level saved album list.
-- One review set per user per album.
create table if not exists public.user_saved_albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_saved_albums_unique_per_user unique (user_id, album_id)
);

create trigger user_saved_albums_set_updated_at
before update on public.user_saved_albums
for each row execute function public.set_updated_at();

create index if not exists user_saved_albums_user_id_idx on public.user_saved_albums (user_id);
create index if not exists user_saved_albums_album_id_idx on public.user_saved_albums (album_id);

-- Per-track review entries plus one "conclusion" entry.
-- A row is either:
--   1) section_type = 'track' with a positive track_number, or
--   2) section_type = 'conclusion' with track_number = null.
create table if not exists public.review_sections (
  id uuid primary key default gen_random_uuid(),
  user_saved_album_id uuid not null references public.user_saved_albums(id) on delete cascade,
  section_type text not null,
  track_number integer,
  notes text not null default '',
  score numeric(3, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_sections_type_check check (section_type in ('track', 'conclusion')),
  constraint review_sections_track_or_conclusion_check check (
    (section_type = 'track' and track_number is not null and track_number > 0)
    or
    (section_type = 'conclusion' and track_number is null)
  ),
  constraint review_sections_score_range_check check (score is null or (score >= 0 and score <= 10))
);

create trigger review_sections_set_updated_at
before update on public.review_sections
for each row execute function public.set_updated_at();

-- One review row per track number.
create unique index if not exists review_sections_track_unique
on public.review_sections (user_saved_album_id, track_number)
where section_type = 'track';

-- Exactly one conclusion row.
create unique index if not exists review_sections_conclusion_unique
on public.review_sections (user_saved_album_id)
where section_type = 'conclusion';

create index if not exists review_sections_user_saved_album_id_idx
on public.review_sections (user_saved_album_id);

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_tracks enable row level security;
alter table public.user_saved_albums enable row level security;
alter table public.review_sections enable row level security;

-- profiles policies
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- albums policies
create policy "albums_select_authenticated"
on public.albums
for select
to authenticated
using (true);

create policy "albums_insert_authenticated"
on public.albums
for insert
to authenticated
with check (true);

-- album_tracks policies
create policy "album_tracks_select_authenticated"
on public.album_tracks
for select
to authenticated
using (true);

create policy "album_tracks_insert_authenticated"
on public.album_tracks
for insert
to authenticated
with check (true);

-- user_saved_albums policies
create policy "user_saved_albums_select_own"
on public.user_saved_albums
for select
to authenticated
using (auth.uid() = user_id);

create policy "user_saved_albums_insert_own"
on public.user_saved_albums
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "user_saved_albums_update_own"
on public.user_saved_albums
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user_saved_albums_delete_own"
on public.user_saved_albums
for delete
to authenticated
using (auth.uid() = user_id);

-- review_sections policies via ownership through user_saved_albums
create policy "review_sections_select_own"
on public.review_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.user_saved_albums usa
    where usa.id = review_sections.user_saved_album_id
      and usa.user_id = auth.uid()
  )
);

create policy "review_sections_insert_own"
on public.review_sections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_saved_albums usa
    where usa.id = review_sections.user_saved_album_id
      and usa.user_id = auth.uid()
  )
);

create policy "review_sections_update_own"
on public.review_sections
for update
to authenticated
using (
  exists (
    select 1
    from public.user_saved_albums usa
    where usa.id = review_sections.user_saved_album_id
      and usa.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.user_saved_albums usa
    where usa.id = review_sections.user_saved_album_id
      and usa.user_id = auth.uid()
  )
);

create policy "review_sections_delete_own"
on public.review_sections
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_saved_albums usa
    where usa.id = review_sections.user_saved_album_id
      and usa.user_id = auth.uid()
  )
);
