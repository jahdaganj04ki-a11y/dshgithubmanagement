export declare const inject: readonly ["settings", "credentials", "tools"];
export interface Config {
    defaultAccountId?: string;
    cacheSeconds?: number;
    maxConcurrentRequests?: number;
}
export declare const Config: any;
export declare function apply(ctx: any, config?: Config): void;
declare const _default: {
    apply: typeof apply;
    inject: readonly ["settings", "credentials", "tools"];
    Config: any;
};
export default _default;
//# sourceMappingURL=index.d.ts.map