import { n as ghFetch, r as validateToken, t as GhError } from "./github-api-DNUzHzdt.js";
import { createRequire } from "node:module";
import { fetch as fetch$1 } from "undici";

//#region rolldown:runtime
var __require = /* @__PURE__ */ createRequire(import.meta.url);

//#endregion
//#region src/host/github-service.ts
if (typeof globalThis.fetch === "undefined") globalThis.fetch = fetch$1;
var GithubService = class {
	cache = /* @__PURE__ */ new Map();
	inflight = /* @__PURE__ */ new Map();
	limitView = /* @__PURE__ */ new Map();
	lastError = /* @__PURE__ */ new Map();
	key(accountId, path, query) {
		return `${accountId}::${path}::${query ? JSON.stringify(query) : ""}`;
	}
	cached(k, ttlMs) {
		const e = this.cache.get(k);
		if (!e) return null;
		if (Date.now() - e.at > ttlMs) return null;
		return e.data;
	}
	setCache(k, data) {
		this.cache.set(k, {
			at: Date.now(),
			data
		});
		if (this.cache.size > 500) {
			const first = this.cache.keys().next().value;
			this.cache.delete(first);
		}
	}
	dedup(k, fn) {
		const existing = this.inflight.get(k);
		if (existing) return existing;
		const p = fn().finally(() => this.inflight.delete(k));
		this.inflight.set(k, p);
		return p;
	}
	trackRate(accountId, remaining, limit, reset, resource = "core") {
		if (remaining === null || limit === null || reset === null) return;
		const view = {
			remaining,
			limit,
			resetAt: (/* @__PURE__ */ new Date(reset * 1e3)).toISOString(),
			used: limit - remaining,
			resource
		};
		this.limitView.set(accountId, view);
	}
	async validate(accountId, sec) {
		try {
			const r = await validateToken(sec.token, sec.baseUrl);
			const rate = r.rate ? {
				remaining: r.rate.remaining,
				limit: r.rate.limit,
				resetAt: (/* @__PURE__ */ new Date(r.rate.reset * 1e3)).toISOString(),
				used: r.rate.limit - r.rate.remaining,
				resource: "core"
			} : void 0;
			if (rate) this.limitView.set(accountId, rate);
			this.lastError.set(accountId, null);
			return {
				accountId,
				login: r.viewer.login,
				ok: true,
				rate,
				scopes: r.scopes,
				message: void 0
			};
		} catch (e) {
			const msg = e instanceof GhError ? `${e.status} ${e.body.slice(0, 200)}` : String(e?.message ?? e);
			this.lastError.set(accountId, msg);
			return {
				accountId,
				login: "",
				ok: false,
				message: msg
			};
		}
	}
	getRate(accountId) {
		return this.limitView.get(accountId) ?? null;
	}
	async listRepos(accountId, sec, opts = {}, ttlMs = 45e3) {
		const k = this.key(accountId, "/user/repos", opts);
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const r = await ghFetch("/user/repos", {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: {
					per_page: opts.per_page ?? 30,
					sort: opts.sort ?? "pushed",
					affiliation: opts.affiliation ?? "owner,collaborator,organization_member"
				}
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
			const mapped = r.data.map((x) => ({
				id: x.id,
				fullName: x.full_name,
				name: x.name,
				owner: x.owner?.login ?? "",
				private: !!x.private,
				stars: x.stargazers_count ?? 0,
				forks: x.forks_count ?? 0,
				language: x.language ?? null,
				pushedAt: x.pushed_at ?? (/* @__PURE__ */ new Date()).toISOString(),
				description: x.description ?? null,
				defaultBranch: x.default_branch ?? "main"
			}));
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async searchRepos(accountId, sec, q, per_page = 20, ttlMs = 3e4) {
		const k = this.key(accountId, "/search/repositories", {
			q,
			per_page
		});
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const r = await ghFetch("/search/repositories", {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: {
					q,
					per_page
				}
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset, "search");
			const mapped = (r.data.items ?? []).map((x) => ({
				id: x.id,
				fullName: x.full_name,
				name: x.name,
				owner: x.owner?.login ?? "",
				private: !!x.private,
				stars: x.stargazers_count ?? 0,
				forks: x.forks_count ?? 0,
				language: x.language ?? null,
				pushedAt: x.pushed_at ?? (/* @__PURE__ */ new Date()).toISOString(),
				description: x.description ?? null,
				defaultBranch: x.default_branch ?? "main"
			}));
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async getRepo(accountId, sec, fullName, ttlMs = 3e4) {
		const k = this.key(accountId, `/repos/${fullName}`);
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const r = await ghFetch(`/repos/${fullName}`, {
				token: sec.token,
				baseUrl: sec.baseUrl
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
			const x = r.data;
			const mapped = {
				id: x.id,
				fullName: x.full_name,
				name: x.name,
				owner: x.owner?.login ?? "",
				private: !!x.private,
				stars: x.stargazers_count ?? 0,
				forks: x.forks_count ?? 0,
				language: x.language ?? null,
				pushedAt: x.pushed_at ?? (/* @__PURE__ */ new Date()).toISOString(),
				description: x.description ?? null,
				defaultBranch: x.default_branch ?? "main"
			};
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async listIssues(accountId, sec, opts = {}, ttlMs = 3e4) {
		const k = this.key(accountId, "/issues", opts);
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const r = await ghFetch("/issues", {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: {
					state: opts.state ?? "open",
					per_page: opts.per_page ?? 20,
					filter: opts.filter ?? "assigned"
				}
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
			const mapped = r.data.filter((x) => !x.pull_request).map((x) => ({
				id: x.id,
				number: x.number,
				title: x.title,
				state: x.state,
				user: x.user?.login ?? "",
				labels: (x.labels ?? []).map((l) => typeof l === "string" ? l : l.name),
				assignee: x.assignee?.login ?? null,
				comments: x.comments ?? 0,
				createdAt: x.created_at,
				updatedAt: x.updated_at
			}));
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async listRepoIssues(accountId, sec, fullName, opts = {}, ttlMs = 3e4) {
		const k = this.key(accountId, `/repos/${fullName}/issues`, opts);
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const q = {
				state: opts.state ?? "open",
				per_page: opts.per_page ?? 20
			};
			if (opts.labels) q.labels = opts.labels;
			const r = await ghFetch(`/repos/${fullName}/issues`, {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: q
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
			const mapped = r.data.filter((x) => !x.pull_request).map((x) => ({
				id: x.id,
				number: x.number,
				title: x.title,
				state: x.state,
				user: x.user?.login ?? "",
				labels: (x.labels ?? []).map((l) => typeof l === "string" ? l : l.name),
				assignee: x.assignee?.login ?? null,
				comments: x.comments ?? 0,
				createdAt: x.created_at,
				updatedAt: x.updated_at
			}));
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async createIssue(accountId, sec, fullName, input) {
		const r = await ghFetch(`/repos/${fullName}/issues`, {
			token: sec.token,
			baseUrl: sec.baseUrl,
			method: "POST",
			body: input
		});
		this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
		const x = r.data;
		for (const k of [...this.cache.keys()]) if (k.includes(`/repos/${fullName}/issues`)) this.cache.delete(k);
		return {
			id: x.id,
			number: x.number,
			title: x.title,
			state: x.state,
			user: x.user?.login ?? "",
			labels: (x.labels ?? []).map((l) => typeof l === "string" ? l : l.name),
			assignee: x.assignee?.login ?? null,
			comments: x.comments ?? 0,
			createdAt: x.created_at,
			updatedAt: x.updated_at
		};
	}
	async listPRs(accountId, sec, fullName, opts = {}, ttlMs = 3e4) {
		const k = this.key(accountId, `/repos/${fullName}/pulls`, opts);
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const r = await ghFetch(`/repos/${fullName}/pulls`, {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: {
					state: opts.state ?? "open",
					per_page: opts.per_page ?? 20
				}
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
			const mapped = r.data.map((x) => ({
				id: x.id,
				number: x.number,
				title: x.title,
				state: x.state,
				merged: !!x.merged_at,
				user: x.user?.login ?? "",
				draft: !!x.draft,
				labels: (x.labels ?? []).map((l) => typeof l === "string" ? l : l.name),
				createdAt: x.created_at,
				updatedAt: x.updated_at
			}));
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async listAssignedPRs(accountId, sec, per_page = 20, ttlMs = 3e4) {
		const k = this.key(accountId, "/search/issues", {
			q: "is:pr is:open",
			per_page
		});
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			try {
				const r = await ghFetch("/search/issues", {
					token: sec.token,
					baseUrl: sec.baseUrl,
					query: {
						q: "is:pr is:open author:@me",
						per_page
					}
				});
				this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset, "search");
				const mapped = (r.data.items ?? []).slice(0, per_page).map((x) => ({
					id: x.id,
					number: x.number,
					title: x.title,
					state: x.state === "closed" ? "closed" : "open",
					merged: false,
					user: x.user?.login ?? "",
					draft: !!x.draft,
					labels: (x.labels ?? []).map((l) => typeof l === "string" ? l : l.name),
					createdAt: x.created_at,
					updatedAt: x.updated_at
				}));
				this.setCache(k, mapped);
				return mapped;
			} catch {
				return [];
			}
		});
	}
	async createPR(accountId, sec, fullName, input) {
		const r = await ghFetch(`/repos/${fullName}/pulls`, {
			token: sec.token,
			baseUrl: sec.baseUrl,
			method: "POST",
			body: input
		});
		this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
		const x = r.data;
		for (const k of [...this.cache.keys()]) if (k.includes(`/repos/${fullName}/pulls`)) this.cache.delete(k);
		return {
			id: x.id,
			number: x.number,
			title: x.title,
			state: x.state,
			merged: false,
			user: x.user?.login ?? "",
			draft: !!x.draft,
			labels: (x.labels ?? []).map((l) => typeof l === "string" ? l : l.name),
			createdAt: x.created_at,
			updatedAt: x.updated_at
		};
	}
	async mergePR(accountId, sec, fullName, pull_number, opts = {}) {
		const r = await ghFetch(`/repos/${fullName}/pulls/${pull_number}/merge`, {
			token: sec.token,
			baseUrl: sec.baseUrl,
			method: "PUT",
			body: opts
		});
		this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
		for (const k of [...this.cache.keys()]) if (k.includes(`/repos/${fullName}/pulls`)) this.cache.delete(k);
		return r.data;
	}
	async listWorkflowRuns(accountId, sec, fullName, opts = {}, ttlMs = 3e4) {
		const k = this.key(accountId, `/repos/${fullName}/actions/runs`, opts);
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const q = { per_page: opts.per_page ?? 15 };
			if (opts.branch) q.branch = opts.branch;
			const r = await ghFetch(`/repos/${fullName}/actions/runs`, {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: q
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
			const mapped = (r.data.workflow_runs ?? []).map((x) => ({
				id: x.id,
				name: x.name ?? x.display_title ?? "run",
				workflowName: x.name ?? "",
				branch: x.head_branch ?? "",
				status: x.status ?? "",
				conclusion: x.conclusion ?? null,
				createdAt: x.created_at ?? x.run_started_at ?? (/* @__PURE__ */ new Date()).toISOString(),
				htmlUrl: x.html_url ?? ""
			}));
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async listNotifications(accountId, sec, opts = {}, ttlMs = 2e4) {
		const k = this.key(accountId, "/notifications", opts);
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const r = await ghFetch("/notifications", {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: {
					all: opts.all ? "false" : void 0,
					per_page: opts.per_page ?? 20
				}
			});
			this.trackRate(accountId, r.rateRemaining, r.rateLimit, r.rateReset);
			const mapped = r.data.map((x) => ({
				id: String(x.id),
				reason: x.reason ?? "",
				subjectTitle: x.subject?.title ?? "",
				subjectType: x.subject?.type ?? "",
				repo: x.repository?.full_name ?? "",
				unread: !!x.unread,
				updatedAt: x.updated_at ?? (/* @__PURE__ */ new Date()).toISOString(),
				url: x.subject?.url ?? ""
			}));
			this.setCache(k, mapped);
			return mapped;
		});
	}
	async markNotificationsRead(accountId, sec) {
		await ghFetch("/notifications", {
			token: sec.token,
			baseUrl: sec.baseUrl,
			method: "PUT",
			body: {}
		});
	}
	async getRateLimit(accountId, sec) {
		const r = await ghFetch("/rate_limit", {
			token: sec.token,
			baseUrl: sec.baseUrl
		});
		const core = r.data.resources?.core ?? r.data.rate ?? {};
		const view = {
			remaining: core.remaining ?? 0,
			limit: core.limit ?? 5e3,
			resetAt: (/* @__PURE__ */ new Date((core.reset ?? Date.now() / 1e3) * 1e3)).toISOString(),
			used: (core.limit ?? 0) - (core.remaining ?? 0),
			resource: "core"
		};
		this.limitView.set(accountId, view);
		return view;
	}
	async dashboard(accountId, sec, loginHint, ttlMs = 45e3) {
		const k = this.key(accountId, "__dashboard__");
		const hit = this.cached(k, ttlMs);
		if (hit) return hit;
		return this.dedup(k, async () => {
			const [repos, issues, prs, notifications, rate] = await Promise.allSettled([
				this.listRepos(accountId, sec, { per_page: 30 }, ttlMs),
				this.listIssues(accountId, sec, { per_page: 20 }, ttlMs),
				this.listAssignedPRs(accountId, sec, 15, ttlMs),
				this.listNotifications(accountId, sec, { per_page: 20 }, ttlMs),
				this.getRateLimit(accountId, sec).catch(() => this.getRate(accountId))
			]);
			const runs = [];
			const topRepo = repos.status === "fulfilled" ? repos.value[0] : void 0;
			if (topRepo) try {
				runs.push(...await this.listWorkflowRuns(accountId, sec, topRepo.fullName, { per_page: 8 }, ttlMs));
			} catch {}
			const snap = {
				accountId,
				viewerLogin: loginHint,
				repos: repos.status === "fulfilled" ? repos.value : [],
				issues: issues.status === "fulfilled" ? issues.value : [],
				prs: prs.status === "fulfilled" ? prs.value : [],
				runs,
				notifications: notifications.status === "fulfilled" ? notifications.value : [],
				rate: rate.status === "fulfilled" ? rate.value : this.getRate(accountId),
				fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			this.setCache(k, snap);
			return snap;
		});
	}
	bust(accountId) {
		for (const k of [...this.cache.keys()]) if (k.startsWith(`${accountId}::`)) this.cache.delete(k);
	}
	bustAll() {
		this.cache.clear();
	}
};

//#endregion
//#region src/shared/types.ts
const DEFAULT_SETTINGS = {
	defaultAccountId: "",
	accounts: [],
	perAccount: {},
	prefs: {
		prMergeStyle: "squash",
		notifyPollSeconds: 60,
		themeAccent: "violet"
	}
};

//#endregion
//#region src/host/store.ts
const NS = "github-manager";
const CRED_SCOPE = "github-manager";
/** Normalize/sanitize settings loaded from disk */
function normalizeSettings(raw) {
	if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_SETTINGS);
	const r = raw;
	const accounts = Array.isArray(r.accounts) ? r.accounts.filter((a) => a && typeof a.id === "string") : [];
	const perAccount = r.perAccount && typeof r.perAccount === "object" ? r.perAccount : {};
	const prefsRaw = r.prefs ?? {};
	const prefs = {
		prMergeStyle: [
			"merge",
			"squash",
			"rebase"
		].includes(String(prefsRaw.prMergeStyle)) ? String(prefsRaw.prMergeStyle) : "squash",
		notifyPollSeconds: typeof prefsRaw.notifyPollSeconds === "number" ? prefsRaw.notifyPollSeconds : 60,
		themeAccent: [
			"violet",
			"emerald",
			"amber",
			"sky"
		].includes(String(prefsRaw.themeAccent)) ? String(prefsRaw.themeAccent) : "violet"
	};
	const defaultAccountId = typeof r.defaultAccountId === "string" ? r.defaultAccountId : "";
	return {
		defaultAccountId: accounts.some((a) => a.id === defaultAccountId) ? defaultAccountId : accounts[0]?.id ?? "",
		accounts,
		perAccount,
		prefs
	};
}

//#endregion
//#region src/host/tools.ts
function out(schema, render) {
	return {
		schema,
		render
	};
}
function present(title, subtitle) {
	return {
		kind: "generic",
		title,
		subtitle
	};
}
function registerTools(ctx, deps) {
	let defineTool;
	try {
		defineTool = __require("@deepseek-ai/dsh-tools").defineTool;
	} catch {
		defineTool = (opts) => ({
			...opts,
			name: opts.name
		});
	}
	const tool = (opts) => {
		const def = defineTool(opts);
		ctx.tools.register(def);
	};
	const resolve = async (accountId) => {
		const id = deps.resolveAccountId(accountId);
		if (!id) throw new Error("Kein GitHub-Account konfiguriert. In Einstellungen einen Account (PAT oder OAuth) hinzufügen.");
		const sec = await deps.getSecret(id);
		if (!sec) throw new Error(`Kein Token für Account ${id}. In Einstellungen neu verbinden.`);
		return {
			accountId: id,
			sec
		};
	};
	tool({
		name: "github_list_repos",
		description: "Listet Repos des GitHub-Accounts (eigene + Kollaborationen). Unterstützt Suche. Nutzt den Default-Account, wenn keiner genannt wird.",
		parameters: {
			accountId: {
				type: "string",
				description: "Account-ID (optional, Default wird genutzt)"
			},
			query: {
				type: "string",
				description: "Optionale Suchquery (z.B. \"language:ts stars:>100\")"
			},
			per_page: {
				type: "integer",
				description: "Anzahl (1-100, default 30)"
			}
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "Repos gelistet"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			if (args.query) return deps.svc.searchRepos(accountId, sec, String(args.query), args.per_page ?? 20);
			return deps.svc.listRepos(accountId, sec, { per_page: args.per_page ?? 30 });
		},
		presentCall: (a) => present(a.query ? `Suche Repos: ${a.query}` : "Liste Repos", a.accountId ? `Account ${a.accountId}` : void 0)
	});
	tool({
		name: "github_get_repo",
		description: "Details eines Repos (owner/name).",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true,
				description: "owner/name"
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Repo"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.getRepo(accountId, sec, String(args.fullName));
		},
		presentCall: (a) => present(`Repo: ${a.fullName}`)
	});
	tool({
		name: "github_list_issues",
		description: "Listet Issues (assigned/filter). Ohne Repo = Account-übergreifend.",
		parameters: {
			accountId: { type: "string" },
			state: {
				type: "string",
				description: "open|closed|all (default open)"
			},
			per_page: { type: "integer" }
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "Issues"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.listIssues(accountId, sec, {
				state: args.state ?? "open",
				per_page: args.per_page ?? 20
			});
		},
		presentCall: (a) => present(`Issues (${a.state ?? "open"})`)
	});
	tool({
		name: "github_list_repo_issues",
		description: "Issues eines Repos (owner/name).",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			state: { type: "string" },
			labels: {
				type: "string",
				description: "Komma-getrennte Labels"
			},
			per_page: { type: "integer" }
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "Repo Issues"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.listRepoIssues(accountId, sec, String(args.fullName), {
				state: args.state,
				labels: args.labels,
				per_page: args.per_page
			});
		},
		presentCall: (a) => present(`Issues: ${a.fullName}`, a.labels ? `labels: ${a.labels}` : void 0)
	});
	tool({
		name: "github_create_issue",
		description: "Erstellt ein Issue in einem Repo. Braucht Titel; Body/Labels/Assignees optional.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			title: {
				type: "string",
				required: true
			},
			body: { type: "string" },
			labels: {
				type: "array",
				items: { type: "string" }
			},
			assignees: {
				type: "array",
				items: { type: "string" }
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Issue erstellt"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.createIssue(accountId, sec, String(args.fullName), {
				title: String(args.title),
				body: args.body,
				labels: args.labels,
				assignees: args.assignees
			});
		},
		presentCall: (a) => present(`Neues Issue: ${a.title}`, a.fullName)
	});
	tool({
		name: "github_list_prs",
		description: "Listet Pull Requests eines Repos.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			state: {
				type: "string",
				description: "open|closed|all (default open)"
			},
			per_page: { type: "integer" }
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "PRs"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.listPRs(accountId, sec, String(args.fullName), {
				state: args.state,
				per_page: args.per_page
			});
		},
		presentCall: (a) => present(`PRs: ${a.fullName}`)
	});
	tool({
		name: "github_list_my_prs",
		description: "Eigene offene PRs (search: author:@me).",
		parameters: { accountId: { type: "string" } },
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "Meine PRs"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.listAssignedPRs(accountId, sec);
		},
		presentCall: () => present("Meine offenen PRs")
	});
	tool({
		name: "github_create_pr",
		description: "Erstellt einen Pull Request (head, base, title, body, draft).",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			title: {
				type: "string",
				required: true
			},
			head: {
				type: "string",
				required: true,
				description: "Quell-Branch"
			},
			base: {
				type: "string",
				required: true,
				description: "Ziel-Branch, z.B. main"
			},
			body: { type: "string" },
			draft: { type: "boolean" }
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "PR erstellt"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.createPR(accountId, sec, String(args.fullName), {
				title: String(args.title),
				head: String(args.head),
				base: String(args.base),
				body: args.body,
				draft: args.draft
			});
		},
		presentCall: (a) => present(`PR: ${a.title}`, `${a.head} → ${a.base} in ${a.fullName}`)
	});
	tool({
		name: "github_merge_pr",
		description: "Merged einen PR (merge/squash/rebase). Vorgegeben ist squash.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			pull_number: {
				type: "integer",
				required: true
			},
			merge_method: {
				type: "string",
				description: "merge|squash|rebase (default squash)"
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "PR gemerged"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const method = args.merge_method ?? deps.getSettings().prefs.prMergeStyle;
			return deps.svc.mergePR(accountId, sec, String(args.fullName), Number(args.pull_number), { merge_method: String(method) });
		},
		presentCall: (a) => present(`Merge PR #${a.pull_number}`, a.fullName)
	});
	tool({
		name: "github_list_workflow_runs",
		description: "Listet GitHub Actions Runs eines Repos.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			branch: { type: "string" },
			per_page: { type: "integer" }
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "Workflow Runs"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.listWorkflowRuns(accountId, sec, String(args.fullName), {
				branch: args.branch,
				per_page: args.per_page
			});
		},
		presentCall: (a) => present(`Actions: ${a.fullName}`, a.branch ? `branch ${a.branch}` : void 0)
	});
	tool({
		name: "github_list_notifications",
		description: "Listet GitHub Notifications (ungelesen).",
		parameters: {
			accountId: { type: "string" },
			per_page: { type: "integer" }
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "Notifications"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.listNotifications(accountId, sec, { per_page: args.per_page ?? 20 });
		},
		presentCall: () => present("Notifications")
	});
	tool({
		name: "github_mark_notifications_read",
		description: "Markiert alle Notifications als gelesen.",
		parameters: { accountId: { type: "string" } },
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Notifications gelesen"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			await deps.svc.markNotificationsRead(accountId, sec);
			return { ok: true };
		},
		presentCall: () => present("Markiere Notifications als gelesen")
	});
	tool({
		name: "github_rate_limit",
		description: "Zeigt das aktuelle API Rate Limit des Accounts.",
		parameters: { accountId: { type: "string" } },
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Rate Limit"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.getRateLimit(accountId, sec);
		},
		presentCall: () => present("Rate Limit")
	});
	tool({
		name: "github_dashboard",
		description: "Gesamt-Dashboard pro Account: Repos, Issues, PRs, Actions, Notifications + Rate. Ideal für einen schnellen Überblick.",
		parameters: { accountId: {
			type: "string",
			description: "Account-ID, sonst Default"
		} },
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Dashboard"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const login = deps.getSettings().accounts.find((a) => a.id === accountId)?.login ?? "me";
			return deps.svc.dashboard(accountId, sec, login);
		},
		presentCall: (a) => present("GitHub Dashboard", a.accountId ? `Account ${a.accountId}` : void 0)
	});
	tool({
		name: "github_validate_account",
		description: "Validiert den Token eines Accounts und zeigt Scopes + Rate.",
		parameters: { accountId: { type: "string" } },
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Validiert"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			return deps.svc.validate(accountId, sec);
		},
		presentCall: () => present("Validiere GitHub Token")
	});
	tool({
		name: "github_search",
		description: "GitHub Search über Issues/PRs (Query-DSL wie auf github.com). Beispiel: \"is:pr is:open label:bug repo:owner/repo\".",
		parameters: {
			accountId: { type: "string" },
			q: {
				type: "string",
				required: true,
				description: "Search query"
			},
			per_page: { type: "integer" }
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Search"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			const r = await ghFetch$1("/search/issues", {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: {
					q: String(args.q),
					per_page: args.per_page ?? 20
				}
			});
			return {
				total_count: r.data.total_count,
				items: r.data.items
			};
		},
		presentCall: (a) => present(`Suche: ${a.q}`)
	});
	tool({
		name: "github_get_issue",
		description: "Detail eines Issues (owner/name + Nummer).",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			number: {
				type: "integer",
				required: true
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Issue"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			return (await ghFetch$1(`/repos/${args.fullName}/issues/${args.number}`, {
				token: sec.token,
				baseUrl: sec.baseUrl
			})).data;
		},
		presentCall: (a) => present(`Issue #${a.number}`, a.fullName)
	});
	tool({
		name: "github_comment",
		description: "Kommentiert ein Issue / PR.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			number: {
				type: "integer",
				required: true
			},
			body: {
				type: "string",
				required: true
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Kommentar erstellt"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			return (await ghFetch$1(`/repos/${args.fullName}/issues/${args.number}/comments`, {
				token: sec.token,
				baseUrl: sec.baseUrl,
				method: "POST",
				body: { body: String(args.body) }
			})).data;
		},
		presentCall: (a) => present(`Kommentiere #${a.number}`, a.fullName)
	});
	tool({
		name: "github_get_pr",
		description: "Detail eines Pull Requests.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			number: {
				type: "integer",
				required: true
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "PR Detail"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			return (await ghFetch$1(`/repos/${args.fullName}/pulls/${args.number}`, {
				token: sec.token,
				baseUrl: sec.baseUrl
			})).data;
		},
		presentCall: (a) => present(`PR #${a.number}`, a.fullName)
	});
	tool({
		name: "github_pr_files",
		description: "Dateien eines Pull Requests (Diff-Liste).",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			number: {
				type: "integer",
				required: true
			}
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "PR Files"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			return (await ghFetch$1(`/repos/${args.fullName}/pulls/${args.number}/files`, {
				token: sec.token,
				baseUrl: sec.baseUrl
			})).data;
		},
		presentCall: (a) => present(`PR #${a.number} Dateien`, a.fullName)
	});
	tool({
		name: "github_dispatch_workflow",
		description: "Triggert einen GitHub Actions Workflow (workflow_dispatch). Braucht workflow file name und ref.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			workflow_id: {
				type: "string",
				required: true,
				description: "Dateiname wie ci.yml oder ID"
			},
			ref: {
				type: "string",
				required: true,
				description: "Branch/Tag"
			},
			inputs: {
				type: "object",
				additionalProperties: true
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Workflow getriggert"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			await ghFetch$1(`/repos/${args.fullName}/actions/workflows/${args.workflow_id}/dispatches`, {
				token: sec.token,
				baseUrl: sec.baseUrl,
				method: "POST",
				body: {
					ref: String(args.ref),
					inputs: args.inputs
				}
			});
			return { ok: true };
		},
		presentCall: (a) => present(`Trigger ${a.workflow_id}`, `${a.fullName}@${a.ref}`)
	});
	tool({
		name: "github_rerun_workflow",
		description: "Rerunned einen Workflow-Run.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			run_id: {
				type: "integer",
				required: true
			}
		},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Rerun getriggert"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			await ghFetch$1(`/repos/${args.fullName}/actions/runs/${args.run_id}/rerun`, {
				token: sec.token,
				baseUrl: sec.baseUrl,
				method: "POST"
			});
			return { ok: true };
		},
		presentCall: (a) => present(`Rerun #${a.run_id}`, a.fullName)
	});
	tool({
		name: "github_list_branches",
		description: "Listet Branches eines Repos.",
		parameters: {
			accountId: { type: "string" },
			fullName: {
				type: "string",
				required: true
			},
			per_page: { type: "integer" }
		},
		output: out({
			type: "array",
			items: {
				type: "object",
				additionalProperties: true
			}
		}, () => [{
			type: "text",
			text: "Branches"
		}]),
		async execute(args) {
			const { accountId, sec } = await resolve(args.accountId);
			const { ghFetch: ghFetch$1 } = await import("./github-api-DD-gKhcp.js");
			return (await ghFetch$1(`/repos/${args.fullName}/branches`, {
				token: sec.token,
				baseUrl: sec.baseUrl,
				query: { per_page: args.per_page ?? 30 }
			})).data;
		},
		presentCall: (a) => present(`Branches: ${a.fullName}`)
	});
	tool({
		name: "github_list_accounts",
		description: "Listet alle konfigurierten GitHub-Accounts (ID, Label, Login, Default). Nützlich, um zu wissen welcher Account verfügbar ist.",
		parameters: {},
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Accounts"
		}]),
		async execute() {
			const s = deps.getSettings();
			return {
				defaultAccountId: s.defaultAccountId,
				accounts: s.accounts.map((a) => ({
					id: a.id,
					label: a.label,
					login: a.login,
					authKind: a.authKind
				}))
			};
		},
		presentCall: () => present("Accounts auflisten")
	});
	tool({
		name: "github_bust_cache",
		description: "Leert den API-Cache (pro Account oder global), z. B. nach externen Änderungen.",
		parameters: { accountId: {
			type: "string",
			description: "Account-ID, leer = alle"
		} },
		output: out({
			type: "object",
			additionalProperties: true
		}, () => [{
			type: "text",
			text: "Cache geleert"
		}]),
		async execute(args) {
			if (args.accountId) deps.svc.bust(String(args.accountId));
			else deps.svc.bustAll();
			return { ok: true };
		},
		presentCall: (a) => present(a.accountId ? `Cache leeren: ${a.accountId}` : "Cache leeren (alle)")
	});
}

