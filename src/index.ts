/**
 * dsh-plugin-github-manager — Host half
 * - Settings namespace `github-manager`
 * - Credential records for per-account tokens ( PAT + OAuth )
 * - 25 Agent Tools
 * - Typert Remote `githubManager`
 * - OAuth helpers (Device Flow)
 */
import { GithubService, type AccountSecret } from './host/github-service.js'
import { CRED_SCOPE, NS, normalizeSettings, credKeyForAccount } from './host/store.js'
import { registerTools } from './host/tools.js'
import { createRemoteClass } from './host/remote.js'
import { validateToken } from './shared/github-api.js'
import type { GithubSettings, GithubAccount, AccountId } from './shared/types.js'
import { DEFAULT_SETTINGS } from './shared/types.js'

// --- helpers that don't need real DSH imports to typecheck ---

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// We keep a module-level settings snapshot — Cordis will own the authoritative one
let settingsSnapshot: GithubSettings = structuredClone(DEFAULT_SETTINGS)

export const inject = ['settings', 'credentials', 'tools'] as const

export interface Config {
  defaultAccountId?: string
  cacheSeconds?: number
  maxConcurrentRequests?: number
}

export const Config: any = (() => {
  try {
    const z: any = (require('@deepseek-ai/schemastery') as any)?.default ?? require('@deepseek-ai/schemastery')
    return z.object({ defaultAccountId: z.string().optional(), cacheSeconds: z.natural?.() ?? z.number(), maxConcurrentRequests: z.natural?.() ?? z.number() })
  } catch { return { defaultAccountId: '', cacheSeconds: 45, maxConcurrentRequests: 6 } }
})()

