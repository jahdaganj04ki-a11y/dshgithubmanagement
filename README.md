# dsh-plugin-github-manager

Kompletter **GitHub-Manager** für [DSH Desktop](https://github.com/dataelement/dsh-desktop) — gebaut als echtes [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Plugin (Cordis, `everything is a plugin`).

> **Vite-Demo:** `bun install && bun run dev` — Dashboard + Settings live im Browser testen (Demo-Daten ohne Token, echte Daten mit PAT sofort).
> **Im Harness:** `dsh plugin --profile web add /pfad/zu/dsh-plugin-github-manager`

---

## Was du bekommen hast

| Gewünscht | Geliefert |
|---|---|
| **Auth: beides** | **PAT** (fine-grained / classic, pro Account Base-URL für GHE) **+ OAuth Device-Flow** (Host tauscht Code, Token nie im Browser) |
| **Features: alles** | **Repos** (listen/suchen/Detail/Branches), **Issues** (assigned, pro Repo, erstellen, kommentieren, Detail), **PRs** (listen, Detail, Files, erstellen, mergen), **Actions** (Runs, dispatch, rerun), **Notifications** (Inbox, als gelesen) |
| **Dashboard: pro Account getrennt** | Eigener Cache, eigenes Rate-Limit, eigene Tabs (Repos/Issues/PRs/Actions/Notifications). Account-Switcher oben, Suche, Reset. |
| **Settings: Default + API-Limits** | Eigene `settings.section` „GitHub“: Multi-Account CRUD, Default-Account, GHE Base-URL pro Account, Rate-Meter pro Account, Cache-Leeren, Enterprise-Hinweis |
| **Agent: beides** | **25 Agent-Tools** — UI + Agent können dasselbe. Jedes Tool nimmt `accountId` (optional → Default). |

### Architektur (verdrahtert, kein Mock)

- **Host (`src/index.ts`)** — `settings` (`github-manager`), `credentials` (`github-manager/<accountId>`), `TypertRemote` (`githubManager`), 25 × `defineTool`, `GithubService` (Cache pro Account, dedup, LRU, Rate-Tracking), OAuth Device-Pending.
- **Client (`src/client/index.tsx`)** — `dsh.client` (`platform: web`), `main[github]` + `sidebar.panellist[github]` + `settings.section[github]`. Dashboard & Settings als React-Panels.
- **Shared (`src/shared`)** — Typen + `ghFetch` (+ undici-Fallback) + OAuth-Constants.
- **Vite-Demo (`src/vite`)** — gleiche UI, `LocalApi` (localStorage + direkter GitHub-REST), Demo-Fixtures wenn kein Account.

```
cordis.patch.yml  → - insert / id: github-manager  (Host in die Profile-Composition)
package.json:dsh   → { bundle.patch, client: { inject: [slots, primitives, locale, settings, layout, conversation], platform: web } }
lib/index.js      → Host (ESM, vom Loader importiert)
lib/client.js     → Client (CJS closure window.__ModuleLoader__.load({id, factory}))
dist/             → Vite-Demo (statisch, für Freebuff Hosting)
```

---

## Installieren

### In DSH Desktop / Harness

```sh
# 1) Plugin bauen (falls aus Source)
bun install
bun run build        # → lib/index.js + lib/client.js

# 2) In dein Profil hängen (Host + Client werden auto-verdrahtet)
dsh plugin --profile web add /pfad/zu/dsh-plugin-github-manager

# 3) DSH neu starten
dsh web              # UI: GitHub in Sidebar + Hauptpanel + Einstellungen → GitHub
```

### Als Vite-Demo (ohne Harness)

```sh
bun install
bun run dev          # → http://localhost:5173 (PORT aus Env)
bun run build:v      # → dist/ für Hosting
```

---

## Accounts verbinden

### PAT (empfohlen, schnell)

1. Auf GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Scopes: `repo`, `read:org`, `notifications`, `workflow` (für Actions-Runs). Bei GHE: Base-URL setzen.
3. In **DSH Desktop → Einstellungen → GitHub** (oder Vite-Demo): Label + Token + optional Base-URL → *Account verbinden*.

Im Harness landet das Token im **Credential-Store** (`0600`, `github-manager/<id>`), nie im Klartext auf Disk und nie im Renderer.

### OAuth (Device Flow)

1. Auf GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App** (Callback-URL egal, wird bei Device-Flow nicht genutzt).
2. **Client ID** kopieren.
3. In Einstellungen → GitHub → *OAuth Device-Flow*: Client ID eintragen → *Geräte-Code* generieren → auf `github.com/device` bestätigen. Host tauscht den Code serverseitig.

---

## Dashboard (pro Account getrennt)

- **Account-Switcher** oben (Avatar + Login + Label + PAT/OAuth-Badge).
- **Suche** filtert Repos live.
- **Tabs:** Alle · Repos · Issues · PRs · Actions · Notifications.
- **RateMeter** rechts: `remaining/limit`, Balken, Reset-Zeit.
- Jeder Account hat **eigenen Cache** (45s Default, pro Account invalidierbar).

## Settings-Seite

- **PAT-Formular** + **OAuth Device-Flow** nebeneinander.
- **Account-Liste:** Avatar, Login, Scopes, RateMeter, *Default* setzen, *Prüfen* (validiert Token + Scopes), *Entfernen*.
- **API-Limits:** Limits neu laden, Cache leeren (pro Account oder global).
- **Default-Account:** wird für alle Tools/Dashboards ohne `accountId` genommen und ist vorausgewählt.

---

## Agent-Tools (25)

Alle über `ctx.tools` registriert. Jedes nimmt `accountId?` (sonst Default).

| # | Tool | Was es tut |
|---|---|---|
| 1 | `github_list_repos` | Repos listen oder suchen (`query`) |
| 2 | `github_get_repo` | Repo-Detail (`owner/name`) |
| 3 | `github_list_issues` | Assigned Issues |
| 4 | `github_list_repo_issues` | Issues eines Repos |
| 5 | `github_create_issue` | Issue erstellen |
| 6 | `github_list_prs` | PRs eines Repos |
| 7 | `github_list_my_prs` | Eigene offene PRs (`author:@me`) |
| 8 | `github_create_pr` | PR erstellen (`head`/`base`) |
| 9 | `github_merge_pr` | PR mergen (`merge`/`squash`/`rebase`) |
| 10 | `github_list_workflow_runs` | Actions Runs eines Repos |
| 11 | `github_list_notifications` | Notifications |
| 12 | `github_mark_notifications_read` | Alle als gelesen |
| 13 | `github_rate_limit` | Rate-Limit des Accounts |
| 14 | `github_dashboard` | Aggregiertes Dashboard (alles auf einmal) |
| 15 | `github_validate_account` | Token + Scopes validieren |
| 16 | `github_search` | Search (Issues/PRs, Query-DSL) |
| 17 | `github_get_issue` | Issue-Detail |
| 18 | `github_comment` | Issue/PR kommentieren |
| 19 | `github_get_pr` | PR-Detail |
| 20 | `github_pr_files` | Dateien eines PRs |
| 21 | `github_dispatch_workflow` | Workflow dispatch |
| 22 | `github_rerun_workflow` | Run rerun |
| 23 | `github_list_branches` | Branches eines Repos |
| 24 | `github_list_accounts` | Konfigurierte Accounts |
| 25 | `github_bust_cache` | Cache leeren (pro Account / global) |

Beispiel (Agent):

> „Zeig mir meine offenen PRs auf dem Work-Account und merge #42 mit squash.“
> → `github_list_my_prs({accountId:"work"})` → `github_merge_pr({accountId:"work", fullName:"acme/web", pull_number:42, merge_method:"squash"})`

---

## Scripts

| Script | Was |
|---|---|
| `bun run dev` | Vite-Demo (`0.0.0.0:$PORT`, HMR off) |
| `bun run build` | Host+Client (`lib/`, tsdown dual) |
| `bun run build:v` | Vite-Prod (`dist/`) |
| `bun run typecheck` | `tsc` Host + Client |

## Stack

Vite 6 + React 18 + Tailwind 3 + tsdown 0.15 + undici 7 · Harness-Peers: `cordis ^4.0.2`, `schemastery ^3.18.2`, `dsh-tools / dsh-settings / dsh-credentials / dsh-typert-protocol` als peer.

## Lizenz

MIT
