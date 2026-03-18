create table if not exists public.spotify_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text not null unique,
  spotify_display_name text,
  spotify_country text,
  spotify_product text,
  scope text not null default '',
  refresh_token text not null,
  profile_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_connected_at timestamptz not null default now()
);

create trigger spotify_connections_set_updated_at
before update on public.spotify_connections
for each row execute function public.set_updated_at();

create index if not exists spotify_connections_last_connected_at_idx
on public.spotify_connections (last_connected_at desc);

create table if not exists public.spotify_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null unique,
  requested_scopes text not null default '',
  redirect_path text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint spotify_oauth_states_state_nonempty check (char_length(trim(state)) > 0)
);

create index if not exists spotify_oauth_states_user_id_created_at_idx
on public.spotify_oauth_states (user_id, created_at desc);

create index if not exists spotify_oauth_states_expires_at_idx
on public.spotify_oauth_states (expires_at);

create table if not exists public.playlist_export_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_playlist_id uuid not null references public.playlists(id) on delete cascade,
  destination_provider text not null,
  destination_playlist_id text,
  destination_playlist_url text,
  status text not null default 'pending',
  total_songs integer not null default 0,
  matched_songs integer not null default 0,
  added_songs integer not null default 0,
  unmatched_songs integer not null default 0,
  skipped_songs integer not null default 0,
  error_message text,
  request_metadata jsonb not null default '{}'::jsonb,
  result_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playlist_export_runs_destination_provider_check check (destination_provider in ('spotify')),
  constraint playlist_export_runs_status_check check (status in ('pending', 'running', 'succeeded', 'partial', 'failed')),
  constraint playlist_export_runs_counts_nonnegative check (
    total_songs >= 0
    and matched_songs >= 0
    and added_songs >= 0
    and unmatched_songs >= 0
    and skipped_songs >= 0
  )
);

create trigger playlist_export_runs_set_updated_at
before update on public.playlist_export_runs
for each row execute function public.set_updated_at();

create index if not exists playlist_export_runs_user_id_created_at_idx
on public.playlist_export_runs (user_id, created_at desc);

create index if not exists playlist_export_runs_source_playlist_id_created_at_idx
on public.playlist_export_runs (source_playlist_id, created_at desc);

alter table public.spotify_connections enable row level security;
alter table public.spotify_oauth_states enable row level security;
alter table public.playlist_export_runs enable row level security;

-- Spotify connection rows contain refresh tokens, so client access is intentionally denied.
-- Edge functions should use the service role key to access this table.

create policy "playlist_export_runs_select_own"
on public.playlist_export_runs
for select
to authenticated
using (auth.uid() = user_id);