export function apply(ctx: any, config: Config = {}): void {
  const svc = new GithubService()

  // --- settings schema ---
  // We use schemastery loosely so missing package doesn't break
  let schema: any = { type: 'object' }
  try {
    const S: any = (require('@deepseek-ai/schemastery') as any)?.default ?? require('@deepseek-ai/schemastery')
    const str = S.string?.() ?? S.string
    const num = S.number?.() ?? S.number
    const bool = S.boolean?.() ?? S.boolean
    // Minimal: accept any object for accounts/perAccount and validate in normalizeSettings
    schema = S.object({
      defaultAccountId: S.string().default(''),
      accounts: S.array(S.object({ id: S.string(), label: S.string(), authKind: S.string(), login: S.string(), avatarUrl: S.string().optional?.() ?? S.string(), scopes: S.array(S.string()).optional?.() ?? S.array(S.string()), createdAt: S.string(), lastValidatedAt: S.string().optional?.() ?? S.string(), lastValidatedOk: S.boolean().optional?.() ?? S.boolean() })).default([]),
      perAccount: S.object({}).default({}),
      prefs: S.object({ prMergeStyle: S.string().default('squash'), notifyPollSeconds: S.number().default(60), themeAccent: S.string().default('violet') }).default({ prMergeStyle: 'squash', notifyPollSeconds: 60, themeAccent: 'violet' }),
    }) as any
  } catch {}

  // Register settings namespace lazily (if Host has ctx.settings)
  try {
    const scope: any = ctx.settings?.register?.(NS, schema, { base: DEFAULT_SETTINGS })
    if (scope) {
      settingsSnapshot = normalizeSettings(scope.get())
      scope.watch?.((next: unknown) => { settingsSnapshot = normalizeSettings(next) })
    }
  } catch {}

  const getSettings = (): GithubSettings => settingsSnapshot
  const setSettingsPatch = async (patch: Partial<GithubSettings>): Promise<void> => {
    try {
      const s: any = ctx.settings
      if (!s) { Object.assign(settingsSnapshot, patch); return }
      // patch is shallow — use update for partial
      await s.update(NS, patch as any)
    } catch (e) { Object.assign(settingsSnapshot, patch) }
  }

  const getSecret = async (accountId: AccountId): Promise<AccountSecret | null> => {
    try {
      const creds: any = ctx.credentials
      if (!creds) return null
      const keyNs = CRED_SCOPE
      // Try credentialKey helper, fallback to string
      let key: any
      try { const { credentialKey } = require('@deepseek-ai/dsh-credentials') as any; key = credentialKey(keyNs, accountId) } catch { key = `${keyNs}/${accountId}` }
      const rec: any = await creds.readRecord?.(key)
      if (!rec) {
        // fallback: try credentialRef path
        try {
          const { credentialRef } = require('@deepseek-ai/dsh-credentials') as any
          const ref = credentialRef(`GITHUB_TOKEN_${accountId.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`)
          const resolved: any = await creds.resolve?.(ref)
          if (resolved?.value) return { token: String(resolved.value), baseUrl: settingsSnapshot.perAccount[accountId]?.baseUrl }
        } catch {}
        return null
      }
      // record kinds: we store as { kind:'github-pat', token, baseUrl } or generic ApiKeyRecord
      const token: string | undefined = rec.token ?? rec.value ?? rec.apiKey ?? rec.secret
      if (!token) return null
      return { token: String(token), baseUrl: rec.baseUrl ?? settingsSnapshot.perAccount[accountId]?.baseUrl }
    } catch { return null }
  }

  const setSecret = async (accountId: AccountId, token: string, baseUrl?: string): Promise<void> => {
    const creds: any = ctx.credentials
    const payload: any = { kind: 'github-pat', token, baseUrl: baseUrl ?? settingsSnapshot.perAccount[accountId]?.baseUrl }
    if (!creds?.modifyRecord) return
    let key: any
    try { const { credentialKey } = require('@deepseek-ai/dsh-credentials') as any; key = credentialKey(CRED_SCOPE, accountId) } catch { key = `${CRED_SCOPE}/${accountId}` }
    await creds.modifyRecord(key, async () => payload)
  }

  const deleteSecret = async (accountId: AccountId): Promise<void> => {
    const creds: any = ctx.credentials
    if (!creds?.deleteRecord) return
    let key: any
    try { const { credentialKey } = require('@deepseek-ai/dsh-credentials') as any; key = credentialKey(CRED_SCOPE, accountId) } catch { key = `${CRED_SCOPE}/${accountId}` }
    await creds.deleteRecord(key)
  }

  const resolveAccountId = (hint?: string): string => {
    const s = getSettings()
    if (hint && s.accounts.some(a => a.id === hint)) return hint
    if (s.defaultAccountId && s.accounts.some(a => a.id === s.defaultAccountId)) return s.defaultAccountId
    return s.accounts[0]?.id ?? ''
  }

  // --- OAuth helpers (device flow pending state stored in-memory) ---
  const oauthPending = new Map<string, { device_code: string; accountId: string; createdAt: number }>()

  // Expose management helpers on a lightweight service so the Remote + Tools can share them,
  // and also expose them for the Vite demo (no Cordis ctx there)
  const manager = {
    svc,
    getSettings,
    getSecret,
    setSecret,
    deleteSecret,
    resolveAccountId,
    async addAccount(input: { label: string; token: string; baseUrl?: string; authKind?: GithubAccount['authKind'] }): Promise<GithubAccount> {
      const tok = input.token.trim()
      if (!tok) throw new Error('Token darf nicht leer sein.')
      // validate token
      let viewer: any = null
      let scopes: string[] = []
      try {
        const v = await validateToken(tok, input.baseUrl)
        viewer = v.viewer
        scopes = v.scopes
      } catch (e: any) {
        throw new Error(`Token-Validierung fehlgeschlagen: ${String(e?.message ?? e)}`)
      }
      const id = genId()
      const acct: GithubAccount = {
        id, label: input.label || viewer.login, authKind: input.authKind ?? 'pat', login: viewer.login,
        avatarUrl: viewer.avatar_url, scopes, createdAt: new Date().toISOString(), lastValidatedAt: new Date().toISOString(), lastValidatedOk: true,
      }
      await setSecret(id, tok, input.baseUrl)
      const s = getSettings()
      const next: GithubSettings = { ...s, accounts: [...s.accounts, acct], defaultAccountId: s.defaultAccountId || id, perAccount: { ...s.perAccount, [id]: { ...(s.perAccount[id] ?? {}), baseUrl: input.baseUrl } } }
      settingsSnapshot = next
      await setSettingsPatch(next as any)
      return acct
    },
    async updateAccount(accountId: AccountId, patch: Partial<Pick<GithubAccount, 'label'>> & { baseUrl?: string; token?: string }): Promise<GithubAccount> {
      const s = getSettings()
      const idx = s.accounts.findIndex(a => a.id === accountId)
      if (idx < 0) throw new Error('Account nicht gefunden')
      const cur = s.accounts[idx]!
      let login = cur.login
      let avatarUrl = cur.avatarUrl
      let scopes = cur.scopes
      if (patch.token) {
        const v = await validateToken(patch.token.trim(), patch.baseUrl ?? s.perAccount[accountId]?.baseUrl)
        login = v.viewer.login; avatarUrl = v.viewer.avatar_url; scopes = v.scopes
        await setSecret(accountId, patch.token.trim(), patch.baseUrl)
      } else if (patch.baseUrl !== undefined) {
        await setSecret(accountId, (await getSecret(accountId))?.token ?? '', patch.baseUrl)
      }
      const updated: GithubAccount = { ...cur, ...(patch.label !== undefined ? { label: patch.label } : {}), login, avatarUrl, scopes, lastValidatedAt: new Date().toISOString(), lastValidatedOk: true }
      const accounts = [...s.accounts]; accounts[idx] = updated
      const perAccount = { ...s.perAccount, [accountId]: { ...(s.perAccount[accountId] ?? {}), ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}) } }
      const next: GithubSettings = { ...s, accounts, perAccount }
      settingsSnapshot = next
      await setSettingsPatch(next as any)
      return updated
    },
    async removeAccount(accountId: AccountId): Promise<void> {
      const s = getSettings()
      const accounts = s.accounts.filter(a => a.id !== accountId)
      const perAccount = { ...s.perAccount }; delete perAccount[accountId]
      const defaultAccountId = s.defaultAccountId === accountId ? (accounts[0]?.id ?? '') : s.defaultAccountId
      const next: GithubSettings = { ...s, accounts, perAccount, defaultAccountId }
      settingsSnapshot = next
      await deleteSecret(accountId)
      await setSettingsPatch(next as any)
      svc.bust(accountId)
    },
    async setDefault(accountId: AccountId): Promise<void> {
      const s = getSettings()
      if (!s.accounts.some(a => a.id === accountId)) throw new Error('Account nicht gefunden')
      const next: GithubSettings = { ...s, defaultAccountId: accountId }
      settingsSnapshot = next
      await setSettingsPatch({ defaultAccountId: accountId } as any)
    },
    // OAuth Device Flow — Host proxied via fetch (so PAT never hits the browser)
    async oauthDeviceStart(clientId: string, scope = 'repo read:org notifications'): Promise<{ accountId: string; user_code: string; verification_uri: string; verification_uri_complete?: string; expires_in: number; interval: number }> {
      const id = genId()
      const params = new URLSearchParams({ client_id: clientId, scope })
      const res = await fetch('https://github.com/login/device/code', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
      if (!res.ok) throw new Error(`Device-Code fehlgeschlagen: ${res.status} ${await res.text()}`)
      const data: any = await res.json()
      oauthPending.set(id, { device_code: data.device_code, accountId: id, createdAt: Date.now() })
      // stash unverified account placeholder
      const s = getSettings()
      const placeholder: GithubAccount = { id, label: `OAuth … ${data.user_code}`, authKind: 'oauth', login: data.user_code, createdAt: new Date().toISOString(), lastValidatedOk: false }
      const next: GithubSettings = { ...s, accounts: [...s.accounts, placeholder], defaultAccountId: s.defaultAccountId || id }
      settingsSnapshot = next
      await setSettingsPatch(next as any)
      return { accountId: id, user_code: data.user_code, verification_uri: data.verification_uri, verification_uri_complete: data.verification_uri_complete, expires_in: data.expires_in, interval: data.interval }
    },
    async oauthDevicePoll(accountId: AccountId, clientId: string): Promise<{ status: 'pending' | 'success' | 'error'; message?: string; account?: GithubAccount }> {
      const p = oauthPending.get(accountId)
      if (!p) throw new Error('Kein OAuth-Pending für diesen Account')
      const params = new URLSearchParams({ client_id: clientId, device_code: p.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
      const res = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() })
      const data: any = await res.json().catch(() => ({}))
      if (data.error) {
        if (data.error === 'authorization_pending' || data.error === 'slow_down') return { status: 'pending', message: data.error }
        if (data.error === 'expired_token') { oauthPending.delete(accountId); await manager.removeAccount(accountId).catch(() => {}); return { status: 'error', message: 'Code abgelaufen — neu starten.' } }
        if (data.error === 'access_denied') { oauthPending.delete(accountId); await manager.removeAccount(accountId).catch(() => {}); return { status: 'error', message: 'Zugriff verweigert.' } }
        return { status: 'error', message: data.error_description ?? data.error }
      }
      const token: string | undefined = data.access_token
      if (!token) return { status: 'pending' }
      // success — validate and persist
      oauthPending.delete(accountId)
      let viewer: any
      try { viewer = (await validateToken(token)).viewer } catch (e: any) { return { status: 'error', message: String(e?.message ?? e) } }
      await setSecret(accountId, token)
      const s = getSettings()
      const idx = s.accounts.findIndex(a => a.id === accountId)
      const updated: GithubAccount = { ...(s.accounts[idx] ?? { id: accountId, label: viewer.login, authKind: 'oauth' as const, login: viewer.login, createdAt: new Date().toISOString() }), login: viewer.login, label: s.accounts[idx]?.label?.startsWith('OAuth') ? viewer.login : (s.accounts[idx]?.label ?? viewer.login), avatarUrl: viewer.avatar_url, lastValidatedAt: new Date().toISOString(), lastValidatedOk: true, scopes: (data.scope?.split(',').map((x: string) => x.trim()).filter(Boolean) ?? []) }
      const accounts = [...s.accounts]; if (idx >= 0) accounts[idx] = updated; else accounts.push(updated)
      const next: GithubSettings = { ...s, accounts, defaultAccountId: s.defaultAccountId || accountId }
      settingsSnapshot = next
      await setSettingsPatch(next as any)
      return { status: 'success', account: updated }
    },
  }

  // Keep for Vite demo (importable without Cordis)
  ;(globalThis as any).__GH_MANAGER__ = manager

  // Provide ctx.githubManager for tools that may want it (lightweight service shim)
  try {
    const { Service } = require('@deepseek-ai/cordis') as any
    class GithubManagerService extends Service {
      manager = manager
      constructor(c: any) { super(c, 'githubManager') }
    }
    ctx.plugin(GithubManagerService)
  } catch {
    ;(ctx as any).githubManager = manager
  }

  // Register Typert Remote
  try {
    const RemoteClass: any = createRemoteClass({
      svc,
      getSecret,
      listSecrets: async () => {
        const s = getSettings()
        const out: Record<string, { login: string }> = {}
        for (const a of s.accounts) out[a.id] = { login: a.login }
        return out
      },
      invalidateCache: (accountId?: string) => { if (accountId) svc.bust(accountId); else svc.bustAll() },
      refreshSettings: async () => {},
    })
    ctx.plugin(RemoteClass)
  } catch {}

  // Register 25 tools
  try { registerTools(ctx, { svc, getSettings, getSecret, resolveAccountId }) } catch (e) { ctx.logger?.warn?.('github-manager tools failed', e) }

  // Patch ctx.settings fallback for offline demo: keep snapshot visible
  ctx.effect?.(() => {
    return () => {}
  }, 'github-manager: lifecycle')
}

export default { apply, inject, Config }
