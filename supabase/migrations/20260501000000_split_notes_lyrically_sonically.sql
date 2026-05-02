-- Split the single `notes` column into `notes_lyrically` and `notes_sonically`.
-- All existing notes content moves to `notes_lyrically`; `notes_sonically` starts empty.
alter table public.review_sections rename column notes to notes_lyrically;
alter table public.review_sections add column notes_sonically text not null default '';
