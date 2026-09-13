/**
 * Host Remote service `githubManager` — the browser calls `ctx.remote.githubManager.*`.
 * Uses TypertRemoteService so the client gets typed `ctx.remote.githubManager` for free.
 * Falls back gracefully when typer packages aren't present (plain Service shim).
 */
import type { AccountId } from '../shared/types.js';
import type { GithubService, AccountSecret } from './github-service.js';
export interface RemoteDeps {
    svc: GithubService;
    getSecret: (accountId: AccountId) => Promise<AccountSecret | null>;
    listSecrets: () => Promise<Record<AccountId, {
        login: string;
    }>>;
    invalidateCache: (accountId?: AccountId) => void;
    refreshSettings: () => Promise<void>;
}
/**
 * Factory that builds the Remote class lazily so we don't hard-import
 * @deepseek-ai/dsh-typert-protocol at module top-level ( keeps tsc happy offline ).
 */
export declare function createRemoteClass(deps: RemoteDeps): any;
//# sourceMappingURL=remote.d.ts.map