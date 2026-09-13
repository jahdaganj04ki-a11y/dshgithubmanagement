/** Minimal GitHub REST helper — no SDK dep, pure fetch/undici. */

export interface GhRequestInit {
  token: string
  baseUrl?: string // default https://api.github.com, or GHES e.g. https://ghe.corp/api/v3
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface GhResponse<T> {
  data: T
  headers: Headers
  rateRemaining: number | null
  rateLimit: number | null
  rateReset: number | null
  scopes: string[]
}

export class GhError extends Error {
  status: number
  body: string
  headers: Headers
  constructor(status: number, body: string, headers: Headers) {
    super(`GitHub ${status}: ${body.slice(0, 400)}`)
    this.name = 'GhError'
    this.status = status
    this.body = body
    this.headers = headers
  }
}

function buildUrl(baseUrl: string | undefined, path: string, query?: GhRequestInit['query']): string {
  const base = (baseUrl ?? 'https://api.github.com').replace(/\/$/, '')
  const url = new URL(path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v))
  }
  return url.toString()
}

export async function ghFetch<T>(path: string, init: GhRequestInit): Promise<GhResponse<T>> {
  const url = buildUrl(init.baseUrl, path, init.query)
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${init.token}`,
    ...init.headers,
  }
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  })
  const text = await res.text()
  if (!res.ok) throw new GhError(res.status, text, res.headers)
  let data: T
  try {
    data = text ? (JSON.parse(text) as T) : (undefined as unknown as T)
  } catch {
    throw new GhError(res.status, text, res.headers)
  }
  const rem = res.headers.get('x-ratelimit-remaining')
  const lim = res.headers.get('x-ratelimit-limit')
  const rst = res.headers.get('x-ratelimit-reset')
  const scopeHeader = res.headers.get('x-oauth-scopes') ?? res.headers.get('x-accepted-oauth-scopes') ?? ''
  return {
    data,
    headers: res.headers,
    rateRemaining: rem ? Number(rem) : null,
    rateLimit: lim ? Number(lim) : null,
    rateReset: rst ? Number(rst) : null,
    scopes: scopeHeader
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  }
}

export interface GhViewer {
  login: string
  id: number
  avatar_url: string
  name: string | null
  type: string
}

export async function validateToken(token: string, baseUrl?: string): Promise<{ viewer: GhViewer; scopes: string[]; rate: { remaining: number; limit: number; reset: number } | null }> {
  const r = await ghFetch<GhViewer>('/user', { token, baseUrl })
  return {
    viewer: r.data,
    scopes: r.scopes,
    rate:
      r.rateRemaining !== null && r.rateLimit !== null && r.rateReset !== null
        ? { remaining: r.rateRemaining, limit: r.rateLimit, reset: r.rateReset }
        : null,
  }
}
