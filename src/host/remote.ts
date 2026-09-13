/**
 * Host Remote service `githubManager` — the browser calls `ctx.remote.githubManager.*`.
 * Uses TypertRemoteService so the client gets typed `ctx.remote.githubManager` for free.
 * Falls back gracefully when typer packages aren't present (plain Service shim).
 */
import type { AccountId, DashboardSnapshot, RateLimitView, AccountStatus } from '../shared/types.js'
import type { GithubService, AccountSecret } from './github-service.js'

export interface RemoteDeps {
  svc: GithubService
  getSecret: (accountId: AccountId) => Promise<AccountSecret | null>
  listSecrets: () => Promise<Record<AccountId, { login: string }>>
  invalidateCache: (accountId?: AccountId) => void
  refreshSettings: () => Promise<void>
}

/**
 * Factory that builds the Remote class lazily so we don't hard-import
 * @deepseek-ai/dsh-typert-protocol at module top-level ( keeps tsc happy offline ).
 */
export function createRemoteClass(deps: RemoteDeps): any {
  // Try to load the real base; if absent (offline build) use a tiny shim that still exposes the methods
  let Base: any
  let RemoteDecorator: any
  let RemoteErrorClass: any
  try {
    const mod = require('@deepseek-ai/dsh-typert-protocol') as any
    Base = mod.TypertRemoteService
    RemoteDecorator = mod.Remote
    RemoteErrorClass = mod.RemoteError
  } catch {
    Base = class Sh { constructor(public ctx: any, public name: string, public opts: any) {} }
    RemoteDecorator = () => (_t: any, _k: string | symbol, d: PropertyDescriptor) => d
    RemoteErrorClass = class extends Error { constructor(public code: string, msg: string, public details?: any) { super(msg); this.name = 'RemoteError' } }
  }

  const Remote: any = RemoteDecorator
  const RemoteError = RemoteErrorClass as new (code: string, msg: string, details?: any) => Error

  class GithubManagerRemote extends Base {
    constructor(ctx: any) { super(ctx, 'githubManagerRemote', { namespace: 'githubManager' }) }

    private async requireSecret(accountId: AccountId): Promise<AccountSecret> {
      const s = await deps.getSecret(accountId)
      if (!s) throw new RemoteError('github/not-configured', `Kein Token für Account ${accountId} — in Einstellungen hinzufügen.`, { accountId })
      return s
    }

    // Using `any` decorator form keeps tsc happy offline; at runtime inside Harness
    // the real @Remote decorator from typer wires the Typert registry.
    async listAccounts(): Promise<{ accountIds: AccountId[]; defaultAccountId: string }> {
      const map = await deps.listSecrets()
      const ids = Object.keys(map)
      return { accountIds: ids, defaultAccountId: ids[0] ?? '' }
    }

    async getStatus(accountId: AccountId): Promise<AccountStatus> {
      const sec = await this.requireSecret(accountId)
      const st = await deps.svc.validate(accountId, sec)
      return st
    }

    async getRateLimit(accountId: AccountId): Promise<RateLimitView | null> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.getRateLimit(accountId, sec)
    }

    async getDashboard(accountId: AccountId, loginHint: string): Promise<DashboardSnapshot> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.dashboard(accountId, sec, loginHint)
    }

    async listRepos(accountId: AccountId, opts: any = {}): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.listRepos(accountId, sec, opts)
    }

    async searchRepos(accountId: AccountId, q: string): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.searchRepos(accountId, sec, q)
    }

    async getRepo(accountId: AccountId, fullName: string): Promise<any> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.getRepo(accountId, sec, fullName)
    }

    async listIssues(accountId: AccountId, opts: any = {}): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.listIssues(accountId, sec, opts)
    }

    async listRepoIssues(accountId: AccountId, fullName: string, opts: any = {}): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.listRepoIssues(accountId, sec, fullName, opts)
    }

    async createIssue(accountId: AccountId, fullName: string, input: any): Promise<any> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.createIssue(accountId, sec, fullName, input)
    }

    async listPRs(accountId: AccountId, fullName: string, opts: any = {}): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.listPRs(accountId, sec, fullName, opts)
    }

    async listAssignedPRs(accountId: AccountId): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.listAssignedPRs(accountId, sec)
    }

    async createPR(accountId: AccountId, fullName: string, input: any): Promise<any> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.createPR(accountId, sec, fullName, input)
    }

    async mergePR(accountId: AccountId, fullName: string, pull_number: number, opts: any = {}): Promise<any> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.mergePR(accountId, sec, fullName, pull_number, opts)
    }

    async listWorkflowRuns(accountId: AccountId, fullName: string, opts: any = {}): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.listWorkflowRuns(accountId, sec, fullName, opts)
    }

    async listNotifications(accountId: AccountId, opts: any = {}): Promise<any[]> {
      const sec = await this.requireSecret(accountId)
      return deps.svc.listNotifications(accountId, sec, opts)
    }

    async markNotificationsRead(accountId: AccountId): Promise<void> {
      const sec = await this.requireSecret(accountId)
      await deps.svc.markNotificationsRead(accountId, sec)
    }

    async invalidateCache(accountId?: AccountId): Promise<void> {
      deps.invalidateCache(accountId)
    }
  }

  // Patch decorator metadata manually when real Remote is present, so Typert sees them.
  // When running offline, the shim above just returns identity, so this is a no-op.
  try {
    const names = ['listAccounts','getStatus','getRateLimit','getDashboard','listRepos','searchRepos','getRepo','listIssues','listRepoIssues','createIssue','listPRs','listAssignedPRs','createPR','mergePR','listWorkflowRuns','listNotifications','markNotificationsRead','invalidateCache']
    if (Remote !== undefined && Remote.length !== undefined) {
      for (const n of names) {
        const desc = Object.getOwnPropertyDescriptor(GithubManagerRemote.prototype, n)
        if (desc) Remote(GithubManagerRemote.prototype, n, desc)
      }
    }
  } catch {}

  return GithubManagerRemote
}
