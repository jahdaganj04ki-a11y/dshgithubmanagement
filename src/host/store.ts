import { DEFAULT_SETTINGS, type AccountId, type GithubSettings, type GithubAccount } from '../shared/types.js'

export const NS = 'github-manager' as const
export const CRED_SCOPE = 'github-manager' as const

export function credKeyForAccount(accountId: AccountId): string {
  return `${CRED_SCOPE}/${accountId}`
}

/** Normalize/sanitize settings loaded from disk */
export function normalizeSettings(raw: unknown): GithubSettings {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS)
  const r = raw as Record<string, unknown>
  const accounts = Array.isArray(r.accounts) ? (r.accounts as GithubAccount[]).filter(a => a && typeof a.id === 'string') : []
  const perAccount = r.perAccount && typeof r.perAccount === 'object' ? (r.perAccount as Record<string, any>) : {}
  const prefsRaw = (r.prefs ?? {}) as Record<string, unknown>
  const prefs = {
    prMergeStyle: (['merge', 'squash', 'rebase'].includes(String(prefsRaw.prMergeStyle)) ? String(prefsRaw.prMergeStyle) : 'squash') as GithubSettings['prefs']['prMergeStyle'],
    notifyPollSeconds: typeof prefsRaw.notifyPollSeconds === 'number' ? prefsRaw.notifyPollSeconds : 60,
    themeAccent: (['violet', 'emerald', 'amber', 'sky'].includes(String(prefsRaw.themeAccent)) ? String(prefsRaw.themeAccent) : 'violet') as GithubSettings['prefs']['themeAccent'],
  }
  const defaultAccountId = typeof r.defaultAccountId === 'string' ? r.defaultAccountId : ''
  return { defaultAccountId: accounts.some(a => a.id === defaultAccountId) ? defaultAccountId : (accounts[0]?.id ?? ''), accounts, perAccount, prefs }
}
