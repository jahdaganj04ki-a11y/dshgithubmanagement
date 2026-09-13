/**
 * 25 Agent-Tools for dsh-plugin-github-manager.
 * All tools resolve the account via `accountId` param (defaults to default account).
 * Each tool is presented with a nice presentCall/presentResult.
 */
import type { GithubService, AccountSecret } from './github-service.js';
import type { GithubSettings } from '../shared/types.js';
type Ctx = any;
interface Deps {
    svc: GithubService;
    getSettings: () => GithubSettings;
    getSecret: (accountId: string) => Promise<AccountSecret | null>;
    resolveAccountId: (hint?: string) => string;
}
export declare function registerTools(ctx: Ctx, deps: Deps): void;
export {};
//# sourceMappingURL=tools.d.ts.map