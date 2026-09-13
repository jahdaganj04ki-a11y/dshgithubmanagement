import { fetch as undiciFetch } from 'undici';
import { ghFetch, validateToken, GhError } from '../shared/github-api.js';
if (typeof globalThis.fetch === 'undefined')
    globalThis.fetch = undiciFetch;
export class GithubService {
    cache = new Map();
    inflight = new Map();
    limitView = new Map();
    lastError = new Map();
    key(accountId, path, query) {
        return `${accountId}::${path}::${query ? JSON.stringify(query) : ''}`;
    }
    cached(k, ttlMs) {
        const e = this.cache.get(k);
        if (!e)
            return null;
        if (Date.now() - e.at > ttlMs)
            return null;
        return e.data;
    }
    setCache(k, data) {
        this.cache.set(k, { at: Date.now(), data });
        // simple LRU cap
        if (this.cache.size > 500) {
            const first = this.cache.keys().next().value;
            this.cache.delete(first);
        }
    }
    dedup(k, fn) {
        const existing = this.inflight.get(k);
        if (existing)
            return existing;
        const p = fn().finally(() => this.inflight.delete(k));
        this.inflight.set(k, p);
        return p;
    }
    trackRate(accountId, remaining, limit, reset, resource = 'core') {
        if (remaining === null || limit === null || reset === null)
            return;
        const view = { remaining, limit, resetAt: new Date(reset * 1000).toISOString(), used: limit - remaining, resource };
        this.limitView.set(accountId, view);
    }
    async validate(accountId, sec) {
        try {
            const r = await validateToken(sec.token, sec.baseUrl);
            const rate = r.rate ? { remaining: r.rate.remaining, limit: r.rate.limit, resetAt: new Date(r.rate.reset * 1000).toISOString(), used: r.rate.limit - r.rate.remaining, resource: 'core' } : undefined;
            if (rate)
                this.limitView.set(accountId, rate);
            this.lastError.set(accountId, null);
            return { accountId, login: r.viewer.login, ok: true, rate, scopes: r.scopes, message: undefined };
        }
        catch (e) {
            const msg = e instanceof GhError ? `${e.status} ${e.body.slice(0, 200)}` : String(e?.message ?? e);
            this.lastError.set(accountId, msg);
            return { accountId, login: '', ok: false, message: msg };
        }
    }
    getRate(accountId) { return this.limitView.get(accountId) ?? null; }
    async listRepos(accountId, sec, opts = {}, ttlMs = 45_000) {
        const k = this.key(accountId, '/user/repos', opts);
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const r = await ghFetch('/user/repos', { token: sec.token, baseUrl: sec.baseUrl, query: { per_page: opts.per_page ?? 30, sort: opts.sort ?? 'pushed', affiliation: opts.affiliation ?? 'owner,collaborator,organization_member' } });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
            const mapped = r.data.map((x) => ({
                id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private,
                stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null,
                pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main',
            }));
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async searchRepos(accountId, sec, q, per_page = 20, ttlMs = 30_000) {
        const k = this.key(accountId, '/search/repositories', { q, per_page });
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const r = await ghFetch('/search/repositories', { token: sec.token, baseUrl: sec.baseUrl, query: { q, per_page } });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset, 'search');
            const mapped = (r.data.items ?? []).map((x) => ({
                id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private, stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null, pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main',
            }));
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async getRepo(accountId, sec, fullName, ttlMs = 30_000) {
        const k = this.key(accountId, `/repos/${fullName}`);
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const r = await ghFetch(`/repos/${fullName}`, { token: sec.token, baseUrl: sec.baseUrl });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
            const x = r.data;
            const mapped = { id: x.id, fullName: x.full_name, name: x.name, owner: x.owner?.login ?? '', private: !!x.private, stars: x.stargazers_count ?? 0, forks: x.forks_count ?? 0, language: x.language ?? null, pushedAt: x.pushed_at ?? new Date().toISOString(), description: x.description ?? null, defaultBranch: x.default_branch ?? 'main' };
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async listIssues(accountId, sec, opts = {}, ttlMs = 30_000) {
        const k = this.key(accountId, '/issues', opts);
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const r = await ghFetch('/issues', { token: sec.token, baseUrl: sec.baseUrl, query: { state: opts.state ?? 'open', per_page: opts.per_page ?? 20, filter: opts.filter ?? 'assigned' } });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
            const mapped = r.data.filter((x) => !x.pull_request).map((x) => ({
                id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at,
            }));
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async listRepoIssues(accountId, sec, fullName, opts = {}, ttlMs = 30_000) {
        const k = this.key(accountId, `/repos/${fullName}/issues`, opts);
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const q = { state: opts.state ?? 'open', per_page: opts.per_page ?? 20 };
            if (opts.labels)
                q.labels = opts.labels;
            const r = await ghFetch(`/repos/${fullName}/issues`, { token: sec.token, baseUrl: sec.baseUrl, query: q });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
            const mapped = r.data.filter((x) => !x.pull_request).map((x) => ({
                id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at,
            }));
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async createIssue(accountId, sec, fullName, input) {
        const r = await ghFetch(`/repos/${fullName}/issues`, { token: sec.token, baseUrl: sec.baseUrl, method: 'POST', body: input });
        this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
        const x = r.data;
        // bust repo issues cache
        for (const k of [...this.cache.keys()])
            if (k.includes(`/repos/${fullName}/issues`))
                this.cache.delete(k);
        return { id: x.id, number: x.number, title: x.title, state: x.state, user: x.user?.login ?? '', labels: (x.labels ?? []).map((l) => typeof l === 'string' ? l : l.name), assignee: x.assignee?.login ?? null, comments: x.comments ?? 0, createdAt: x.created_at, updatedAt: x.updated_at };
    }
    async listPRs(accountId, sec, fullName, opts = {}, ttlMs = 30_000) {
        const k = this.key(accountId, `/repos/${fullName}/pulls`, opts);
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const r = await ghFetch(`/repos/${fullName}/pulls`, { token: sec.token, baseUrl: sec.baseUrl, query: { state: opts.state ?? 'open', per_page: opts.per_page ?? 20 } });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
            const mapped = r.data.map((x) => ({ id: x.id, number: x.number, title: x.title, state: x.state, merged: !!x.merged_at, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }));
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async listAssignedPRs(accountId, sec, per_page = 20, ttlMs = 30_000) {
        // Use search API: author:me or assignee:me — fallback to /issues with pull_request present
        const k = this.key(accountId, '/search/issues', { q: 'is:pr is:open', per_page });
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            try {
                const r = await ghFetch('/search/issues', { token: sec.token, baseUrl: sec.baseUrl, query: { q: 'is:pr is:open author:@me', per_page } });
                this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset, 'search');
                const mapped = (r.data.items ?? []).slice(0, per_page).map((x) => ({ id: x.id, number: x.number, title: x.title, state: x.state === 'closed' ? 'closed' : 'open', merged: false, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at }));
                this.setCache(k, mapped);
                return mapped;
            }
            catch {
                return [];
            }
        });
    }
    async createPR(accountId, sec, fullName, input) {
        const r = await ghFetch(`/repos/${fullName}/pulls`, { token: sec.token, baseUrl: sec.baseUrl, method: 'POST', body: input });
        this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
        const x = r.data;
        for (const k of [...this.cache.keys()])
            if (k.includes(`/repos/${fullName}/pulls`))
                this.cache.delete(k);
        return { id: x.id, number: x.number, title: x.title, state: x.state, merged: false, user: x.user?.login ?? '', draft: !!x.draft, labels: (x.labels ?? []).map((l) => typeof l === 'string' ? l : l.name), createdAt: x.created_at, updatedAt: x.updated_at };
    }
    async mergePR(accountId, sec, fullName, pull_number, opts = {}) {
        const r = await ghFetch(`/repos/${fullName}/pulls/${pull_number}/merge`, { token: sec.token, baseUrl: sec.baseUrl, method: 'PUT', body: opts });
        this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
        for (const k of [...this.cache.keys()])
            if (k.includes(`/repos/${fullName}/pulls`))
                this.cache.delete(k);
        return r.data;
    }
    async listWorkflowRuns(accountId, sec, fullName, opts = {}, ttlMs = 30_000) {
        const k = this.key(accountId, `/repos/${fullName}/actions/runs`, opts);
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const q = { per_page: opts.per_page ?? 15 };
            if (opts.branch)
                q.branch = opts.branch;
            const r = await ghFetch(`/repos/${fullName}/actions/runs`, { token: sec.token, baseUrl: sec.baseUrl, query: q });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
            const mapped = (r.data.workflow_runs ?? []).map((x) => ({ id: x.id, name: x.name ?? x.display_title ?? 'run', workflowName: x.name ?? '', branch: x.head_branch ?? '', status: x.status ?? '', conclusion: (x.conclusion ?? null), createdAt: x.created_at ?? x.run_started_at ?? new Date().toISOString(), htmlUrl: x.html_url ?? '' }));
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async listNotifications(accountId, sec, opts = {}, ttlMs = 20_000) {
        const k = this.key(accountId, '/notifications', opts);
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const r = await ghFetch('/notifications', { token: sec.token, baseUrl: sec.baseUrl, query: { all: opts.all ? 'false' : undefined, per_page: opts.per_page ?? 20 } });
            this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
            const mapped = r.data.map((x) => ({ id: String(x.id), reason: x.reason ?? '', subjectTitle: x.subject?.title ?? '', subjectType: x.subject?.type ?? '', repo: x.repository?.full_name ?? '', unread: !!x.unread, updatedAt: x.updated_at ?? new Date().toISOString(), url: x.subject?.url ?? '' }));
            this.setCache(k, mapped);
            return mapped;
        });
    }
    async markNotificationsRead(accountId, sec) {
        await ghFetch('/notifications', { token: sec.token, baseUrl: sec.baseUrl, method: 'PUT', body: {} });
    }
    async getRateLimit(accountId, sec) {
        const r = await ghFetch('/rate_limit', { token: sec.token, baseUrl: sec.baseUrl });
        const core = r.data.resources?.core ?? r.data.rate ?? {};
        const view = { remaining: core.remaining ?? 0, limit: core.limit ?? 5000, resetAt: new Date((core.reset ?? Date.now() / 1000) * 1000).toISOString(), used: (core.limit ?? 0) - (core.remaining ?? 0), resource: 'core' };
        this.limitView.set(accountId, view);
        return view;
    }
    async dashboard(accountId, sec, loginHint, ttlMs = 45_000) {
        const k = this.key(accountId, '__dashboard__');
        const hit = this.cached(k, ttlMs);
        if (hit)
            return hit;
        return this.dedup(k, async () => {
            const [repos, issues, prs, notifications, rate] = await Promise.allSettled([
                this.listRepos(accountId, sec, { per_page: 30 }, ttlMs),
                this.listIssues(accountId, sec, { per_page: 20 }, ttlMs),
                this.listAssignedPRs(accountId, sec, 15, ttlMs),
                this.listNotifications(accountId, sec, { per_page: 20 }, ttlMs),
                this.getRateLimit(accountId, sec).catch(() => this.getRate(accountId)),
            ]);
            const runs = [];
            // opportunistically fetch Actions for the most recently pushed repo
            const topRepo = repos.status === 'fulfilled' ? repos.value[0] : undefined;
            if (topRepo) {
                try {
                    runs.push(...await this.listWorkflowRuns(accountId, sec, topRepo.fullName, { per_page: 8 }, ttlMs));
                }
                catch { }
            }
            const snap = {
                accountId,
                viewerLogin: loginHint,
                repos: repos.status === 'fulfilled' ? repos.value : [],
                issues: issues.status === 'fulfilled' ? issues.value : [],
                prs: prs.status === 'fulfilled' ? prs.value : [],
                runs,
                notifications: notifications.status === 'fulfilled' ? notifications.value : [],
                rate: rate.status === 'fulfilled' ? rate.value : this.getRate(accountId),
                fetchedAt: new Date().toISOString(),
            };
            this.setCache(k, snap);
            return snap;
        });
    }
    bust(accountId) {
        for (const k of [...this.cache.keys()])
            if (k.startsWith(`${accountId}::`))
                this.cache.delete(k);
    }
    bustAll() { this.cache.clear(); }
}
//# sourceMappingURL=github-service.js.map