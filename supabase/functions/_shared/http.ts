export class HttpError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, message: string, code = 'http_error', details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export const handleCorsPreflight = (request: Request) => {
  if (request.method !== 'OPTIONS') {
    return null
  }

  return new Response('ok', {
    headers: corsHeaders,
  })
}

export const jsonResponse = (body: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')

  for (const [key, value] of Object.entries(corsHeaders)) {
    if (!headers.has(key)) {
      headers.set(key, value)
    }
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

export const errorResponse = (error: unknown) => {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        error: error.code,
        message: error.message,
        details: error.details,
      },
      { status: error.status },
    )
  }

  const message = error instanceof Error ? error.message : 'Unexpected error.'
  return jsonResponse(
    {
      error: 'internal_error',
      message,
    },
    { status: 500 },
  )
}

export const requireMethod = (request: Request, allowed: string[]) => {
  if (!allowed.includes(request.method)) {
    throw new HttpError(405, `Method ${request.method} not allowed.`, 'method_not_allowed')
  }
}

export const readJsonBody = async <T>(request: Request): Promise<T | null> => {
  const raw = await request.text()
  if (!raw.trim()) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', 'invalid_json')
  }
}

export const redirectResponse = (url: string, status = 302) =>
  new Response(null, {
    status,
    headers: {
      Location: url,
    },
  })

