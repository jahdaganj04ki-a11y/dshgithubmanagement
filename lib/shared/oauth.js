/** GitHub OAuth Device Flow + classic OAuth code flow helpers (Host-side). */
export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
export const GITHUB_DEVICE_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export function isDevicePending(r) {
    return r.error !== undefined;
}
//# sourceMappingURL=oauth.js.map