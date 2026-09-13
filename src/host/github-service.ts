import { fetch as undiciFetch } from 'undici'
import { ghFetch, validateToken, GhError } from '../shared/github-api.js'
import type { AccountId, DashboardSnapshot, RateLimitView, AccountStatus, RepoListItem, IssueListItem, PRListItem, WorkflowRunItem, NotificationItem, ActionConclusion } from '../shared/types.js'

if (typeof (globalThis as any).fetch === 'undefined') (globalThis as any).fetch = undiciFetch as unknown as typeof fetch

export interface AccountSecret {
  token: string
  baseUrl?: string
}

type CacheEntry<T> = { at: number; data: T; etag?: string }

export class GithubService {
  private cache = new Map<string, CacheEntry<any>>()
  private inflight = new Map<string, Promise<any>>()
  private limitView = new Map<AccountId, RateLimitView>()
  private lastError = new Map<AccountId, string | null>()

  private key(accountId: AccountId, path: string, query?: unknown): string {
    return `${accountId}::${path}::${query ? JSON.stringify(query) : ''}`
  }

  private cached<T>(k: string, ttlMs: number): T | null {
    const e = this.cache.get(k)
    if (!e) return null
    if (Date.now() - e.at > ttlMs) return null
    return e.data as T
  }

  private setCache<T>(k: string, data: T): void {
    this.cache.set(k, { at: Date.now(), data })
    // simple LRU cap
    if (this.cache.size > 500) {
      const first = this.cache.keys().next().value as string
      this.cache.delete(first)
    }
  }

  private dedup<T>(k: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(k)
    if (existing) return existing as Promise<T>
    const p = fn().finally(() => this.inflight.delete(k))
    this.inflight.set(k, p)
    return p
  }

  private trackRate(accountId: AccountId, remaining: number | null, limit: number | null, reset: number | null, resource = 'core'): void {
    if (remaining === null || limit === null || reset === null) return
    const view: RateLimitView = { remaining, limit, resetAt: new Date(reset * 1000).toISOString(), used: limit - remaining, resource }
    this.limitView.set(accountId, view)
  }

  async validate(accountId: AccountId, sec: AccountSecret): Promise<AccountStatus> {
    try {
      const r = await validateToken(sec.token, sec.baseUrl)
      const rate: RateLimitView | undefined = r.rate ? { remaining: r.rate.remaining, limit: r.rate.limit, resetAt: new Date(r.rate.reset * 1000).toISOString(), used: r.rate.limit - r.rate.remaining, resource: 'core' } : undefined
      if (rate) this.limitView.set(accountId, rate)
      this.lastError.set(accountId, null)
      return { accountId, login: r.viewer.login, ok: true, rate, scopes: r.scopes, message: undefined }
    } catch (e: any) {
      const msg = e instanceof GhError ? `${e.status} ${e.body.slice(0, 200)}` : String(e?.message ?? e)
      this.lastError.set(accountId, msg)
      return { accountId, login: '', ok: false, message: msg }
    }
  }

  getRate(accountId: AccountId): RateLimitView | null { return this.limitView.get(accountId) ?? null }

