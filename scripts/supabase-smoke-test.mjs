import { createClient } from '@supabase/supabase-js'

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_TEST_USERNAME',
  'SUPABASE_TEST_PASSWORD',
]

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`)
    process.exit(1)
  }
}

const rawUsername = process.env.SUPABASE_TEST_USERNAME
const normalizedUsername = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '')
const safeUsername = normalizedUsername.length > 0 ? normalizedUsername : 'smoketestuser'
const explicitEmail = process.env.SUPABASE_TEST_EMAIL?.trim()
const testEmail = explicitEmail && explicitEmail.length > 0 ? explicitEmail : `${safeUsername}@example.com`
const testPassword = process.env.SUPABASE_TEST_PASSWORD

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
)

const signIn = async () => {
  return supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })
}

let { data: signInData, error: signInError } = await signIn()

if (signInError) {
  console.error('Initial sign-in failed:', signInError.message)

  const { error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        username: rawUsername,
      },
    },
  })

  if (signUpError) {
    console.error('Sign-up failed:', signUpError.message)
    console.error('Sign-up error details:', JSON.stringify(signUpError, null, 2))
    console.error('Create this user manually in Supabase Auth Users and run the smoke test again.')
    process.exit(1)
  }

  const secondAttempt = await signIn()
  signInData = secondAttempt.data
  signInError = secondAttempt.error

  if (signInError) {
    console.error('Sign-in failed after sign-up:', signInError.message)
    console.error('If this says email not confirmed, disable email confirmation in Supabase Auth settings for now.')
    process.exit(1)
  }
}

const userId = signInData.user?.id
if (!userId) {
  console.error('No user returned from sign-in.')
  process.exit(1)
}

const { data: currentProfile, error: currentProfileError } = await supabase
  .from('profiles')
  .select('username')
  .eq('user_id', userId)
  .maybeSingle()

if (currentProfileError) {
  console.error('Profile read failed:', currentProfileError.message)
  process.exit(1)
}

const originalUsername = currentProfile?.username ?? null
const probeUsername = `probe_${Date.now().toString(36)}`

const { error: upsertError } = await supabase.from('profiles').upsert(
  {
    user_id: userId,
    username: probeUsername,
  },
  { onConflict: 'user_id' },
)

if (upsertError) {
  console.error('Profile write failed:', upsertError.message)
  process.exit(1)
}

const { data: confirmedProfile, error: confirmedProfileError } = await supabase
  .from('profiles')
  .select('username')
  .eq('user_id', userId)
  .single()

if (confirmedProfileError) {
  console.error('Profile confirm read failed:', confirmedProfileError.message)
  process.exit(1)
}

if (confirmedProfile.username !== probeUsername) {
  console.error('Probe mismatch. Expected and returned usernames differ.')
  process.exit(1)
}

const { error: restoreError } = await supabase
  .from('profiles')
  .update({ username: originalUsername })
  .eq('user_id', userId)

if (restoreError) {
  console.error('Profile restore failed:', restoreError.message)
  process.exit(1)
}

console.log('Supabase smoke test succeeded: sign-in + write + read + restore completed.')