//#endregion
//#region src/host/remote.ts
/**
* Factory that builds the Remote class lazily so we don't hard-import
* @deepseek-ai/dsh-typert-protocol at module top-level ( keeps tsc happy offline ).
*/
function createRemoteClass(deps) {
	let Base;
	let RemoteDecorator;
	let RemoteErrorClass;
	try {
		const mod = __require("@deepseek-ai/dsh-typert-protocol");
		Base = mod.TypertRemoteService;
		RemoteDecorator = mod.Remote;
		RemoteErrorClass = mod.RemoteError;
	} catch {
		Base = class Sh {
			constructor(ctx, name, opts) {
				this.ctx = ctx;
				this.name = name;
				this.opts = opts;
			}
		};
		RemoteDecorator = () => (_t, _k, d) => d;
		RemoteErrorClass = class extends Error {
			constructor(code, msg, details) {
				super(msg);
				this.code = code;
				this.details = details;
				this.name = "RemoteError";
			}
		};
	}
	const Remote = RemoteDecorator;
	const RemoteError = RemoteErrorClass;
	class GithubManagerRemote extends Base {
		constructor(ctx) {
			super(ctx, "githubManagerRemote", { namespace: "githubManager" });
		}
		async requireSecret(accountId) {
			const s = await deps.getSecret(accountId);
			if (!s) throw new RemoteError("github/not-configured", `Kein Token für Account ${accountId} — in Einstellungen hinzufügen.`, { accountId });
			return s;
		}
		async listAccounts() {
			const map = await deps.listSecrets();
			const ids = Object.keys(map);
			return {
				accountIds: ids,
				defaultAccountId: ids[0] ?? ""
			};
		}
		async getStatus(accountId) {
			const sec = await this.requireSecret(accountId);
			return await deps.svc.validate(accountId, sec);
		}
		async getRateLimit(accountId) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.getRateLimit(accountId, sec);
		}
		async getDashboard(accountId, loginHint) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.dashboard(accountId, sec, loginHint);
		}
		async listRepos(accountId, opts = {}) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.listRepos(accountId, sec, opts);
		}
		async searchRepos(accountId, q) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.searchRepos(accountId, sec, q);
		}
		async getRepo(accountId, fullName) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.getRepo(accountId, sec, fullName);
		}
		async listIssues(accountId, opts = {}) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.listIssues(accountId, sec, opts);
		}
		async listRepoIssues(accountId, fullName, opts = {}) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.listRepoIssues(accountId, sec, fullName, opts);
		}
		async createIssue(accountId, fullName, input) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.createIssue(accountId, sec, fullName, input);
		}
		async listPRs(accountId, fullName, opts = {}) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.listPRs(accountId, sec, fullName, opts);
		}
		async listAssignedPRs(accountId) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.listAssignedPRs(accountId, sec);
		}
		async createPR(accountId, fullName, input) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.createPR(accountId, sec, fullName, input);
		}
		async mergePR(accountId, fullName, pull_number, opts = {}) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.mergePR(accountId, sec, fullName, pull_number, opts);
		}
		async listWorkflowRuns(accountId, fullName, opts = {}) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.listWorkflowRuns(accountId, sec, fullName, opts);
		}
		async listNotifications(accountId, opts = {}) {
			const sec = await this.requireSecret(accountId);
			return deps.svc.listNotifications(accountId, sec, opts);
		}
		async markNotificationsRead(accountId) {
			const sec = await this.requireSecret(accountId);
			await deps.svc.markNotificationsRead(accountId, sec);
		}
		async invalidateCache(accountId) {
			deps.invalidateCache(accountId);
		}
	}
	try {
		const names = [
			"listAccounts",
			"getStatus",
			"getRateLimit",
			"getDashboard",
			"listRepos",
			"searchRepos",
			"getRepo",
			"listIssues",
			"listRepoIssues",
			"createIssue",
			"listPRs",
			"listAssignedPRs",
			"createPR",
			"mergePR",
			"listWorkflowRuns",
			"listNotifications",
			"markNotificationsRead",
			"invalidateCache"
		];
		if (Remote !== void 0 && Remote.length !== void 0) for (const n of names) {
			const desc = Object.getOwnPropertyDescriptor(GithubManagerRemote.prototype, n);
			if (desc) Remote(GithubManagerRemote.prototype, n, desc);
		}
	} catch {}
	return GithubManagerRemote;
}