  async listRepos(accountId: AccountId, sec: AccountSecret, opts: { per_page?: number; sort?: string; affiliation?: string } = {}, ttlMs = 45_000): Promise<RepoListItem[]> {
    const k = this.key(accountId, '/user/repos', opts)
    const hit = this.cached<RepoListItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const r = await ghFetch<any[]>('/user/repos', { token: sec.token, baseUrl: sec.baseUrl, query: { per_page: opts.per_page ?? 30, sort: opts.sort ?? 'pushed', affiliation: opts.affiliation ?? 'owner,collaborator,organization_member' } })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
      const mapped: RepoListItem[] = r.data.map((x: any) => ({
        id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private,
        stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null,
        pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main',
      }))
      this.setCache(k, mapped)
      return mapped
    })
  }

  async searchRepos(accountId: AccountId, sec: AccountSecret, q: string, per_page = 20, ttlMs = 30_000): Promise<RepoListItem[]> {
    const k = this.key(accountId, '/search/repositories', { q, per_page })
    const hit = this.cached<RepoListItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const r = await ghFetch<any>('/search/repositories', { token: sec.token, baseUrl: sec.baseUrl, query: { q, per_page } })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset, 'search')
      const mapped: RepoListItem[] = (r.data.items ?? []).map((x: any) => ({
        id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private, stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null, pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main',
      }))
      this.setCache(k, mapped)
      return mapped
    })
  }

  async getRepo(accountId: AccountId, sec: AccountSecret, fullName: string, ttlMs = 30_000): Promise<RepoListItem> {
    const k = this.key(accountId, `/repos/${fullName}`)
    const hit = this.cached<RepoListItem>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const r = await ghFetch<any>(`/repos/${fullName}`, { token: sec.token, baseUrl: sec.baseUrl })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
      const x = r.data
      const mapped: RepoListItem = { id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private, stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null, pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main' }
      this.setCache(k, mapped)
      return mapped
    })
  }

  async listIssues(accountId: AccountId, sec: AccountSecret, opts: { state?: string; per_page?: number; filter?: string } = {}, ttlMs = 30_000): Promise<IssueListItem[]> {
    const k = this.key(accountId, '/issues', opts)
    const hit = this.cached<IssueListItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const r = await ghFetch<any[]>('/issues', { token: sec.token, baseUrl: sec.baseUrl, query: { state: opts.state ?? 'open', per_page: opts.per_page ?? 20, filter: opts.filter ?? 'assigned' } })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
      const mapped: IssueListItem[] = r.data.filter((x: any) => !x.pull_request).map((x: any) => ({
        id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at,
      }))
      this.setCache(k, mapped)
      return mapped
    })
  }

  async listRepoIssues(accountId: AccountId, sec: AccountSecret, fullName: string, opts: { state?: string; per_page?: number; labels?: string } = {}, ttlMs = 30_000): Promise<IssueListItem[]> {
    const k = this.key(accountId, `/repos/${fullName}/issues`, opts)
    const hit = this.cached<IssueListItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const q: Record<string, any> = { state: opts.state ?? 'open', per_page: opts.per_page ?? 20 }
      if (opts.labels) q.labels = opts.labels
      const r = await ghFetch<any[]>(`/repos/${fullName}/issues`, { token: sec.token, baseUrl: sec.baseUrl, query: q })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
      const mapped: IssueListItem[] = r.data.filter((x: any) => !x.pull_request).map((x: any) => ({
        id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at,
      }))
      this.setCache(k, mapped)
      return mapped
    })
  }

  async createIssue(accountId: AccountId, sec: AccountSecret, fullName: string, input: { title: string; body?: string; labels?: string[]; assignees?: string[] }): Promise<IssueListItem> {
    const r = await ghFetch<any>(`/repos/${fullName}/issues`, { token: sec.token, baseUrl: sec.baseUrl, method: 'POST', body: input })
    this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
    const x = r.data
    // bust repo issues cache
    for (const k of [...this.cache.keys()]) if (k.includes(`/repos/${fullName}/issues`)) this.cache.delete(k)
    return { id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at }
  }

  async listPRs(accountId: AccountId, sec: AccountSecret, fullName: string, opts: { state?: string; per_page?: number } = {}, ttlMs = 30_000): Promise<PRListItem[]> {
    const k = this.key(accountId, `/repos/${fullName}/pulls`, opts)
    const hit = this.cached<PRListItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const r = await ghFetch<any[]>(`/repos/${fullName}/pulls`, { token: sec.token, baseUrl: sec.baseUrl, query: { state: opts.state ?? 'open', per_page: opts.per_page ?? 20 } })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
      const mapped: PRListItem[] = r.data.map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: x.state, merged: !!x.merged_at, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }))
      this.setCache(k, mapped)
      return mapped
    })
  }

  async listAssignedPRs(accountId: AccountId, sec: AccountSecret, per_page = 20, ttlMs = 30_000): Promise<PRListItem[]> {
    // Use search API: author:me or assignee:me — fallback to /issues with pull_request present
    const k = this.key(accountId, '/search/issues', { q: 'is:pr is:open', per_page })
    const hit = this.cached<PRListItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      try {
        const r = await ghFetch<any>('/search/issues', { token: sec.token, baseUrl: sec.baseUrl, query: { q: 'is:pr is:open author:@me', per_page } })
        this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset, 'search')
        const mapped: PRListItem[] = (r.data.items ?? []).slice(0, per_page).map((x: any) => ({ id: x.id, number: x.number, title: x.title, state: x.state === 'closed' ? 'closed' : 'open', merged: false, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }))
        this.setCache(k, mapped)
        return mapped
      } catch {
        return []
      }
    })
  }

  async createPR(accountId: AccountId, sec: AccountSecret, fullName: string, input: { title: string; head: string; base: string; body?: string; draft?: boolean }): Promise<PRListItem> {
    const r = await ghFetch<any>(`/repos/${fullName}/pulls`, { token: sec.token, baseUrl: sec.baseUrl, method: 'POST', body: input })
    this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
    const x = r.data
    for (const k of [...this.cache.keys()]) if (k.includes(`/repos/${fullName}/pulls`)) this.cache.delete(k)
    return { id: x.id, number: x.number, title: x.title, state: x.state, merged: false, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l: any) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }
  }

  async mergePR(accountId: AccountId, sec: AccountSecret, fullName: string, pull_number: number, opts: { merge_method?: string; commit_title?: string } = {}): Promise<any> {
    const r = await ghFetch<any>(`/repos/${fullName}/pulls/${pull_number}/merge`, { token: sec.token, baseUrl: sec.baseUrl, method: 'PUT', body: opts })
    this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
    for (const k of [...this.cache.keys()]) if (k.includes(`/repos/${fullName}/pulls`)) this.cache.delete(k)
    return r.data
  }

  async listWorkflowRuns(accountId: AccountId, sec: AccountSecret, fullName: string, opts: { per_page?: number; branch?: string } = {}, ttlMs = 30_000): Promise<WorkflowRunItem[]> {
    const k = this.key(accountId, `/repos/${fullName}/actions/runs`, opts)
    const hit = this.cached<WorkflowRunItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const q: Record<string, any> = { per_page: opts.per_page ?? 15 }
      if (opts.branch) q.branch = opts.branch
      const r = await ghFetch<any>(`/repos/${fullName}/actions/runs`, { token: sec.token, baseUrl: sec.baseUrl, query: q })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
      const mapped: WorkflowRunItem[] = (r.data.workflow_runs ?? []).map((x: any) => ({ id: x.id, name: x.name ?? x.display_title ?? 'run', workflowName: x.name ?? '', branch: x.head_branch ?? '', status: x.status ?? '', conclusion: (x.conclusion ?? null) as ActionConclusion, createdAt: x.created_at ?? x.run_started_at ?? new Date().toISOString(), htmlUrl: x.html_url ?? '' }))
      this.setCache(k, mapped)
      return mapped
    })
  }

  async listNotifications(accountId: AccountId, sec: AccountSecret, opts: { all?: boolean; per_page?: number } = {}, ttlMs = 20_000): Promise<NotificationItem[]> {
    const k = this.key(accountId, '/notifications', opts)
    const hit = this.cached<NotificationItem[]>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const r = await ghFetch<any[]>('/notifications', { token: sec.token, baseUrl: sec.baseUrl, query: { all: opts.all ? 'false' : undefined, per_page: opts.per_page ?? 20 } })
      this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset)
      const mapped: NotificationItem[] = r.data.map((x: any) => ({ id: String(x.id), reason: x.reason ?? '', subjectTitle: x.subject?.title ?? '', subjectType: x.subject?.type ?? '', repo: x.repository?.full_name ?? '', unread: !!x.unread, updatedAt: x.updated_at ?? new Date().toISOString(), url: x.subject?.url ?? '' }))
      this.setCache(k, mapped)
      return mapped
    })
  }

  async markNotificationsRead(accountId: AccountId, sec: AccountSecret): Promise<void> {
    await ghFetch<any>('/notifications', { token: sec.token, baseUrl: sec.baseUrl, method: 'PUT', body: {} })
  }

  async getRateLimit(accountId: AccountId, sec: AccountSecret): Promise<RateLimitView> {
    const r = await ghFetch<any>('/rate_limit', { token: sec.token, baseUrl: sec.baseUrl })
    const core = r.data.resources?.core ?? r.data.rate ?? {}
    const view: RateLimitView = { remaining: core.remaining ?? 0, limit: core.limit ?? 5000, resetAt: new Date((core.reset ?? Date.now() / 1000) * 1000).toISOString(), used: (core.limit ?? 0) - (core.remaining ?? 0), resource: 'core' }
    this.limitView.set(accountId, view)
    return view
  }

  async dashboard(accountId: AccountId, sec: AccountSecret, loginHint: string, ttlMs = 45_000): Promise<DashboardSnapshot> {
    const k = this.key(accountId, '__dashboard__')
    const hit = this.cached<DashboardSnapshot>(k, ttlMs)
    if (hit) return hit
    return this.dedup(k, async () => {
      const [repos, issues, prs, notifications, rate] = await Promise.allSettled([
        this.listRepos(accountId, sec, { per_page: 30 }, ttlMs),
        this.listIssues(accountId, sec, { per_page: 20 }, ttlMs),
        this.listAssignedPRs(accountId, sec, 15, ttlMs),
        this.listNotifications(accountId, sec, { per_page: 20 }, ttlMs),
        this.getRateLimit(accountId, sec).catch(() => this.getRate(accountId)),
      ])
      const runs: WorkflowRunItem[] = []
      // opportunistically fetch Actions for the most recently pushed repo
      const topRepo = repos.status === 'fulfilled' ? repos.value[0] : undefined
      if (topRepo) {
        try { runs.push(...await this.listWorkflowRuns(accountId, sec, topRepo.fullName, { per_page: 8 }, ttlMs)) } catch {}
      }
      const snap: DashboardSnapshot = {
        accountId,
        viewerLogin: loginHint,
        repos: repos.status === 'fulfilled' ? repos.value : [],
        issues: issues.status === 'fulfilled' ? issues.value : [],
        prs: prs.status === 'fulfilled' ? prs.value : [],
        runs,
        notifications: notifications.status === 'fulfilled' ? notifications.value : [],
        rate: rate.status === 'fulfilled' ? (rate.value as RateLimitView | null) : this.getRate(accountId),
        fetchedAt: new Date().toISOString(),
      }
      this.setCache(k, snap)
      return snap
    })
  }

  bust(accountId: AccountId): void {
    for (const k of [...this.cache.keys()]) if (k.startsWith(`${accountId}::`)) this.cache.delete(k)
  }
  bustAll(): void { this.cache.clear() }
}
