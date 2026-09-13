/** Minimal GitHub REST helper — no SDK dep, pure fetch/undici. */
export interface GhRequestInit {
    token: string;
    baseUrl?: string;
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}
export interface GhResponse<T> {
    data: T;
    headers: Headers;
    rateRemaining: number | null;
    rateLimit: number | null;
    rateReset: number | null;
    scopes: string[];
}
export declare class GhError extends Error {
    status: number;
    body: string;
    headers: Headers;
    constructor(status: number, body: string, headers: Headers);
}
export declare function ghFetch<T>(path: string, init: GhRequestInit): Promise<GhResponse<T>>;
export interface GhViewer {
    login: string;
    id: number;
    avatar_url: string;
    name: string | null;
    type: string;
}
export declare function validateToken(token: string, baseUrl?: string): Promise<{
    viewer: GhViewer;
    scopes: string[];
    rate: {
        remaining: number;
        limit: number;
        reset: number;
    } | null;
}>;
//# sourceMappingURL=github-api.d.ts.map