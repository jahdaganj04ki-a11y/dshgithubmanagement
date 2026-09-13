import type { GithubAccount } from '../shared/types.js';
import type { GithubRemote } from './api.js';
export declare function Dashboard({ api, accounts, activeId, onActiveChange }: {
    api: GithubRemote;
    accounts: GithubAccount[];
    activeId: string;
    onActiveChange: (id: string) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=Dashboard.d.ts.map