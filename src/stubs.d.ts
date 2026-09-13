// Ambient stubs so `tsc` passes without installing the full harness.
// At runtime inside DSH Desktop the real packages from the profile provide these.
declare module '@deepseek-ai/cordis' {
  export class Service {
    constructor(ctx: any, name: string)
    ctx: any
  }
  export const Service: any
  export type Context = any
  const _default: any
  export default _default
}
declare module '@deepseek-ai/schemastery' {
  const z: any
  export default z
  export const z: any
}
declare module '@deepseek-ai/dsh-tools' {
  export function defineTool(opts: any): any
  export const defineTool: any
}
declare module '@deepseek-ai/dsh-settings' {
  export class SettingsProvider { constructor(ctx: any); register(...a: any[]): any }
  export type SettingsScope<T> = any
}
declare module '@deepseek-ai/dsh-credentials' {
  export class CredentialProvider { constructor(ctx: any) }
  export function credentialRef(v: string): any
  export function credentialKey(scope: string, id: string): any
  export function parseCredentialKey(v: string): any
}
declare module '@deepseek-ai/dsh-typert-protocol' {
  export class TypertRemoteService { constructor(ctx: any, name: string, opts: any) }
  export function Remote(target: any, key: string, descriptor: any): any
  export class RemoteError extends Error { constructor(code: string, msg: string, details?: any) }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  export interface SlotMap {}
  export function resolveSlotLabel(v: any): any
  export interface LocaleNamespaceMap {}
}
declare module '@deepseek-ai/dsh-client-ui-primitives' { export const Button: any; export const Input: any }
declare module '@deepseek-ai/dsh-client-locale/client' { export const locale: any }
declare module '@deepseek-ai/dsh-client-ui-settings/client' { export const settingsScope: any }
declare module '@deepseek-ai/dsh-client-ui-renderer/client' { export const renderer: any }
declare module '@deepseek-ai/dsh-client-ui-layout/client' { export const layout: any }
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {}
declare module '@deepseek-ai/dsh-api-remotes/client' {}
declare module '@deepseek-ai/dsh-api-remotes/types' {}
declare module '@deepseek-ai/dsh-settings/types' {}
