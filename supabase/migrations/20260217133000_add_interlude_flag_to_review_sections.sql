alter table public.review_sections
add column if not exists is_interlude boolean not null default false;

alter table public.review_sections
drop constraint if exists review_sections_interlude_track_only_check;

alter table public.review_sections
add constraint review_sections_interlude_track_only_check check (
  section_type = 'track' or is_interlude = false
);
