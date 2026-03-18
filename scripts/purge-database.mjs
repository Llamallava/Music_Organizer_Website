/**
 * purge-database.mjs
 *
 * Deletes all data from every table. Requires the service role key to bypass RLS.
 * Auth users are deleted last; most other tables cascade from them automatically.
 *
 * Required env vars (set in .env or export before running):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node -r dotenv/config scripts/purge-database.mjs
 *
 * Add --confirm to skip the prompt.
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

const url = process.env.VITE_SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!url) {
  console.error('Missing VITE_SUPABASE_URL')
  process.exit(1)
}
if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const confirm = async () => {
  if (process.argv.includes('--confirm')) return
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise((resolve, reject) =>
    rl.question(`\nThis will DELETE ALL DATA in ${url}.\nType "purge" to continue: `, (answer) => {
      rl.close()
      if (answer.trim() !== 'purge') {
        console.log('Aborted.')
        process.exit(0)
      }
      resolve()
    }),
  )
}

const purge = async (table) => {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw new Error(`Failed to purge ${table}: ${error.message}`)
  console.log(`  ${table}: ${count ?? '?'} rows deleted`)
}

// Tables with a PK that isn't `id` need a different filter column.
const purgeByColumn = async (table, column) => {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).not(column, 'is', null)
  if (error) throw new Error(`Failed to purge ${table}: ${error.message}`)
  console.log(`  ${table}: ${count ?? '?'} rows deleted`)
}

const deleteAllAuthUsers = async () => {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(`Failed to list auth users: ${error.message}`)

  const users = data?.users ?? []
  if (users.length === 0) {
    console.log('  auth.users: 0 rows deleted')
    return
  }

  let deleted = 0
  for (const user of users) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id)
    if (delError) throw new Error(`Failed to delete user ${user.id}: ${delError.message}`)
    deleted++
  }
  console.log(`  auth.users: ${deleted} rows deleted`)
}

await confirm()
console.log('\nPurging...')

// Delete leaf tables first (those not cascaded from auth.users, or to be safe)
// albums/album_tracks have no user FK — must be deleted explicitly.
// Everything else cascades when auth users are deleted.

await purge('playlist_export_runs')
await purge('spotify_oauth_states')
await purge('spotify_connections')
await purge('playlist_songs')
await purgeByColumn('playlist_shares', 'playlist_id')
await purge('playlists')
await purge('notification_events')
await purge('song_recommendations')
await purge('to_listen_songs')
await purge('review_sections')
await purge('user_saved_albums')
await purge('album_tracks')
await purge('albums')
await purgeByColumn('friendships', 'user_id')
await purgeByColumn('profiles', 'user_id')
await deleteAllAuthUsers()

console.log('\nDone.')
