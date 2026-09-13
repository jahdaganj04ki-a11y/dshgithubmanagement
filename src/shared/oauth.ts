/** GitHub OAuth Device Flow + classic OAuth code flow helpers (Host-side). */

export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
export const GITHUB_DEVICE_TOKEN_URL = 'https://github.com/login/oauth/access_token'
export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

export interface DeviceTokenSuccess {
  access_token: string
  token_type: string
  scope: string
  error?: undefined
}
export interface DeviceTokenPending {
  error: 'authorization_pending' | 'slow_down' | 'expired_token' | 'unsupported_grant_type' | 'incorrect_client_credentials' | 'incorrect_device_code' | 'access_denied'
  error_description?: string
}
export type DeviceTokenResponse = DeviceTokenSuccess | DeviceTokenPending

export function isDevicePending(r: DeviceTokenResponse): r is DeviceTokenPending {
  return (r as DeviceTokenPending).error !== undefined
}
