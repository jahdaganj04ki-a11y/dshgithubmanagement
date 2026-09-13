/**
 * Client-side API abstraction.
 * Inside DSH Desktop: proxied through `ctx.remote.githubManager` (Typert).
 * In Vite demo / tests: `LocalApi` talks directly to GitHub with tokens from localStorage.
 */
import type { AccountId, DashboardSnapshot, RateLimitView, AccountStatus, RepoListItem, IssueListItem, PRListItem, WorkflowRunItem, NotificationItem, GithubSettings, GithubAccount } from '../shared/types.js'
import { DEFAULT_SETTINGS } from '../shared/types.js'
import { normalizeSettings } from '../host/store.js'
import { ghFetch, validateToken } from '../shared/github-api.js'

export interface GithubRemote {
  listAccounts(): Promise<{ accountIds: AccountId[]; defaultAccountId: string; accounts: GithubAccount[] }>
  getStatus(accountId: AccountId): Promise<AccountStatus>
  getRateLimit(accountId: AccountId): Promise<RateLimitView | null>
  getDashboard(accountId: AccountId, loginHint: string): Promise<DashboardSnapshot>
  listRepos(accountId: AccountId, opts?: any): Promise<RepoListItem[]>
  searchRepos(accountId: AccountId, q: string): Promise<RepoListItem[]>
  getRepo(accountId: AccountId, fullName: string): Promise<RepoListItem>
  listIssues(accountId: AccountId, opts?: any): Promise<IssueListItem[]>
  listRepoIssues(accountId: AccountId, fullName: string, opts?: any): Promise<IssueListItem[]>
  createIssue(accountId: AccountId, fullName: string, input: any): Promise<IssueListItem>
  listPRs(accountId: AccountId, fullName: string, opts?: any): Promise<PRListItem[]>
  listAssignedPRs(accountId: AccountId): Promise<PRListItem[]>
  createPR(accountId: AccountId, fullName: string, input: any): Promise<PRListItem>
  mergePR(accountId: AccountId, fullName: string, pull_number: number, opts?: any): Promise<any>
  listWorkflowRuns(accountId: AccountId, fullName: string, opts?: any): Promise<WorkflowRunItem[]>
  listNotifications(accountId: AccountId, opts?: any): Promise<NotificationItem[]>
  markNotificationsRead(accountId: AccountId): Promise<void>
  invalidateCache(accountId?: AccountId): Promise<void>
  // settings / token management (Vite demo only; in Harness these go through settings/credentials)
  getSettings(): GithubSettings
  addAccount(input: { label: string; token: string; baseUrl?: string }): Promise<GithubAccount>
  updateAccount(accountId: AccountId, patch: any): Promise<GithubAccount>
  removeAccount(accountId: AccountId): Promise<void>
  setDefault(accountId: AccountId): Promise<void>
}

// ---- Local (Vite demo) implementation ----

const LS_SETTINGS = 'gh-manager:settings'
const LS_TOKENS = 'gh-manager:tokens' // map accountId -> token (demo only; Harness uses credential store)

function loadSettings(): GithubSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS)
    if (!raw) return structuredClone(DEFAULT_SETTINGS)
    return normalizeSettings(JSON.parse(raw))
  } catch { return structuredClone(DEFAULT_SETTINGS) }
}
function saveSettings(s: GithubSettings): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s))
}
function loadTokens(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_TOKENS) ?? '{}') } catch { return {} }
}
function saveTokens(m: Record<string, string>): void { localStorage.setItem(LS_TOKENS, JSON.stringify(m)) }

function genId(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }

