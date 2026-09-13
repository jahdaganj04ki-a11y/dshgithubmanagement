import type { AccountId, DashboardSnapshot, RateLimitView, AccountStatus, RepoListItem, IssueListItem, PRListItem, WorkflowRunItem, NotificationItem } from '../shared/types.js';
export interface AccountSecret {
    token: string;
    baseUrl?: string;
}
export declare class GithubService {
    private cache;
    private inflight;
    private limitView;
    private lastError;
    private key;
    private cached;
    private setCache;
    private dedup;
    private trackRate;
    validate(accountId: AccountId, sec: AccountSecret): Promise<AccountStatus>;
    getRate(accountId: AccountId): RateLimitView | null;
    listRepos(accountId: AccountId, sec: AccountSecret, opts?: {
        per_page?: number;
        sort?: string;
        affiliation?: string;
    }, ttlMs?: number): Promise<RepoListItem[]>;
    searchRepos(accountId: AccountId, sec: AccountSecret, q: string, per_page?: number, ttlMs?: number): Promise<RepoListItem[]>;
    getRepo(accountId: AccountId, sec: AccountSecret, fullName: string, ttlMs?: number): Promise<RepoListItem>;
    listIssues(accountId: AccountId, sec: AccountSecret, opts?: {
        state?: string;
        per_page?: number;
        filter?: string;
    }, ttlMs?: number): Promise<IssueListItem[]>;
    listRepoIssues(accountId: AccountId, sec: AccountSecret, fullName: string, opts?: {
        state?: string;
        per_page?: number;
        labels?: string;
    }, ttlMs?: number): Promise<IssueListItem[]>;
    createIssue(accountId: AccountId, sec: AccountSecret, fullName: string, input: {
        title: string;
        body?: string;
        labels?: string[];
        assignees?: string[];
    }): Promise<IssueListItem>;
    listPRs(accountId: AccountId, sec: AccountSecret, fullName: string, opts?: {
        state?: string;
        per_page?: number;
    }, ttlMs?: number): Promise<PRListItem[]>;
    listAssignedPRs(accountId: AccountId, sec: AccountSecret, per_page?: number, ttlMs?: number): Promise<PRListItem[]>;
    createPR(accountId: AccountId, sec: AccountSecret, fullName: string, input: {
        title: string;
        head: string;
        base: string;
        body?: string;
        draft?: boolean;
    }): Promise<PRListItem>;
    mergePR(accountId: AccountId, sec: AccountSecret, fullName: string, pull_number: number, opts?: {
        merge_method?: string;
        commit_title?: string;
    }): Promise<any>;
    listWorkflowRuns(accountId: AccountId, sec: AccountSecret, fullName: string, opts?: {
        per_page?: number;
        branch?: string;
    }, ttlMs?: number): Promise<WorkflowRunItem[]>;
    listNotifications(accountId: AccountId, sec: AccountSecret, opts?: {
        all?: boolean;
        per_page?: number;
    }, ttlMs?: number): Promise<NotificationItem[]>;
    markNotificationsRead(accountId: AccountId, sec: AccountSecret): Promise<void>;
    getRateLimit(accountId: AccountId, sec: AccountSecret): Promise<RateLimitView>;
    dashboard(accountId: AccountId, sec: AccountSecret, loginHint: string, ttlMs?: number): Promise<DashboardSnapshot>;
    bust(accountId: AccountId): void;
    bustAll(): void;
}
//# sourceMappingURL=github-service.d.ts.map