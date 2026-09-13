/**
 * Factory that builds the Remote class lazily so we don't hard-import
 * @deepseek-ai/dsh-typert-protocol at module top-level ( keeps tsc happy offline ).
 */
export function createRemoteClass(deps) {
    // Try to load the real base; if absent (offline build) use a tiny shim that still exposes the methods
    let Base;
    let RemoteDecorator;
    let RemoteErrorClass;
    try {
        const mod = require('@deepseek-ai/dsh-typert-protocol');
        Base = mod.TypertRemoteService;
        RemoteDecorator = mod.Remote;
        RemoteErrorClass = mod.RemoteError;
    }
    catch {
        Base = class Sh {
            ctx;
            name;
            opts;
            constructor(ctx, name, opts) {
                this.ctx = ctx;
                this.name = name;
                this.opts = opts;
            }
        };
        RemoteDecorator = () => (_t, _k, d) => d;
        RemoteErrorClass = class extends Error {
            code;
            details;
            constructor(code, msg, details) {
                super(msg);
                this.code = code;
                this.details = details;
                this.name = 'RemoteError';
            }
        };
    }
    const Remote = RemoteDecorator;
    const RemoteError = RemoteErrorClass;
    class GithubManagerRemote extends Base {
        constructor(ctx) { super(ctx, 'githubManagerRemote', { namespace: 'githubManager' }); }
        async requireSecret(accountId) {
            const s = await deps.getSecret(accountId);
            if (!s)
                throw new RemoteError('github/not-configured', `Kein Token für Account ${accountId} — in Einstellungen hinzufügen.`, { accountId });
            return s;
        }
        // Using `any` decorator form keeps tsc happy offline; at runtime inside Harness
        // the real @Remote decorator from typer wires the Typert registry.
        async listAccounts() {
            const map = await deps.listSecrets();
            const ids = Object.keys(map);
            return { accountIds: ids, defaultAccountId: ids[0] ?? '' };
        }
        async getStatus(accountId) {
            const sec = await this.requireSecret(accountId);
            const st = await deps.svc.validate(accountId, sec);
            return st;
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
    // Patch decorator metadata manually when real Remote is present, so Typert sees them.
    // When running offline, the shim above just returns identity, so this is a no-op.
    try {
        const names = ['listAccounts', 'getStatus', 'getRateLimit', 'getDashboard', 'listRepos', 'searchRepos', 'getRepo', 'listIssues', 'listRepoIssues', 'createIssue', 'listPRs', 'listAssignedPRs', 'createPR', 'mergePR', 'listWorkflowRuns', 'listNotifications', 'markNotificationsRead', 'invalidateCache'];
        if (Remote !== undefined && Remote.length !== undefined) {
            for (const n of names) {
                const desc = Object.getOwnPropertyDescriptor(GithubManagerRemote.prototype, n);
                if (desc)
                    Remote(GithubManagerRemote.prototype, n, desc);
            }
        }
    }
    catch { }
    return GithubManagerRemote;
}
//# sourceMappingURL=remote.js.map