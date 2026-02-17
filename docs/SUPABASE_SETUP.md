# Supabase Connection Setup

## Required Information
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_TEST_USERNAME`
- `SUPABASE_TEST_PASSWORD`
- Optional: `SUPABASE_TEST_EMAIL` (for explicit Auth email override)

## Where to get values
- In Supabase dashboard:
  - `Project Settings` -> `API`
  - Copy:
    - Project URL -> `VITE_SUPABASE_URL`
    - Project API key (`anon` `public`) -> `VITE_SUPABASE_ANON_KEY`
- Choose a test username/password for local smoke tests:
  - `SUPABASE_TEST_USERNAME`
  - `SUPABASE_TEST_PASSWORD`

## Local file
Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_TEST_USERNAME=testuser
SUPABASE_TEST_PASSWORD=your_test_password
SUPABASE_TEST_EMAIL=
```

## Dummy Query (Read/Write) Test
Run:

```bash
npm run supabase:smoke
```

What it does:
1. Uses your test username to derive an internal email for Supabase Auth.
2. Signs in, or signs up then signs in if user does not exist.
3. Reads the `profiles` row for that user.
4. Writes a temporary username value.
5. Reads back to verify write worked.
6. Restores the previous username.

If this fails with `relation "profiles" does not exist`, run the migration first.
If this fails with `email not confirmed`, disable email confirmation in Supabase Auth settings for now.
If this fails with `email rate limit exceeded`, either wait for the Supabase rate window to reset or create/confirm a test user manually and set `SUPABASE_TEST_EMAIL`.