// tiny in-memory cache mirroring host
const cache = new Map<string, { at: number; data: any }>()
const inflight = new Map<string, Promise<any>>()
function ckey(a: string, p: string, q?: unknown): string { return `${a}::${p}::${q ? JSON.stringify(q) : ''}` }
function cached<T>(k: string, ttl: number): T | null { const e = cache.get(k); if (!e) return null; if (Date.now() - e.at > ttl) return null; return e.data as T }
function setCache(k: string, d: any): void { cache.set(k, { at: Date.now(), data: d }); if (cache.size > 400) cache.delete(cache.keys().next().value as string) }
function dedup<T>(k: string, fn: () => Promise<T>): Promise<T> {
  const ex = inflight.get(k); if (ex) return ex as Promise<T>
  const p = fn().finally(() => inflight.delete(k)); inflight.set(k, p); return p
}

class LocalApi implements GithubRemote {
  private rate = new Map<string, RateLimitView>()

  getSettings(): GithubSettings { return loadSettings() }

  async listAccounts(): Promise<{ accountIds: string[]; defaultAccountId: string; accounts: GithubAccount[] }> {
    const s = loadSettings()
    return { accountIds: s.accounts.map(a => a.id), defaultAccountId: s.defaultAccountId, accounts: s.accounts }
  }

  private tokenFor(id: string): { token: string; baseUrl?: string } {
    const s = loadSettings()
    const t = loadTokens()[id]
    if (!t) throw new Error(`Kein Token für Account ${id}`)
    return { token: t, baseUrl: s.perAccount[id]?.baseUrl }
  }

  async getStatus(accountId: string): Promise<AccountStatus> {
    try {
      const { token, baseUrl } = this.tokenFor(accountId)
      const v = await validateToken(token, baseUrl)
      const r: RateLimitView | undefined = v.rate ? { remaining: v.rate.remaining, limit: v.rate.limit, resetAt: new Date(v.rate.reset * 1000).toISOString(), used: v.rate.limit - v.rate.remaining, resource: 'core' } as RateLimitView : undefined
      if (r) this.rate.set(accountId, r)
      return { accountId, login: v.viewer.login, ok: true, rate: r, scopes: v.scopes }
    } catch (e: any) {
      return { accountId, login: '', ok: false, message: String(e?.message ?? e) }
    }
  }

  async getRateLimit(accountId: string): Promise<RateLimitView | null> {
    const { token, baseUrl } = this.tokenFor(accountId)
    const r = await ghFetch<any>('/rate_limit', { token, baseUrl })
    const core = r.data.resources?.core ?? r.data.rate ?? {}
    const view: RateLimitView = { remaining: core.remaining ?? 0, limit: core.limit ?? 5000, resetAt: new Date((core.reset ?? Date.now() / 1000) * 1000).toISOString(), used: (core.limit ?? 0) - (core.remaining ?? 0), resource: 'core' }
    this.rate.set(accountId, view)
    return view
  }

