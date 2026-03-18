import { HttpError } from './http.ts'
import { getSupabaseAdminClient } from './supabaseAdmin.ts'

const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get('Authorization') ?? request.headers.get('authorization')
  if (!authHeader) {
    throw new HttpError(401, 'Missing Authorization header.', 'missing_authorization')
  }

  const [scheme, token] = authHeader.split(' ')
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    throw new HttpError(401, 'Authorization header must be Bearer token.', 'invalid_authorization')
  }

  return token.trim()
}

export const requireSupabaseUser = async (request: Request) => {
  const token = getBearerToken(request)
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase.auth.getUser(token)
  if (error) {
    throw new HttpError(401, 'Invalid or expired Supabase session.', 'invalid_session')
  }

  const user = data.user
  if (!user) {
    throw new HttpError(401, 'No authenticated user found.', 'missing_user')
  }

  return {
    user,
    accessToken: token,
  }
}

