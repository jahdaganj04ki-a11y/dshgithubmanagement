import type { DashboardSnapshot, RepoListItem, IssueListItem, PRListItem, WorkflowRunItem, NotificationItem } from '../../shared/types.js'

function ago(hours: number): string { return new Date(Date.now() - hours * 3600_000).toISOString() }

export const DEMO_REPOS: RepoListItem[] = [
  { id: 1, fullName: 'acme/web', name: 'web', owner: 'acme', private: false, stars: 342, forks: 28, language: 'TypeScript', pushedAt: ago(2), description: 'Acme Web — Next.js + DSH SDK, deploy auf Freebuff.', defaultBranch: 'main' },
  { id: 2, fullName: 'acme/api', name: 'api', owner: 'acme', private: true, stars: 89, forks: 12, language: 'Go', pushedAt: ago(5), description: 'Go API — auth, billing, webhooks.', defaultBranch: 'main' },
  { id: 3, fullName: 'acme/dsh-plugin-github-manager', name: 'dsh-plugin-github-manager', owner: 'acme', private: false, stars: 12, forks: 2, language: 'TypeScript', pushedAt: ago(0.5), description: 'Dieses Plugin — Multi-Account GitHub Manager für DSH Desktop.', defaultBranch: 'main' },
  { id: 4, fullName: 'acme/mobile', name: 'mobile', owner: 'acme', private: true, stars: 54, forks: 9, language: 'Kotlin', pushedAt: ago(18), description: 'Android Companion — QR-Pairing zur Desktop-Session.', defaultBranch: 'develop' },
  { id: 5, fullName: 'acme/docs', name: 'docs', owner: 'acme', private: false, stars: 21, forks: 4, language: 'MDX', pushedAt: ago(30), description: 'Docusaurus Docs', defaultBranch: 'main' },
  { id: 6, fullName: 'acme/infra', name: 'infra', owner: 'acme', private: true, stars: 7, forks: 1, language: 'HCL', pushedAt: ago(50), description: 'Terraform — staging & prod', defaultBranch: 'main' },
]

export const DEMO_ISSUES: IssueListItem[] = [
  { id: 101, number: 142, title: 'OAuth Device-Flow: handle slow_down correctly', state: 'open', user: 'alice', labels: ['enhancement', 'auth'], assignee: 'alice', comments: 4, createdAt: ago(10), updatedAt: ago(1) },
  { id: 102, number: 138, title: 'Rate-Limit Anzeige pro Account im Header', state: 'open', user: 'bob', labels: ['ui', 'dashboard'], assignee: null, comments: 2, createdAt: ago(24), updatedAt: ago(3) },
  { id: 103, number: 131, title: 'GHE baseUrl pro Account persistieren', state: 'open', user: 'alice', labels: ['enterprise'], assignee: 'alice', comments: 0, createdAt: ago(40), updatedAt: ago(12) },
]

export const DEMO_PRS: PRListItem[] = [
  { id: 201, number: 89, title: 'feat: pro-Account Dashboard mit Tabs', state: 'open', merged: false, user: 'alice', draft: false, labels: ['feature'], createdAt: ago(6), updatedAt: ago(0.8) },
  { id: 202, number: 87, title: 'fix: bust cache nach createIssue', state: 'open', merged: false, user: 'bob', draft: true, labels: ['bug'], createdAt: ago(14), updatedAt: ago(2) },
  { id: 203, number: 82, title: 'chore: tsdown dual-bundle (host + client)', state: 'open', merged: false, user: 'alice', draft: false, labels: [], createdAt: ago(30), updatedAt: ago(5) },
]

export const DEMO_RUNS: WorkflowRunItem[] = [
  { id: 301, name: 'CI', workflowName: 'CI', branch: 'main', status: 'completed', conclusion: 'success', createdAt: ago(1), htmlUrl: 'https://github.com/acme/web/actions/runs/1' },
  { id: 302, name: 'CI', workflowName: 'CI', branch: 'feat/github', status: 'completed', conclusion: 'failure', createdAt: ago(3), htmlUrl: 'https://github.com/acme/web/actions/runs/2' },
  { id: 303, name: 'Release', workflowName: 'Release', branch: 'main', status: 'in_progress', conclusion: null, createdAt: ago(0.3), htmlUrl: 'https://github.com/acme/web/actions/runs/3' },
]

export const DEMO_NOTIFS: NotificationItem[] = [
  { id: 'n1', reason: 'mention', subjectTitle: 'Review requested: feat: pro-Account Dashboard', subjectType: 'PullRequest', repo: 'acme/web', unread: true, updatedAt: ago(0.5), url: '' },
  { id: 'n2', reason: 'subscribed', subjectTitle: 'Issue #142 commented', subjectType: 'Issue', repo: 'acme/web', unread: true, updatedAt: ago(1.2), url: '' },
  { id: 'n3', reason: 'assign', subjectTitle: 'You were assigned to #138', subjectType: 'Issue', repo: 'acme/api', unread: false, updatedAt: ago(6), url: '' },
]

export function demoSnapshot(accountId: string, login: string): DashboardSnapshot {
  return { accountId, viewerLogin: login, repos: DEMO_REPOS, issues: DEMO_ISSUES, prs: DEMO_PRS, runs: DEMO_RUNS, notifications: DEMO_NOTIFS, rate: { remaining: 4872, limit: 5000, resetAt: new Date(Date.now() + 3600_000).toISOString(), used: 128, resource: 'core' }, fetchedAt: new Date().toISOString() }
}
