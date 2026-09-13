import { useEffect, useMemo, useState } from 'react'
import { getViteApi } from '../client/api.js'
import { Dashboard } from '../client/Dashboard.js'
import { SettingsPage } from '../client/Settings.js'
import { demoSnapshot } from './lib/demo-data.js'
import type { GithubAccount } from '../shared/types.js'
import { Github, Shield, LayoutDashboard, Settings2, ExternalLink, Copy, Check, Sparkles, Boxes, PlugZap, KeyRound, Bell, GitBranch, Activity, ArrowRight, Play } from 'lucide-react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '../client/components/ui.js'

type Route = 'landing' | 'dashboard' | 'settings'

export default function App() {
  const api = useMemo(() => getViteApi(), [])
  const [route, setRoute] = useState<Route>('landing')
  const [settings, setSettings] = useState(() => api.getSettings())
  const [activeId, setActiveId] = useState(() => settings.defaultAccountId || settings.accounts[0]?.id || '')
  const [demo, setDemo] = useState(settings.accounts.length === 0)
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = () => {
    const s = api.getSettings()
    setSettings(s)
    if (!activeId && s.accounts[0]) setActiveId(s.accounts[0].id)
    setDemo(s.accounts.length === 0)
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    const id = setInterval(refresh, 2000)
    return () => clearInterval(id)
  }, [])

  // Demo-injected api so Dashboard works even without real token
  const viewApi = useMemo(() => {
    if (!demo) return api
    // Wrap getDashboard to return fixture when no accounts
    const wrapped: any = Object.create(api)
    const origGetDashboard = api.getDashboard.bind(api)
    wrapped.getDashboard = async (accountId: string, login: string) => {
      if (settings.accounts.length === 0) {
        // fabricate a demo account snapshot
        const loginFake = 'demo-user'
        return demoSnapshot('demo', loginFake)
      }
      return origGetDashboard(accountId, login)
    }
    // listAccounts / getSettings should still show demo account banner
    return wrapped as typeof api
  }, [api, demo, settings.accounts.length])

  const demoAccounts: GithubAccount[] = demo
    ? [{ id: 'demo', label: 'Demo', authKind: 'pat', login: 'demo-user', avatarUrl: undefined, scopes: ['repo', 'read:org'], createdAt: new Date().toISOString(), lastValidatedAt: new Date().toISOString(), lastValidatedOk: true }]
    : settings.accounts

  const effectiveActive = demo ? 'demo' : (activeId || settings.defaultAccountId || settings.accounts[0]?.id || '')

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-zinc-950">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-zinc-900 dark:bg-white grid place-items-center shadow-sm">
              <Github className="h-4.5 w-4.5 text-white dark:text-zinc-900" />
            </div>
            <div className="leading-none">
              <div className="text-sm font-bold tracking-tight">DSH GitHub Manager</div>
              <div className="text-[11px] text-muted-foreground">Plugin für DSH Desktop</div>
            </div>
            <Badge variant="outline" className="ml-2 hidden sm:inline-flex text-[10px]">v0.1.0 · Multi-Account</Badge>
          </div>
          <nav className="ml-auto flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 p-1">
            <button onClick={() => setRoute('landing')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${route === 'landing' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Überblick</button>
            <button onClick={() => setRoute('dashboard')} className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${route === 'dashboard' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><LayoutDashboard className="h-3.5 w-3.5" /> Dashboard</button>
            <button onClick={() => setRoute('settings')} className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${route === 'settings' ? 'bg-white dark:bg-zinc-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Settings2 className="h-3.5 w-3.5" /> Einstellungen</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {route === 'landing' && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-[28px] border bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-black text-white p-6 sm:p-8 lg:p-10">
              <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
              <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-sky-600/15 blur-3xl" />
              <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> Komplett verdrahtetes DSH-Plugin · Host + Client · 25 Agent-Tools</div>
                  <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[0.95]">GitHub, endlich<br /> in DSH Desktop.</h1>
                  <p className="text-sm sm:text-[15px] leading-relaxed text-zinc-300 max-w-xl">Multi-Account (PAT <em className="text-white not-italic">und</em> OAuth Device-Flow), pro-Account Dashboard, eigene Settings-Seite mit Default & API-Limits — und 25 Tools, die der Agent direkt nutzen kann. Repos, Issues, PRs, Actions, Notifications. Alles drin.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button onClick={() => setRoute('dashboard')} className="bg-white text-zinc-900 hover:bg-zinc-100 gap-1.5 rounded-full">Dashboard öffnen <ArrowRight className="h-4 w-4" /></Button>
                    <Button variant="secondary" onClick={() => setRoute('settings')} className="bg-white/10 text-white hover:bg-white/15 border-white/15 rounded-full backdrop-blur"><KeyRound className="h-4 w-4 mr-1.5" /> Account verbinden</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2 text-[11px]">
                    {['Multi-Account', 'PAT + OAuth', 'Repos', 'Issues', 'PRs', 'Actions', 'Notifications', 'Rate-Limits', '25 Tools'].map(k => <span key={k} className="rounded-full bg-white/10 px-2.5 py-1 border border-white/10">{k}</span>)}
                  </div>
                </div>
                <Card className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 border-white/10 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4" /> So wird installiert</CardTitle>
                    <CardDescription className="text-xs">Im DSH-Profil (z. B. <code>web</code>) — Host + Client werden über <code>cordis.patch.yml</code> + <code>dsh.client</code> automatisch verdrahtet.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-xl bg-zinc-950 text-zinc-100 p-3 font-mono text-xs leading-relaxed flex items-start justify-between gap-3">
                      <span className="break-all">dsh plugin --profile web add /pfad/zu/dsh-plugin-github-manager</span>
                      <button onClick={() => copy('dsh plugin --profile web add /pfad/zu/dsh-plugin-github-manager', 'install')} className="shrink-0 rounded-lg bg-white/10 p-1.5 hover:bg-white/15">{copied === 'install' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3 text-xs">
                      <div className="rounded-xl border bg-zinc-50 dark:bg-zinc-800 p-3"><div className="font-semibold flex items-center gap-1.5"><PlugZap className="h-3.5 w-3.5" /> Host</div><div className="text-muted-foreground mt-1 leading-relaxed">Settings + Credentials + 25 Tools + Remote</div></div>
                      <div className="rounded-xl border bg-zinc-50 dark:bg-zinc-800 p-3"><div className="font-semibold flex items-center gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" /> Client</div><div className="text-muted-foreground mt-1 leading-relaxed">Dashboard pro Account + Settings-Seite</div></div>
                      <div className="rounded-xl border bg-zinc-50 dark:bg-zinc-800 p-3"><div className="font-semibold flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Sicher</div><div className="text-muted-foreground mt-1 leading-relaxed">Token nur im Host-Credential-Store</div></div>
                    </div>
                    <div className="flex gap-2">
                      <a href="https://github.com/dataelement/dsh-desktop" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">DSH Desktop <ExternalLink className="h-3 w-3" /></a>
                      <span className="text-xs text-muted-foreground">·</span>
                      <a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">Harness <ExternalLink className="h-3 w-3" /></a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Pillars */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: KeyRound, title: 'Beides: PAT + OAuth', desc: 'Fine-grained PAT (schnell) oder OAuth Device-Flow (ohne Redirect). Host tauscht Code — Token nie im Browser.' },
                { icon: LayoutDashboard, title: 'Dashboard pro Account', desc: 'Jeder Account hat eigenen Cache, Rate-Limit & Tabs: Repos, Issues, PRs, Actions, Notifications — getrennt.' },
                { icon: Settings2, title: 'Eigene Settings-Seite', desc: 'Default-Account, Base-URL (GHE) pro Account, API-Limits live, Cache-Steuerung. Als settings.section registriert.' },
                { icon: PlugZap, title: '25 Agent-Tools (beides)', desc: 'Der Agent kann listen, erstellen, mergen, triggern — pro Account. Dashboard, Suche, Branches, Rate, alles.' },
              ].map(f => (
                <Card key={f.title} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><span className="h-8 w-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center"><f.icon className="h-4 w-4" /></span>{f.title}</CardTitle></CardHeader>
                  <CardContent><p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p></CardContent>
                </Card>
              ))}
            </div>

            {/* Tech + features list */}
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4" /> Features — alles drin</CardTitle>
                  <CardDescription className="text-xs">Wie gewünscht: Repos, Issues, PRs, Actions, Notifications — jeweils pro Account bedienbar (UI + Agent).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl border p-3 bg-white dark:bg-zinc-900"><div className="font-semibold flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Repositories</div><div className="text-muted-foreground mt-1">Listen, suchen, Detail, Branches. Suche via Search-API.</div></div>
                    <div className="rounded-xl border p-3 bg-white dark:bg-zinc-900"><div className="font-semibold flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Issues</div><div className="text-muted-foreground mt-1">Assigned, pro Repo, Detail, kommentieren, erstellen.</div></div>
                    <div className="rounded-xl border p-3 bg-white dark:bg-zinc-900"><div className="font-semibold flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 rotate-90" /> Pull Requests</div><div className="text-muted-foreground mt-1">Listen, Detail, Files, erstellen, mergen (merge/squash/rebase).</div></div>
                    <div className="rounded-xl border p-3 bg-white dark:bg-zinc-900"><div className="font-semibold flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Actions & Notifications</div><div className="text-muted-foreground mt-1">Workflow-Runs, dispatch, rerun, Inbox, als gelesen markieren.</div></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /> Architektur</CardTitle>
                  <CardDescription className="text-xs">Echtes DSH-Plugin — kein Mock. Host + Client dual-bundle (tsdown), cordis.patch.yml, dsh.client.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-relaxed">
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border p-3 font-mono text-[11px] leading-relaxed">
                    <div>Host: <span className="text-muted-foreground">settings (github-manager) + credentials (github-manager/&lt;id&gt;) + TypertRemote githubManager + 25× defineTool</span></div>
                    <div className="mt-1">Client: <span className="text-muted-foreground">slots: main[github] + sidebar.panellist[github] + settings.section[github]</span></div>
                    <div className="mt-1">Cache: <span className="text-muted-foreground">pro Account, dedup, LRU, 45s Default — invalidierbar</span></div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setRoute('dashboard')} size="sm" className="gap-1.5"><Play className="h-3.5 w-3.5" /> Demo-Dashboard ansehen</Button>
                    <Button variant="outline" size="sm" onClick={() => setRoute('settings')}>Zu Einstellungen</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Vite-Demo läuft ohne echten Harness — Logs & Tokens bleiben in deinem Browser. Im Harness wandern Tokens in den Host-Credential-Store (0600).</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {route === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2"><LayoutDashboard className="h-5 w-5" /> Dashboard</h2>
              {demo && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Demo-Daten — verbinde einen Account für Live-Daten</Badge>}
              {!demo && <span className="text-xs text-muted-foreground hidden sm:inline">Pro Account getrennt · Cache 45s · Rate-Limit pro Account</span>}
            </div>
            <Dashboard api={viewApi} accounts={demoAccounts} activeId={effectiveActive} onActiveChange={setActiveId} />
            {demo && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Oben siehst du Demo-Daten. Für echte Daten verbinde einen Account in <button onClick={() => setRoute('settings')} className="underline font-medium">Einstellungen</button> — PAT oder OAuth.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {route === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2"><Settings2 className="h-5 w-5" /> Einstellungen — GitHub</h2>
            <p className="text-xs text-muted-foreground -mt-2">Hier verwaltest du Accounts (PAT + OAuth), Default, Base-URLs (GHE) und API-Limits. Im Harness ist das die echte <code>settings.section</code> — hier die gleiche UI als Vite-Demo.</p>
            <SettingsPage api={api} />
          </div>
        )}
      </main>

      <footer className="border-t mt-8 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>DSH GitHub Manager · MIT · Built for <a href="https://github.com/dataelement/dsh-desktop" target="_blank" rel="noreferrer" className="underline">DSH Desktop</a> + <a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noreferrer" className="underline">DeepSeek Harness</a></span>
          <span className="inline-flex items-center gap-1">Alles verdrahtet: 25 Tools · Multi-Account · PAT + OAuth · 5 Tabs · Rate-Meter <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /></span>
        </div>
      </footer>
    </div>
  )
}
