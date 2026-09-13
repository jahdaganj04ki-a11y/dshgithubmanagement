/** Domain types shared between Host and Client (inline-safe). */
export type AccountId = string;
export type RepoFullName = string;
export type AuthKind = 'pat' | 'oauth';
export interface GithubAccount {
    id: AccountId;
    label: string;
    authKind: AuthKind;
    /** For PAT: login derived from token validation; for OAuth: github login */
    login: string;
    avatarUrl?: string;
    scopes?: string[];
    /** OAuth token is NOT stored here; Host keeps it in credential store */
    createdAt: string;
    lastValidatedAt?: string;
    lastValidatedOk?: boolean;
}
export interface GithubSettings {
    defaultAccountId: string;
    accounts: GithubAccount[];
    /** Per-account display overrides (cacheSeconds, enterprise baseUrl) */
    perAccount: Record<AccountId, {
        baseUrl?: string;
        cacheSeconds?: number;
    }>;
    /** Global UI prefs */
    prefs: {
        prMergeStyle: 'merge' | 'squash' | 'rebase';
        notifyPollSeconds: number;
        themeAccent: 'violet' | 'emerald' | 'amber' | 'sky';
    };
}
export declare const DEFAULT_SETTINGS: GithubSettings;
export type IssueState = 'open' | 'closed';
export type PRState = 'open' | 'closed' | 'merged';
export type ActionConclusion = 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'neutral' | null;
export interface RateLimitView {
    remaining: number;
    limit: number;
    resetAt: string;
    used: number;
    resource: string;
}
export interface AccountStatus {
    accountId: AccountId;
    login: string;
    ok: boolean;
    message?: string;
    rate?: RateLimitView;
    scopes?: string[];
}
export interface RepoListItem {
    id: number;
    fullName: string;
    name: string;
    owner: string;
    private: boolean;
    stars: number;
    forks: number;
    language: string | null;
    pushedAt: string;
    description: string | null;
    defaultBranch: string;
}
export interface IssueListItem {
    id: number;
    number: number;
    title: string;
    state: IssueState;
    user: string;
    labels: string[];
    assignee: string | null;
    comments: number;
    createdAt: string;
    updatedAt: string;
}
export interface PRListItem {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    merged: boolean;
    user: string;
    draft: boolean;
    labels: string[];
    createdAt: string;
    updatedAt: string;
}
export interface WorkflowRunItem {
    id: number;
    name: string;
    workflowName: string;
    branch: string;
    status: string;
    conclusion: ActionConclusion;
    createdAt: string;
    htmlUrl: string;
}
export interface NotificationItem {
    id: string;
    reason: string;
    subjectTitle: string;
    subjectType: string;
    repo: string;
    unread: boolean;
    updatedAt: string;
    url: string;
}
export interface DashboardSnapshot {
    accountId: AccountId;
    viewerLogin: string;
    repos: RepoListItem[];
    issues: IssueListItem[];
    prs: PRListItem[];
    runs: WorkflowRunItem[];
    notifications: NotificationItem[];
    rate: RateLimitView | null;
    fetchedAt: string;
}
//# sourceMappingURL=types.d.ts.map