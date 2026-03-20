-- Tracks score changes on track review sections so we can show "you first gave this X, then changed it to Y".

create table if not exists public.review_section_score_history (
  id uuid primary key default gen_random_uuid(),
  review_section_id uuid not null references public.review_sections(id) on delete cascade,
  old_score numeric,
  new_score numeric,
  changed_at timestamptz not null default now()
);

create index if not exists review_section_score_history_section_id_idx
  on public.review_section_score_history (review_section_id);

alter table public.review_section_score_history enable row level security;

create policy "review_section_score_history_select_own"
on public.review_section_score_history
for select
to authenticated
using (
  exists (
    select 1
    from public.review_sections rs
    join public.user_saved_albums usa on usa.id = rs.user_saved_album_id
    where rs.id = review_section_score_history.review_section_id
      and usa.user_id = auth.uid()
  )
);

create policy "review_section_score_history_insert_own"
on public.review_section_score_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.review_sections rs
    join public.user_saved_albums usa on usa.id = rs.user_saved_album_id
    where rs.id = review_section_score_history.review_section_id
      and usa.user_id = auth.uid()
  )
);
