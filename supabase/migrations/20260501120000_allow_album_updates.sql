-- albums and album_tracks are shared canonical data sourced from MusicBrainz.
-- Any authenticated user may update them (e.g. when re-adding an album that
-- already exists, the upsert's ON CONFLICT DO UPDATE path needs this policy).
create policy "albums_update_authenticated"
on public.albums
for update
to authenticated
using (true)
with check (true);

create policy "album_tracks_update_authenticated"
on public.album_tracks
for update
to authenticated
using (true)
with check (true);
