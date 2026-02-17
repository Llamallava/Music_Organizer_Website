# Music Organizer Product Vision

Last updated: 2026-02-17

## Reviews Page Vision
- Reviews page shows saved albums in a scrollable grid.
- Grid target layout: about 6 albums across and unlimited rows (`n` down).
- Each album is a button/card with:
  - Album cover image
  - Album title
  - Artist name
- Top-left button: `Add Album`.
- Clicking `Add Album` navigates to an inner "add album" page.

## Add Album Flow
- User searches for an album.
- User chooses an album and clicks `Save`.
- Saved album appears on the Reviews page.

## Album Review Flow
- Clicking a saved album opens the album review workspace.
- Layout intent:
  - Top-left: album cover, album title, artist name
  - Left-middle: tracklist (track buttons)
  - Center: large review text box for the selected track
  - Top-right of review box: score input out of 10
  - Right side: lyrics for selected track
- Behavior:
  - Defaults to track 1 when album is opened.
  - Track selection switches context to that track's notes and lyrics.
  - Includes a final `Conclusion` selection after last track.
  - `Conclusion` has no lyrics.

## Data/Infra Notes
- Current backend: Supabase (free tier).
- Potential future option: self-hosted database on personal/school hardware.
- Need architecture that can migrate if backend changes.
- Version 1 is not collaborative: no cooperative/shared reviews yet.
- Users will have accounts in v1 (basic account flow now; possible Google auth later).
- Album metadata should be fetched once during add flow, then persisted and served from local database records.
- Lyrics should be stored in our database (no per-page live fetch requirement).
- One review set per album per user (users can return and edit over time).

## External Data Sources (Current Direction)
- Album covers candidate: https://covers.musichoarders.xyz/
- Tracklist/song metadata source: undecided.
- Lyrics source: undecided.

## Pending Decisions
- Canonical metadata provider for album/track search.
- Lyrics provider and legal/terms constraints.
- Final table design and migration SQL in Supabase.

## Confirmed Review Data Behavior (v1)
- Per track, store:
  - Notes text
  - Score out of 10
  - Lyrics text
- `Conclusion` is treated like a track-style entry with:
  - Notes text
  - Score out of 10 (final album score)
  - No lyrics
- After album add/save, all album/track/lyrics references come from our own database records.
