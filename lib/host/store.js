import { DEFAULT_SETTINGS } from '../shared/types.js';
export const NS = 'github-manager';
export const CRED_SCOPE = 'github-manager';
export function credKeyForAccount(accountId) {
    return `${CRED_SCOPE}/${accountId}`;
}
/** Normalize/sanitize settings loaded from disk */
export function normalizeSettings(raw) {
    if (!raw || typeof raw !== 'object')
        return structuredClone(DEFAULT_SETTINGS);
    const r = raw;
    const accounts = Array.isArray(r.accounts) ? r.accounts.filter(a => a && typeof a.id === 'string') : [];
    const perAccount = r.perAccount && typeof r.perAccount === 'object' ? r.perAccount : {};
    const prefsRaw = (r.prefs ?? {});
    const prefs = {
        prMergeStyle: (['merge', 'squash', 'rebase'].includes(String(prefsRaw.prMergeStyle)) ? String(prefsRaw.prMergeStyle) : 'squash'),
        notifyPollSeconds: typeof prefsRaw.notifyPollSeconds === 'number' ? prefsRaw.notifyPollSeconds : 60,
        themeAccent: (['violet', 'emerald', 'amber', 'sky'].includes(String(prefsRaw.themeAccent)) ? String(prefsRaw.themeAccent) : 'violet'),
    };
    const defaultAccountId = typeof r.defaultAccountId === 'string' ? r.defaultAccountId : '';
    return { defaultAccountId: accounts.some(a => a.id === defaultAccountId) ? defaultAccountId : (accounts[0]?.id ?? ''), accounts, perAccount, prefs };
}
//# sourceMappingURL=store.js.map