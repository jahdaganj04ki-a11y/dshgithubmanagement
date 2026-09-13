import { type AccountId, type GithubSettings } from '../shared/types.js';
export declare const NS: "github-manager";
export declare const CRED_SCOPE: "github-manager";
export declare function credKeyForAccount(accountId: AccountId): string;
/** Normalize/sanitize settings loaded from disk */
export declare function normalizeSettings(raw: unknown): GithubSettings;
//# sourceMappingURL=store.d.ts.map