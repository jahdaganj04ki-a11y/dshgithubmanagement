function out(schema, render) {
    return { schema, render };
}
function present(title, subtitle) {
    return { kind: 'generic', title, subtitle };
}
export function registerTools(ctx, deps) {
    // dynamic import guard — when @deepseek-ai/dsh-tools not installed, we still typecheck via stubs
    let defineTool;
    try {
        defineTool = require('@deepseek-ai/dsh-tools').defineTool;
    }
    catch {
        defineTool = (opts) => ({ ...opts, name: opts.name });
    }
    const tool = (opts) => {
        const def = defineTool(opts);
        ctx.tools.register(def);
    };
    const resolve = async (accountId) => {
        const id = deps.resolveAccountId(accountId);
        if (!id)
            throw new Error('Kein GitHub-Account konfiguriert. In Einstellungen einen Account (PAT oder OAuth) hinzufügen.');
        const sec = await deps.getSecret(id);
        if (!sec)
            throw new Error(`Kein Token für Account ${id}. In Einstellungen neu verbinden.`);
        return { accountId: id, sec };
    };
    // 1) list repos
    tool({
        name: 'github_list_repos',
        description: 'Listet Repos des GitHub-Accounts (eigene + Kollaborationen). Unterstützt Suche. Nutzt den Default-Account, wenn keiner genannt wird.',
        parameters: {
            accountId: { type: 'string', description: 'Account-ID (optional, Default wird genutzt)' },
            query: { type: 'string', description: 'Optionale Suchquery (z.B. "language:ts stars:>100")' },
            per_page: { type: 'integer', description: 'Anzahl (1-100, default 30)' },
        },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'Repos gelistet' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            if (args.query)
                return deps.svc.searchRepos(accountId, sec, String(args.query), args.per_page ?? 20);
            return deps.svc.listRepos(accountId, sec, { per_page: args.per_page ?? 30 });
        },
        presentCall: (a) => present(a.query ? `Suche Repos: ${a.query}` : 'Liste Repos', a.accountId ? `Account ${a.accountId}` : undefined),
    });
    // 2) get repo
    tool({
        name: 'github_get_repo',
        description: 'Details eines Repos (owner/name).',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true, description: 'owner/name' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Repo' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.getRepo(accountId, sec, String(args.fullName));
        },
        presentCall: (a) => present(`Repo: ${a.fullName}`),
    });
    // 3) list issues (assigned)
    tool({
        name: 'github_list_issues',
        description: 'Listet Issues (assigned/filter). Ohne Repo = Account-übergreifend.',
        parameters: { accountId: { type: 'string' }, state: { type: 'string', description: 'open|closed|all (default open)' }, per_page: { type: 'integer' } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'Issues' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.listIssues(accountId, sec, { state: args.state ?? 'open', per_page: args.per_page ?? 20 });
        },
        presentCall: (a) => present(`Issues (${a.state ?? 'open'})`),
    });
    // 4) list repo issues
    tool({
        name: 'github_list_repo_issues',
        description: 'Issues eines Repos (owner/name).',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, state: { type: 'string' }, labels: { type: 'string', description: 'Komma-getrennte Labels' }, per_page: { type: 'integer' } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'Repo Issues' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.listRepoIssues(accountId, sec, String(args.fullName), { state: args.state, labels: args.labels, per_page: args.per_page });
        },
        presentCall: (a) => present(`Issues: ${a.fullName}`, a.labels ? `labels: ${a.labels}` : undefined),
    });
    // 5) create issue
    tool({
        name: 'github_create_issue',
        description: 'Erstellt ein Issue in einem Repo. Braucht Titel; Body/Labels/Assignees optional.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, title: { type: 'string', required: true }, body: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } }, assignees: { type: 'array', items: { type: 'string' } } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Issue erstellt' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.createIssue(accountId, sec, String(args.fullName), { title: String(args.title), body: args.body, labels: args.labels, assignees: args.assignees });
        },
        presentCall: (a) => present(`Neues Issue: ${a.title}`, a.fullName),
    });
    // 6) list PRs of repo
    tool({
        name: 'github_list_prs',
        description: 'Listet Pull Requests eines Repos.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, state: { type: 'string', description: 'open|closed|all (default open)' }, per_page: { type: 'integer' } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'PRs' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.listPRs(accountId, sec, String(args.fullName), { state: args.state, per_page: args.per_page });
        },
        presentCall: (a) => present(`PRs: ${a.fullName}`),
    });
    // 7) list assigned PRs
    tool({
        name: 'github_list_my_prs',
        description: 'Eigene offene PRs (search: author:@me).',
        parameters: { accountId: { type: 'string' } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'Meine PRs' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.listAssignedPRs(accountId, sec);
        },
        presentCall: () => present('Meine offenen PRs'),
    });
    // 8) create PR
    tool({
        name: 'github_create_pr',
        description: 'Erstellt einen Pull Request (head, base, title, body, draft).',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, title: { type: 'string', required: true }, head: { type: 'string', required: true, description: 'Quell-Branch' }, base: { type: 'string', required: true, description: 'Ziel-Branch, z.B. main' }, body: { type: 'string' }, draft: { type: 'boolean' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'PR erstellt' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.createPR(accountId, sec, String(args.fullName), { title: String(args.title), head: String(args.head), base: String(args.base), body: args.body, draft: args.draft });
        },
        presentCall: (a) => present(`PR: ${a.title}`, `${a.head} → ${a.base} in ${a.fullName}`),
    });
    // 9) merge PR
    tool({
        name: 'github_merge_pr',
        description: 'Merged einen PR (merge/squash/rebase). Vorgegeben ist squash.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, pull_number: { type: 'integer', required: true }, merge_method: { type: 'string', description: 'merge|squash|rebase (default squash)' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'PR gemerged' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const method = args.merge_method ?? deps.getSettings().prefs.prMergeStyle;
            return deps.svc.mergePR(accountId, sec, String(args.fullName), Number(args.pull_number), { merge_method: String(method) });
        },
        presentCall: (a) => present(`Merge PR #${a.pull_number}`, a.fullName),
    });
    // 10) workflow runs
    tool({
        name: 'github_list_workflow_runs',
        description: 'Listet GitHub Actions Runs eines Repos.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, branch: { type: 'string' }, per_page: { type: 'integer' } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'Workflow Runs' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.listWorkflowRuns(accountId, sec, String(args.fullName), { branch: args.branch, per_page: args.per_page });
        },
        presentCall: (a) => present(`Actions: ${a.fullName}`, a.branch ? `branch ${a.branch}` : undefined),
    });
    // 11) notifications
    tool({
        name: 'github_list_notifications',
        description: 'Listet GitHub Notifications (ungelesen).',
        parameters: { accountId: { type: 'string' }, per_page: { type: 'integer' } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'Notifications' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.listNotifications(accountId, sec, { per_page: args.per_page ?? 20 });
        },
        presentCall: () => present('Notifications'),
    });
    // 12) mark notifications read
    tool({
        name: 'github_mark_notifications_read',
        description: 'Markiert alle Notifications als gelesen.',
        parameters: { accountId: { type: 'string' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Notifications gelesen' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            await deps.svc.markNotificationsRead(accountId, sec);
            return { ok: true };
        },
        presentCall: () => present('Markiere Notifications als gelesen'),
    });
    // 13) rate limit
    tool({
        name: 'github_rate_limit',
        description: 'Zeigt das aktuelle API Rate Limit des Accounts.',
        parameters: { accountId: { type: 'string' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Rate Limit' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.getRateLimit(accountId, sec);
        },
        presentCall: () => present('Rate Limit'),
    });
    // 14) dashboard (aggregated)
    tool({
        name: 'github_dashboard',
        description: 'Gesamt-Dashboard pro Account: Repos, Issues, PRs, Actions, Notifications + Rate. Ideal für einen schnellen Überblick.',
        parameters: { accountId: { type: 'string', description: 'Account-ID, sonst Default' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Dashboard' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const login = deps.getSettings().accounts.find(a => a.id === accountId)?.login ?? 'me';
            return deps.svc.dashboard(accountId, sec, login);
        },
        presentCall: (a) => present('GitHub Dashboard', a.accountId ? `Account ${a.accountId}` : undefined),
    });
    // 15) validate account
    tool({
        name: 'github_validate_account',
        description: 'Validiert den Token eines Accounts und zeigt Scopes + Rate.',
        parameters: { accountId: { type: 'string' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Validiert' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            return deps.svc.validate(accountId, sec);
        },
        presentCall: () => present('Validiere GitHub Token'),
    });
    // 16) search issues/PRs
    tool({
        name: 'github_search',
        description: 'GitHub Search über Issues/PRs (Query-DSL wie auf github.com). Beispiel: "is:pr is:open label:bug repo:owner/repo".',
        parameters: { accountId: { type: 'string' }, q: { type: 'string', required: true, description: 'Search query' }, per_page: { type: 'integer' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Search' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            const r = await ghFetch('/search/issues', { token: sec.token, baseUrl: sec.baseUrl, query: { q: String(args.q), per_page: args.per_page ?? 20 } });
            return { total_count: r.data.total_count, items: r.data.items };
        },
        presentCall: (a) => present(`Suche: ${a.q}`),
    });
    // 17) get issue detail
    tool({
        name: 'github_get_issue',
        description: 'Detail eines Issues (owner/name + Nummer).',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, number: { type: 'integer', required: true } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Issue' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            const r = await ghFetch(`/repos/${args.fullName}/issues/${args.number}`, { token: sec.token, baseUrl: sec.baseUrl });
            return r.data;
        },
        presentCall: (a) => present(`Issue #${a.number}`, a.fullName),
    });
    // 18) comment on issue/PR
    tool({
        name: 'github_comment',
        description: 'Kommentiert ein Issue / PR.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, number: { type: 'integer', required: true }, body: { type: 'string', required: true } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Kommentar erstellt' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            const r = await ghFetch(`/repos/${args.fullName}/issues/${args.number}/comments`, { token: sec.token, baseUrl: sec.baseUrl, method: 'POST', body: { body: String(args.body) } });
            return r.data;
        },
        presentCall: (a) => present(`Kommentiere #${a.number}`, a.fullName),
    });
    // 19) get PR detail
    tool({
        name: 'github_get_pr',
        description: 'Detail eines Pull Requests.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, number: { type: 'integer', required: true } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'PR Detail' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            const r = await ghFetch(`/repos/${args.fullName}/pulls/${args.number}`, { token: sec.token, baseUrl: sec.baseUrl });
            return r.data;
        },
        presentCall: (a) => present(`PR #${a.number}`, a.fullName),
    });
    // 20) list PR files / diff summary
    tool({
        name: 'github_pr_files',
        description: 'Dateien eines Pull Requests (Diff-Liste).',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, number: { type: 'integer', required: true } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'PR Files' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            const r = await ghFetch(`/repos/${args.fullName}/pulls/${args.number}/files`, { token: sec.token, baseUrl: sec.baseUrl });
            return r.data;
        },
        presentCall: (a) => present(`PR #${a.number} Dateien`, a.fullName),
    });
    // 21) trigger workflow
    tool({
        name: 'github_dispatch_workflow',
        description: 'Triggert einen GitHub Actions Workflow (workflow_dispatch). Braucht workflow file name und ref.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, workflow_id: { type: 'string', required: true, description: 'Dateiname wie ci.yml oder ID' }, ref: { type: 'string', required: true, description: 'Branch/Tag' }, inputs: { type: 'object', additionalProperties: true } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Workflow getriggert' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            await ghFetch(`/repos/${args.fullName}/actions/workflows/${args.workflow_id}/dispatches`, { token: sec.token, baseUrl: sec.baseUrl, method: 'POST', body: { ref: String(args.ref), inputs: args.inputs } });
            return { ok: true };
        },
        presentCall: (a) => present(`Trigger ${a.workflow_id}`, `${a.fullName}@${a.ref}`),
    });
    // 22) rerun workflow
    tool({
        name: 'github_rerun_workflow',
        description: 'Rerunned einen Workflow-Run.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, run_id: { type: 'integer', required: true } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Rerun getriggert' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            await ghFetch(`/repos/${args.fullName}/actions/runs/${args.run_id}/rerun`, { token: sec.token, baseUrl: sec.baseUrl, method: 'POST' });
            return { ok: true };
        },
        presentCall: (a) => present(`Rerun #${a.run_id}`, a.fullName),
    });
    // 23) list branches
    tool({
        name: 'github_list_branches',
        description: 'Listet Branches eines Repos.',
        parameters: { accountId: { type: 'string' }, fullName: { type: 'string', required: true }, per_page: { type: 'integer' } },
        output: out({ type: 'array', items: { type: 'object', additionalProperties: true } }, () => [{ type: 'text', text: 'Branches' }]),
        async execute(args) {
            const { accountId, sec } = await resolve(args.accountId);
            const { ghFetch } = await import('../shared/github-api.js');
            const r = await ghFetch(`/repos/${args.fullName}/branches`, { token: sec.token, baseUrl: sec.baseUrl, query: { per_page: args.per_page ?? 30 } });
            return r.data;
        },
        presentCall: (a) => present(`Branches: ${a.fullName}`),
    });
    // 24) list accounts (manager helper for the agent to discover available accounts)
    tool({
        name: 'github_list_accounts',
        description: 'Listet alle konfigurierten GitHub-Accounts (ID, Label, Login, Default). Nützlich, um zu wissen welcher Account verfügbar ist.',
        parameters: {},
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Accounts' }]),
        async execute() {
            const s = deps.getSettings();
            return { defaultAccountId: s.defaultAccountId, accounts: s.accounts.map(a => ({ id: a.id, label: a.label, login: a.login, authKind: a.authKind })) };
        },
        presentCall: () => present('Accounts auflisten'),
    });
    // 25) bust cache
    tool({
        name: 'github_bust_cache',
        description: 'Leert den API-Cache (pro Account oder global), z. B. nach externen Änderungen.',
        parameters: { accountId: { type: 'string', description: 'Account-ID, leer = alle' } },
        output: out({ type: 'object', additionalProperties: true }, () => [{ type: 'text', text: 'Cache geleert' }]),
        async execute(args) {
            if (args.accountId)
                deps.svc.bust(String(args.accountId));
            else
                deps.svc.bustAll();
            return { ok: true };
        },
        presentCall: (a) => present(a.accountId ? `Cache leeren: ${a.accountId}` : 'Cache leeren (alle)'),
    });
}
//# sourceMappingURL=tools.js.map