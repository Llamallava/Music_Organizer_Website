# Build Milestones

Last updated: 2026-02-17

## Milestone 1 (Completed)
- Define initial Supabase/Postgres schema.
- Add migration SQL for:
  - User profile records
  - Album metadata and track metadata (with lyrics)
  - User saved albums
  - Per-track and conclusion review entries
  - Constraints/indexes/RLS baseline

## Milestone 2 (Completed)
- Add Supabase client configuration in frontend.
- Add typed data-access helpers for albums/tracks/reviews.
- No major UI changes in this milestone.

## Milestone 3 (Completed)
- Implement Reviews page data loading.
- Show album grid (target ~6 columns desktop) from database.
- Add working `Add Album` navigation.

## Milestone 4 (Next)
- Implement Add Album page:
  - Search external metadata provider
  - Select album
  - Persist album + tracks + lyrics + user save record

## Milestone 5
- Implement Album Review workspace:
  - Track list selection
  - Per-track notes and score
  - Lyrics panel
  - Conclusion entry with final score

## Milestone 6
- Implement auth screens and flows.
- Tighten RLS for production expectations.
