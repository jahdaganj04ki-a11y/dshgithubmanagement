/**
 * Client-side API abstraction.
 * Inside DSH Desktop: proxied through `ctx.remote.githubManager` (Typert).
 * In Vite demo / tests: `LocalApi` talks directly to GitHub with tokens from localStorage.
 */
import type { AccountId, DashboardSnapshot, RateLimitView, AccountStatus, RepoListItem, IssueListItem, PRListItem, WorkflowRunItem, NotificationItem, GithubSettings, GithubAccount } from '../shared/types.js';
export interface GithubRemote {
    listAccounts(): Promise<{
        accountIds: AccountId[];
        defaultAccountId: string;
        accounts: GithubAccount[];
    }>;
    getStatus(accountId: AccountId): Promise<AccountStatus>;
    getRateLimit(accountId: AccountId): Promise<RateLimitView | null>;
    getDashboard(accountId: AccountId, loginHint: string): Promise<DashboardSnapshot>;
    listRepos(accountId: AccountId, opts?: any): Promise<RepoListItem[]>;
    searchRepos(accountId: AccountId, q: string): Promise<RepoListItem[]>;
    getRepo(accountId: AccountId, fullName: string): Promise<RepoListItem>;
    listIssues(accountId: AccountId, opts?: any): Promise<IssueListItem[]>;
    listRepoIssues(accountId: AccountId, fullName: string, opts?: any): Promise<IssueListItem[]>;
    createIssue(accountId: AccountId, fullName: string, input: any): Promise<IssueListItem>;
    listPRs(accountId: AccountId, fullName: string, opts?: any): Promise<PRListItem[]>;
    listAssignedPRs(accountId: AccountId): Promise<PRListItem[]>;
    createPR(accountId: AccountId, fullName: string, input: any): Promise<PRListItem>;
    mergePR(accountId: AccountId, fullName: string, pull_number: number, opts?: any): Promise<any>;
    listWorkflowRuns(accountId: AccountId, fullName: string, opts?: any): Promise<WorkflowRunItem[]>;
    listNotifications(accountId: AccountId, opts?: any): Promise<NotificationItem[]>;
    markNotificationsRead(accountId: AccountId): Promise<void>;
    invalidateCache(accountId?: AccountId): Promise<void>;
    getSettings(): GithubSettings;
    addAccount(input: {
        label: string;
        token: string;
        baseUrl?: string;
    }): Promise<GithubAccount>;
    updateAccount(accountId: AccountId, patch: any): Promise<GithubAccount>;
    removeAccount(accountId: AccountId): Promise<void>;
    setDefault(accountId: AccountId): Promise<void>;
}
declare class LocalApi implements GithubRemote {
    private rate;
    getSettings(): GithubSettings;
    listAccounts(): Promise<{
        accountIds: string[];
        defaultAccountId: string;
        accounts: GithubAccount[];
    }>;
    private tokenFor;
    getStatus(accountId: string): Promise<AccountStatus>;
    getRateLimit(accountId: string): Promise<RateLimitView | null>;
    getDashboard(accountId: string, loginHint: string): Promise<DashboardSnapshot>;
    listRepos(accountId: string, opts?: any): Promise<RepoListItem[]>;
    searchRepos(accountId: string, q: string): Promise<RepoListItem[]>;
    getRepo(accountId: string, fullName: string): Promise<RepoListItem>;
    listIssues(accountId: string, opts?: any): Promise<IssueListItem[]>;
    listRepoIssues(accountId: string, fullName: string, opts?: any): Promise<IssueListItem[]>;
    createIssue(accountId: string, fullName: string, input: any): Promise<IssueListItem>;
    listPRs(accountId: string, fullName: string, opts?: any): Promise<PRListItem[]>;
    listAssignedPRs(accountId: string): Promise<PRListItem[]>;
    createPR(accountId: string, fullName: string, input: any): Promise<PRListItem>;
    mergePR(accountId: string, fullName: string, pull_number: number, opts?: any): Promise<any>;
    listWorkflowRuns(accountId: string, fullName: string, opts?: any): Promise<WorkflowRunItem[]>;
    listNotifications(accountId: string, opts?: any): Promise<NotificationItem[]>;
    markNotificationsRead(accountId: string): Promise<void>;
    invalidateCache(accountId?: string): Promise<void>;
    addAccount(input: {
        label: string;
        token: string;
        baseUrl?: string;
    }): Promise<GithubAccount>;
    updateAccount(accountId: string, patch: any): Promise<GithubAccount>;
    removeAccount(accountId: string): Promise<void>;
    setDefault(accountId: string): Promise<void>;
}
export declare function getViteApi(): LocalApi;
/** Build the cordis-backed remote (when ctx.remote.githubManager exists). */
export declare function cordisRemote(ctx: any): GithubRemote;
export {};
//# sourceMappingURL=api.d.ts.map