  async getDashboard(accountId: string, loginHint: string): Promise<DashboardSnapshot> {
    const k = ckey(accountId, '__dashboard__')
    const hit = cached<DashboardSnapshot>(k, 45_000)
    if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const fetchRepos = async (): Promise<RepoListItem[]> => {
        const r = await ghFetch<any[]>('/user/repos', { token, baseUrl, query: { per_page: 30, sort: 'pushed', affiliation: 'owner,collaborator,organization_member' } })
        const rem = r.headers.get('x-ratelimit-remaining'); const lim = r.headers.get('x-ratelimit-limit'); const rst = r.headers.get('x-ratelimit-reset')
        if (rem && lim && rst) this.rate.set(accountId, { remaining: Number(rem), limit: Number(lim), resetAt: new Date(Number(rst) * 1000).toISOString(), used: Number(lim) - Number(rem), resource: 'core' })
        return r.data.map((x: any) => ({ id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private, stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null, pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main' }))
      }
      const fetchIssues = async (): Promise<IssueListItem[]> => {
        const r = await ghFetch<any[]>('/issues', { token, baseUrl, query: { state: 'open', per_page: 20, filter: 'assigned' } })
        return r.data.filter((x: any) => !x.pull_request).map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at }))
      }
      const fetchPRs = async (): Promise<PRListItem[]> => {
        try {
          const r = await ghFetch<any>('/search/issues', { token, baseUrl, query: { q: 'is:pr is:open author:@me', per_page: 15 } })
          return (r.data.items ?? []).map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: 'open' as const, merged: false, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }))
        } catch { return [] }
      }
      const fetchNotifs = async (): Promise<NotificationItem[]> => {
        const r = await ghFetch<any[]>('/notifications', { token, baseUrl, query: { per_page: 20 } })
        return r.data.map((x: any) => ({ id: String(x.id), reason: x.reason ?? '', subjectTitle: x.subject?.title ?? '', subjectType: x.subject?.type ?? '', repo: x.repository?.full_name ?? '', unread: !!x.unread, updatedAt: x.updated_at ?? new Date().toISOString(), url: x.subject?.url ?? '' }))
      }
      const [repos, issues, prs, notifications] = await Promise.allSettled([fetchRepos(), fetchIssues(), fetchPRs(), fetchNotifs()])
      let runs: WorkflowRunItem[] = []
      const top = repos.status === 'fulfilled' ? repos.value[0] : undefined
      if (top) {
        try {
          const r = await ghFetch<any>(`/repos/${top.fullName}/actions/runs`, { token, baseUrl, query: { per_page: 8 } })
          runs = (r.data.workflow_runs ?? []).map((x: any) => ({ id: x.id, name: x.name ?? x.display_title ?? 'run', workflowName: x.name ?? '', branch: x.head_branch ?? '', status: x.status ?? '', conclusion: x.conclusion ?? null, createdAt: x.created_at ?? x.run_started_at ?? new Date().toISOString(), htmlUrl: x.html_url ?? '' }))
        } catch {}
      }
      const snap: DashboardSnapshot = {
        accountId, viewerLogin: loginHint,
        repos: repos.status === 'fulfilled' ? repos.value : [],
        issues: issues.status === 'fulfilled' ? issues.value : [],
        prs: prs.status === 'fulfilled' ? prs.value : [],
        runs, notifications: notifications.status === 'fulfilled' ? notifications.value : [],
        rate: this.rate.get(accountId) ?? null, fetchedAt: new Date().toISOString(),
      }
      setCache(k, snap)
      return snap
    })
  }

  async listRepos(accountId: string, opts: any = {}): Promise<RepoListItem[]> {
    const k = ckey(accountId, '/user/repos', opts)
    const hit = cached<RepoListItem[]>(k, 30_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const r = await ghFetch<any[]>('/user/repos', { token, baseUrl, query: { per_page: opts.per_page ?? 30, sort: opts.sort ?? 'pushed', affiliation: 'owner,collaborator,organization_member' } })
      const m: RepoListItem[] = r.data.map((x: any) => ({ id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private, stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null, pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main' }))
      setCache(k, m); return m
    })
  }
  async searchRepos(accountId: string, q: string): Promise<RepoListItem[]> {
    const k = ckey(accountId, '/search/repositories', { q })
    const hit = cached<RepoListItem[]>(k, 30_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const r = await ghFetch<any>('/search/repositories', { token, baseUrl, query: { q, per_page: 20 } })
      const m: RepoListItem[] = (r.data.items ?? []).map((x: any) => ({ id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private, stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null, pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main' }))
      setCache(k, m); return m
    })
  }
  async getRepo(accountId: string, fullName: string): Promise<RepoListItem> {
    const { token, baseUrl } = this.tokenFor(accountId)
    const r = await ghFetch<any>(`/repos/${fullName}`, { token, baseUrl })
    return { id: r.data.id, fullName: r.data.full_name, name: r.data.name, owner: r.data.owner?.login ?? '', private: !!r.data.private, stars: r.data.stargazers_count ?? 0, forks: r.data.forks_count ?? 0, language: r.data.language ?? null, pushedAt: r.data.pushed_at ?? new Date().toISOString(), description: r.data.description ?? null, defaultBranch: r.data.default_branch ?? 'main' }
  }
  async listIssues(accountId: string, opts: any = {}): Promise<IssueListItem[]> {
    const k = ckey(accountId, '/issues', opts); const hit = cached<IssueListItem[]>(k, 30_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const r = await ghFetch<any[]>('/issues', { token, baseUrl, query: { state: opts.state ?? 'open', per_page: opts.per_page ?? 20, filter: opts.filter ?? 'assigned' } })
      const m: IssueListItem[] = r.data.filter((x: any) => !x.pull_request).map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at }))
      setCache(k, m); return m
    })
  }
  async listRepoIssues(accountId: string, fullName: string, opts: any = {}): Promise<IssueListItem[]> {
    const k = ckey(accountId, `/repos/${fullName}/issues`, opts); const hit = cached<IssueListItem[]>(k, 30_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const q: Record<string, any> = { state: opts.state ?? 'open', per_page: opts.per_page ?? 20 }
      if (opts.labels) q.labels = opts.labels
      const r = await ghFetch<any[]>(`/repos/${fullName}/issues`, { token, baseUrl, query: q })
      const m: IssueListItem[] = r.data.filter((x: any) => !x.pull_request).map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at }))
      setCache(k, m); return m
    })
  }
  async createIssue(accountId: string, fullName: string, input: any): Promise<IssueListItem> {
    const { token, baseUrl } = this.tokenFor(accountId)
    const r = await ghFetch<any>(`/repos/${fullName}/issues`, { token, baseUrl, method: 'POST', body: input })
    for (const k of [...cache.keys()]) if (k.includes(`/repos/${fullName}/issues`)) cache.delete(k)
    const x = r.data
    return { id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at }
  }
  async listPRs(accountId: string, fullName: string, opts: any = {}): Promise<PRListItem[]> {
    const k = ckey(accountId, `/repos/${fullName}/pulls`, opts); const hit = cached<PRListItem[]>(k, 30_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const r = await ghFetch<any[]>(`/repos/${fullName}/pulls`, { token, baseUrl, query: { state: opts.state ?? 'open', per_page: opts.per_page ?? 20 } })
      const m: PRListItem[] = r.data.map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: x.state, merged: !!x.merged_at, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }))
      setCache(k, m); return m
    })
  }
  async listAssignedPRs(accountId: string): Promise<PRListItem[]> {
    const k = ckey(accountId, '/search/issues:prs', {}); const hit = cached<PRListItem[]>(k, 30_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      try {
        const r = await ghFetch<any>('/search/issues', { token, baseUrl, query: { q: 'is:pr is:open author:@me', per_page: 15 } })
        const m: PRListItem[] = (r.data.items ?? []).map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: 'open' as const, merged: false, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }))
        setCache(k, m); return m
      } catch { return [] }
    })
  }
  async createPR(accountId: string, fullName: string, input: any): Promise<PRListItem> {
    const { token, baseUrl } = this.tokenFor(accountId)
    const r = await ghFetch<any>(`/repos/${fullName}/pulls`, { token, baseUrl, method: 'POST', body: input })
    for (const k of [...cache.keys()]) if (k.includes(`/repos/${fullName}/pulls`)) cache.delete(k)
    const x = r.data
    return { id: x.id, number: x.number, title: x.title, state: x.state, merged: false, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }
  }
  async mergePR(accountId: string, fullName: string, pull_number: number, opts: any = {}): Promise<any> {
    const { token, baseUrl } = this.tokenFor(accountId)
    const r = await ghFetch<any>(`/repos/${fullName}/pulls/${pull_number}/merge`, { token, baseUrl, method: 'PUT', body: opts })
    for (const k of [...cache.keys()]) if (k.includes(`/repos/${fullName}/pulls`)) cache.delete(k)
    return r.data
  }
  async listWorkflowRuns(accountId: string, fullName: string, opts: any = {}): Promise<WorkflowRunItem[]> {
    const k = ckey(accountId, `/repos/${fullName}/actions/runs`, opts); const hit = cached<WorkflowRunItem[]>(k, 30_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const q: Record<string, any> = { per_page: opts.per_page ?? 15 }
      if (opts.branch) q.branch = opts.branch
      const r = await ghFetch<any>(`/repos/${fullName}/actions/runs`, { token, baseUrl, query: q })
      const m: WorkflowRunItem[] = (r.data.workflow_runs ?? []).map((x: any) => ({ id: x.id, name: x.name ?? x.display_title ?? 'run', workflowName: x.name ?? '', branch: x.head_branch ?? '', status: x.status ?? '', conclusion: x.conclusion ?? null, createdAt: x.created_at ?? x.run_started_at ?? new Date().toISOString(), htmlUrl: x.html_url ?? '' }))
      setCache(k, m); return m
    })
  }
  async listNotifications(accountId: string, opts: any = {}): Promise<NotificationItem[]> {
    const k = ckey(accountId, '/notifications', opts); const hit = cached<NotificationItem[]>(k, 20_000); if (hit) return hit
    return dedup(k, async () => {
      const { token, baseUrl } = this.tokenFor(accountId)
      const r = await ghFetch<any[]>('/notifications', { token, baseUrl, query: { per_page: opts.per_page ?? 20 } })
      const m: NotificationItem[] = r.data.map((x: any) => ({ id: String(x.id), reason: x.reason ?? '', subjectTitle: x.subject?.title ?? '', subjectType: x.subject?.type ?? '', repo: x.repository?.full_name ?? '', unread: !!x.unread, updatedAt: x.updated_at ?? new Date().toISOString(), url: x.subject?.url ?? '' }))
      setCache(k, m); return m
    })
  }
  async markNotificationsRead(accountId: string): Promise<void> {
    const { token, baseUrl } = this.tokenFor(accountId)
    await ghFetch<any>('/notifications', { token, baseUrl, method: 'PUT', body: {} })
  }
  async invalidateCache(accountId?: string): Promise<void> {
    if (accountId) { for (const k of [...cache.keys()]) if (k.startsWith(`${accountId}::`)) cache.delete(k) }
    else cache.clear()
  }
  async addAccount(input: { label: string; token: string; baseUrl?: string }): Promise<GithubAccount> {
    const tok = input.token.trim()
    if (!tok) throw new Error('Token leer')
    const v = await validateToken(tok, input.baseUrl)
    const id = genId()
    const acct: GithubAccount = { id, label: input.label || v.viewer.login, authKind: 'pat', login: v.viewer.login, avatarUrl: v.viewer.avatar_url, scopes: v.scopes, createdAt: new Date().toISOString(), lastValidatedAt: new Date().toISOString(), lastValidatedOk: true }
    const s = loadSettings()
    const next: GithubSettings = { ...s, accounts: [...s.accounts, acct], defaultAccountId: s.defaultAccountId || id, perAccount: { ...s.perAccount, [id]: { baseUrl: input.baseUrl } } }
    saveSettings(next)
    const tokens = loadTokens(); tokens[id] = tok; saveTokens(tokens)
    return acct
  }
  async updateAccount(accountId: string, patch: any): Promise<GithubAccount> {
    const s = loadSettings()
    const idx = s.accounts.findIndex(a => a.id === accountId)
    if (idx < 0) throw new Error('Account nicht gefunden')
    let login = s.accounts[idx]!.login, avatarUrl = s.accounts[idx]!.avatarUrl, scopes = s.accounts[idx]!.scopes
    if (patch.token) {
      const v = await validateToken(patch.token.trim(), patch.baseUrl ?? s.perAccount[accountId]?.baseUrl)
      login = v.viewer.login; avatarUrl = v.viewer.avatar_url; scopes = v.scopes
      const tokens = loadTokens(); tokens[accountId] = patch.token.trim(); saveTokens(tokens)
    }
    const updated: GithubAccount = { ...s.accounts[idx]!, ...(patch.label !== undefined ? { label: patch.label } : {}), login, avatarUrl, scopes, lastValidatedAt: new Date().toISOString(), lastValidatedOk: true }
    const accounts = [...s.accounts]; accounts[idx] = updated
    const perAccount = { ...s.perAccount, [accountId]: { ...(s.perAccount[accountId] ?? {}), ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}) } }
    const next: GithubSettings = { ...s, accounts, perAccount }
    saveSettings(next)
    return updated
  }
  async removeAccount(accountId: string): Promise<void> {
    const s = loadSettings()
    const accounts = s.accounts.filter(a => a.id !== accountId)
    const perAccount = { ...s.perAccount }; delete perAccount[accountId]
    const defaultAccountId = s.defaultAccountId === accountId ? (accounts[0]?.id ?? '') : s.defaultAccountId
    saveSettings({ ...s, accounts, perAccount, defaultAccountId })
    const tokens = loadTokens(); delete tokens[accountId]; saveTokens(tokens)
    for (const k of [...cache.keys()]) if (k.startsWith(`${accountId}::`)) cache.delete(k)
  }
  async setDefault(accountId: string): Promise<void> {
    const s = loadSettings()
    if (!s.accounts.some(a => a.id === accountId)) throw new Error('Account nicht gefunden')
    saveSettings({ ...s, defaultAccountId: accountId })
  }
}

