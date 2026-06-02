# Music Organizer

A personal music review and organization app. Search for albums, save them to your library, write track-by-track reviews, and share your takes with friends.

Website currently located at https://llamallava.github.io/Music_Organizer_Website/

---

**Reviews**

Search for any album, add it to your library, and review each track individually. For every track you can write notes on the lyrics, notes on the sound, and give it a score. Score history is tracked so you can see how your opinion changes over time.

**Stats**

The stats page breaks down your listening habits, top artists, score distributions, and other data pulled from your saved albums and reviews.

**Friends**

Share a friend code with someone to connect. Once connected, you can view each other's libraries, reviews, and send song recommendations. Recommendations trigger notifications on the receiving end.

**To-Listen list**

Mark songs or albums you want to come back to later.

**Artists**

Browse your saved artists with cover images pulled from Spotify. Tap an artist to see all of their albums in your library.

**Search**

Find albums and songs using MusicBrainz. Results show cover art and metadata. From search you can add anything directly to your library.

**Playlists**

Create and manage playlists from your saved tracks. Playlists can be exported to Spotify.

**Customize**

Choose which album covers cycle through the home page background. Toggle between using all saved covers or a hand-picked selection.

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v7 |
| Animation | Framer Motion |
| Database + Auth | Supabase (PostgreSQL) |
| Music metadata | MusicBrainz API |
| Album + artist images | Cover Art Archive, Spotify (via Supabase Edge Functions) |
| Lyrics | Genius API |

---

## Running locally

**Prerequisites:** Node.js (LTS)

```bash
npm install
```

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GENIUS_ACCESS_TOKEN=your_genius_token   # optional, enables lyrics
```

```bash
npm run dev       # start dev server
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # run ESLint
```

---

## Project structure

```
src/
├── pages/          # one file per route (Home, Reviews, Search, Stats, Friends, etc.)
├── components/     # shared UI (NavBar, AlbumCover, backgrounds, stats modules)
├── contexts/       # BackgroundContext for cycling album cover backgrounds
├── hooks/          # useAuthSession, useAlbumAccent
└── lib/
    ├── supabaseClient.ts
    ├── db/         # all Supabase queries (reviews, profiles, friends, stats, playlists)
    └── external/   # MusicBrainz, Genius, Spotify integrations
```

---

## External services

- **MusicBrainz** -- album and track metadata, no auth required
- **Cover Art Archive** -- album cover images via MusicBrainz release IDs
- **Genius** -- song lyrics, fetched with a token or scraped as a fallback
- **Spotify** -- album covers and artist images, called through a Supabase Edge Function so the client secret stays server-side

---