//#endregion
//#region src/index.ts
function genId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
let settingsSnapshot = structuredClone(DEFAULT_SETTINGS);
const inject = [
	"settings",
	"credentials",
	"tools"
];
const Config = (() => {
	try {
		const z = __require("@deepseek-ai/schemastery")?.default ?? __require("@deepseek-ai/schemastery");
		return z.object({
			defaultAccountId: z.string().optional(),
			cacheSeconds: z.natural?.() ?? z.number(),
			maxConcurrentRequests: z.natural?.() ?? z.number()
		});
	} catch {
		return {
			defaultAccountId: "",
			cacheSeconds: 45,
			maxConcurrentRequests: 6
		};
	}
})();
function apply(ctx, config = {}) {
	const svc = new GithubService();
	let schema = { type: "object" };
	try {
		const S = __require("@deepseek-ai/schemastery")?.default ?? __require("@deepseek-ai/schemastery");
		S.string?.() ?? S.string;
		S.number?.() ?? S.number;
		S.boolean?.() ?? S.boolean;
		schema = S.object({
			defaultAccountId: S.string().default(""),
			accounts: S.array(S.object({
				id: S.string(),
				label: S.string(),
				authKind: S.string(),
				login: S.string(),
				avatarUrl: S.string().optional?.() ?? S.string(),
				scopes: S.array(S.string()).optional?.() ?? S.array(S.string()),
				createdAt: S.string(),
				lastValidatedAt: S.string().optional?.() ?? S.string(),
				lastValidatedOk: S.boolean().optional?.() ?? S.boolean()
			})).default([]),
			perAccount: S.object({}).default({}),
			prefs: S.object({
				prMergeStyle: S.string().default("squash"),
				notifyPollSeconds: S.number().default(60),
				themeAccent: S.string().default("violet")
			}).default({
				prMergeStyle: "squash",
				notifyPollSeconds: 60,
				themeAccent: "violet"
			})
		});
	} catch {}
	try {
		const scope = ctx.settings?.register?.(NS, schema, { base: DEFAULT_SETTINGS });
		if (scope) {
			settingsSnapshot = normalizeSettings(scope.get());
			scope.watch?.((next) => {
				settingsSnapshot = normalizeSettings(next);
			});
		}
	} catch {}
	const getSettings = () => settingsSnapshot;
	const setSettingsPatch = async (patch) => {
		try {
			const s = ctx.settings;
			if (!s) {
				Object.assign(settingsSnapshot, patch);
				return;
			}
			await s.update(NS, patch);
		} catch (e) {
			Object.assign(settingsSnapshot, patch);
		}
	};
	const getSecret = async (accountId) => {
		try {
			const creds = ctx.credentials;
			if (!creds) return null;
			const keyNs = CRED_SCOPE;
			let key;
			try {
				const { credentialKey } = __require("@deepseek-ai/dsh-credentials");
				key = credentialKey(keyNs, accountId);
			} catch {
				key = `${keyNs}/${accountId}`;
			}
			const rec = await creds.readRecord?.(key);
			if (!rec) {
				try {
					const { credentialRef } = __require("@deepseek-ai/dsh-credentials");
					const ref = credentialRef(`GITHUB_TOKEN_${accountId.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`);
					const resolved = await creds.resolve?.(ref);
					if (resolved?.value) return {
						token: String(resolved.value),
						baseUrl: settingsSnapshot.perAccount[accountId]?.baseUrl
					};
				} catch {}
				return null;
			}
			const token = rec.token ?? rec.value ?? rec.apiKey ?? rec.secret;
			if (!token) return null;
			return {
				token: String(token),
				baseUrl: rec.baseUrl ?? settingsSnapshot.perAccount[accountId]?.baseUrl
			};
		} catch {
			return null;
		}
	};
	const setSecret = async (accountId, token, baseUrl) => {
		const creds = ctx.credentials;
		const payload = {
			kind: "github-pat",
			token,
			baseUrl: baseUrl ?? settingsSnapshot.perAccount[accountId]?.baseUrl
		};
		if (!creds?.modifyRecord) return;
		let key;
		try {
			const { credentialKey } = __require("@deepseek-ai/dsh-credentials");
			key = credentialKey(CRED_SCOPE, accountId);
		} catch {
			key = `${CRED_SCOPE}/${accountId}`;
		}
		await creds.modifyRecord(key, async () => payload);
	};
	const deleteSecret = async (accountId) => {
		const creds = ctx.credentials;
		if (!creds?.deleteRecord) return;
		let key;
		try {
			const { credentialKey } = __require("@deepseek-ai/dsh-credentials");
			key = credentialKey(CRED_SCOPE, accountId);
		} catch {
			key = `${CRED_SCOPE}/${accountId}`;
		}
		await creds.deleteRecord(key);
	};
	const resolveAccountId = (hint) => {
		const s = getSettings();
		if (hint && s.accounts.some((a) => a.id === hint)) return hint;
		if (s.defaultAccountId && s.accounts.some((a) => a.id === s.defaultAccountId)) return s.defaultAccountId;
		return s.accounts[0]?.id ?? "";
	};
	const oauthPending = /* @__PURE__ */ new Map();
	const manager = {
		svc,
		getSettings,
		getSecret,
		setSecret,
		deleteSecret,
		resolveAccountId,
		async addAccount(input) {
			const tok = input.token.trim();
			if (!tok) throw new Error("Token darf nicht leer sein.");
			let viewer = null;
			let scopes = [];
			try {
				const v = await validateToken(tok, input.baseUrl);
				viewer = v.viewer;
				scopes = v.scopes;
			} catch (e) {
				throw new Error(`Token-Validierung fehlgeschlagen: ${String(e?.message ?? e)}`);
			}
			const id = genId();
			const acct = {
				id,
				label: input.label || viewer.login,
				authKind: input.authKind ?? "pat",
				login: viewer.login,
				avatarUrl: viewer.avatar_url,
				scopes,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				lastValidatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				lastValidatedOk: true
			};
			await setSecret(id, tok, input.baseUrl);
			const s = getSettings();
			const next = {
				...s,
				accounts: [...s.accounts, acct],
				defaultAccountId: s.defaultAccountId || id,
				perAccount: {
					...s.perAccount,
					[id]: {
						...s.perAccount[id] ?? {},
						baseUrl: input.baseUrl
					}
				}
			};
			settingsSnapshot = next;
			await setSettingsPatch(next);
			return acct;
		},
		async updateAccount(accountId, patch) {
			const s = getSettings();
			const idx = s.accounts.findIndex((a) => a.id === accountId);
			if (idx < 0) throw new Error("Account nicht gefunden");
			const cur = s.accounts[idx];
			let login = cur.login;
			let avatarUrl = cur.avatarUrl;
			let scopes = cur.scopes;
			if (patch.token) {
				const v = await validateToken(patch.token.trim(), patch.baseUrl ?? s.perAccount[accountId]?.baseUrl);
				login = v.viewer.login;
				avatarUrl = v.viewer.avatar_url;
				scopes = v.scopes;
				await setSecret(accountId, patch.token.trim(), patch.baseUrl);
			} else if (patch.baseUrl !== void 0) await setSecret(accountId, (await getSecret(accountId))?.token ?? "", patch.baseUrl);
			const updated = {
				...cur,
				...patch.label !== void 0 ? { label: patch.label } : {},
				login,
				avatarUrl,
				scopes,
				lastValidatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				lastValidatedOk: true
			};
			const accounts = [...s.accounts];
			accounts[idx] = updated;
			const perAccount = {
				...s.perAccount,
				[accountId]: {
					...s.perAccount[accountId] ?? {},
					...patch.baseUrl !== void 0 ? { baseUrl: patch.baseUrl } : {}
				}
			};
			const next = {
				...s,
				accounts,
				perAccount
			};
			settingsSnapshot = next;
			await setSettingsPatch(next);
			return updated;
		},
		async removeAccount(accountId) {
			const s = getSettings();
			const accounts = s.accounts.filter((a) => a.id !== accountId);
			const perAccount = { ...s.perAccount };
			delete perAccount[accountId];
			const defaultAccountId = s.defaultAccountId === accountId ? accounts[0]?.id ?? "" : s.defaultAccountId;
			const next = {
				...s,
				accounts,
				perAccount,
				defaultAccountId
			};
			settingsSnapshot = next;
			await deleteSecret(accountId);
			await setSettingsPatch(next);
			svc.bust(accountId);
		},
		async setDefault(accountId) {
			const s = getSettings();
			if (!s.accounts.some((a) => a.id === accountId)) throw new Error("Account nicht gefunden");
			settingsSnapshot = {
				...s,
				defaultAccountId: accountId
			};
			await setSettingsPatch({ defaultAccountId: accountId });
		},
		async oauthDeviceStart(clientId, scope = "repo read:org notifications") {
			const id = genId();
			const params = new URLSearchParams({
				client_id: clientId,
				scope
			});
			const res = await fetch("https://github.com/login/device/code", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: params.toString()
			});
			if (!res.ok) throw new Error(`Device-Code fehlgeschlagen: ${res.status} ${await res.text()}`);
			const data = await res.json();
			oauthPending.set(id, {
				device_code: data.device_code,
				accountId: id,
				createdAt: Date.now()
			});
			const s = getSettings();
			const placeholder = {
				id,
				label: `OAuth … ${data.user_code}`,
				authKind: "oauth",
				login: data.user_code,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				lastValidatedOk: false
			};
			const next = {
				...s,
				accounts: [...s.accounts, placeholder],
				defaultAccountId: s.defaultAccountId || id
			};
			settingsSnapshot = next;
			await setSettingsPatch(next);
			return {
				accountId: id,
				user_code: data.user_code,
				verification_uri: data.verification_uri,
				verification_uri_complete: data.verification_uri_complete,
				expires_in: data.expires_in,
				interval: data.interval
			};
		},
		async oauthDevicePoll(accountId, clientId) {
			const p = oauthPending.get(accountId);
			if (!p) throw new Error("Kein OAuth-Pending für diesen Account");
			const params = new URLSearchParams({
				client_id: clientId,
				device_code: p.device_code,
				grant_type: "urn:ietf:params:oauth:grant-type:device_code"
			});
			const data = await (await fetch("https://github.com/login/oauth/access_token", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: params.toString()
			})).json().catch(() => ({}));
			if (data.error) {
				if (data.error === "authorization_pending" || data.error === "slow_down") return {
					status: "pending",
					message: data.error
				};
				if (data.error === "expired_token") {
					oauthPending.delete(accountId);
					await manager.removeAccount(accountId).catch(() => {});
					return {
						status: "error",
						message: "Code abgelaufen — neu starten."
					};
				}
				if (data.error === "access_denied") {
					oauthPending.delete(accountId);
					await manager.removeAccount(accountId).catch(() => {});
					return {
						status: "error",
						message: "Zugriff verweigert."
					};
				}
				return {
					status: "error",
					message: data.error_description ?? data.error
				};
			}
			const token = data.access_token;
			if (!token) return { status: "pending" };
			oauthPending.delete(accountId);
			let viewer;
			try {
				viewer = (await validateToken(token)).viewer;
			} catch (e) {
				return {
					status: "error",
					message: String(e?.message ?? e)
				};
			}
			await setSecret(accountId, token);
			const s = getSettings();
			const idx = s.accounts.findIndex((a) => a.id === accountId);
			const updated = {
				...s.accounts[idx] ?? {
					id: accountId,
					label: viewer.login,
					authKind: "oauth",
					login: viewer.login,
					createdAt: (/* @__PURE__ */ new Date()).toISOString()
				},
				login: viewer.login,
				label: s.accounts[idx]?.label?.startsWith("OAuth") ? viewer.login : s.accounts[idx]?.label ?? viewer.login,
				avatarUrl: viewer.avatar_url,
				lastValidatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				lastValidatedOk: true,
				scopes: data.scope?.split(",").map((x) => x.trim()).filter(Boolean) ?? []
			};
			const accounts = [...s.accounts];
			if (idx >= 0) accounts[idx] = updated;
			else accounts.push(updated);
			const next = {
				...s,
				accounts,
				defaultAccountId: s.defaultAccountId || accountId
			};
			settingsSnapshot = next;
			await setSettingsPatch(next);
			return {
				status: "success",
				account: updated
			};
		}
	};
	globalThis.__GH_MANAGER__ = manager;
	try {
		const { Service } = __require("@deepseek-ai/cordis");
		class GithubManagerService extends Service {
			manager = manager;
			constructor(c) {
				super(c, "githubManager");
			}
		}
		ctx.plugin(GithubManagerService);
	} catch {
		ctx.githubManager = manager;
	}
	try {
		const RemoteClass = createRemoteClass({
			svc,
			getSecret,
			listSecrets: async () => {
				const s = getSettings();
				const out$1 = {};
				for (const a of s.accounts) out$1[a.id] = { login: a.login };
				return out$1;
			},
			invalidateCache: (accountId) => {
				if (accountId) svc.bust(accountId);
				else svc.bustAll();
			},
			refreshSettings: async () => {}
		});
		ctx.plugin(RemoteClass);
	} catch {}
	try {
		registerTools(ctx, {
			svc,
			getSettings,
			getSecret,
			resolveAccountId
		});
	} catch (e) {
		ctx.logger?.warn?.("github-manager tools failed", e);
	}
	ctx.effect?.(() => {
		return () => {};
	}, "github-manager: lifecycle");
}
var src_default = {
	apply,
	inject,
	Config
};

//#endregion
export { Config, apply, src_default as default, inject };
//# sourceMappingURL=index.js.map