let viteSingleton: LocalApi | null = null
export function getViteApi(): LocalApi {
  if (!viteSingleton) viteSingleton = new LocalApi()
  return viteSingleton
}

/** Build the cordis-backed remote (when ctx.remote.githubManager exists). */
export function cordisRemote(ctx: any): GithubRemote {
  const r: any = ctx?.remote?.githubManager ?? ctx?.remote
  // If harness remote is present, wrap it; otherwise fall back to vite api (so embeds still preview)
  if (r && typeof r.getDashboard === 'function') {
    // Adapt shape — cordis remote already exposes everything
    // but listAccounts may return only ids; we normalize
    const wrap: GithubRemote = {
      async listAccounts() {
        const res: any = await r.listAccounts()
        // If cordis returns only ids, fetch full settings via describe mirror?
        // We fallback to vite settings for full objects when in vite
        if (res.accounts) return res
        // Try to hydrate from local (vite) — for harness it's expected the host returns full
        const local = loadSettings()
        return { accountIds: res.accountIds ?? [], defaultAccountId: res.defaultAccountId ?? '', accounts: local.accounts }
      },
      getStatus: (id: string) => r.getStatus(id),
      getRateLimit: (id: string) => r.getRateLimit(id),
      getDashboard: (id: string, hint: string) => r.getDashboard(id, hint),
      listRepos: (id: string, opts?: any) => r.listRepos(id, opts),
      searchRepos: (id: string, q: string) => r.searchRepos(id, q),
      getRepo: (id: string, full: string) => r.getRepo(id, full),
      listIssues: (id: string, opts?: any) => r.listIssues(id, opts),
      listRepoIssues: (id: string, full: string, opts?: any) => r.listRepoIssues(id, full, opts),
      createIssue: (id: string, full: string, input: any) => r.createIssue(id, full, input),
      listPRs: (id: string, full: string, opts?: any) => r.listPRs(id, full, opts),
      listAssignedPRs: (id: string) => r.listAssignedPRs(id),
      createPR: (id: string, full: string, input: any) => r.createPR(id, full, input),
      mergePR: (id: string, full: string, n: number, opts?: any) => r.mergePR(id, full, n, opts),
      listWorkflowRuns: (id: string, full: string, opts?: any) => r.listWorkflowRuns(id, full, opts),
      listNotifications: (id: string, opts?: any) => r.listNotifications(id, opts),
      markNotificationsRead: (id: string) => r.markNotificationsRead(id),
      invalidateCache: (id?: string) => r.invalidateCache(id),
      getSettings: () => loadSettings(),
      addAccount: (input: any) => getViteApi().addAccount(input),
      updateAccount: (id: string, patch: any) => getViteApi().updateAccount(id, patch),
      removeAccount: (id: string) => getViteApi().removeAccount(id),
      setDefault: (id: string) => getViteApi().setDefault(id),
    }
    return wrap
  }
  return getViteApi()
}
