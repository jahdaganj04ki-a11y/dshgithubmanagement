import { useEffect, useMemo, useState } from 'react'
import type { GithubAccount, DashboardSnapshot, RepoListItem, IssueListItem, PRListItem } from '../shared/types.js'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, cn } from './components/ui.js'
import { RateMeter } from './components/RateMeter.js'
import { AccountSwitcher } from './components/AccountSwitcher.js'
import type { GithubRemote } from './api.js'
import { Search, GitBranch, GitPullRequest, CircleDot, Bell, Activity, Star, Lock, Globe, RefreshCw, ExternalLink, Loader2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'

function useDashboard(api: GithubRemote, account: GithubAccount | null) {
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = async (force = false) => {
    if (!account) return
    if (force) await api.invalidateCache(account.id)
    setLoading(true); setErr(null)
    try {
      const s = await api.getDashboard(account.id, account.login)
      setSnap(s)
    } catch (e: any) { setErr(String(e?.message ?? e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { setSnap(null); load() }, [account?.id])
  return { snap, loading, err, reload: () => load(true), softReload: () => load(false) }
}

export function Dashboard({ api, accounts, activeId, onActiveChange }: { api: GithubRemote; accounts: GithubAccount[]; activeId: string; onActiveChange: (id: string) => void }) {
  const active = useMemo(() => accounts.find(a => a.id === activeId) ?? accounts[0] ?? null, [accounts, activeId])
  const { snap, loading, err, reload } = useDashboard(api, active)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'repos' | 'issues' | 'prs' | 'actions' | 'notifications'>('all')

  const filteredRepos: RepoListItem[] = useMemo(() => {
    if (!snap) return []
    if (!q) return snap.repos
    const qq = q.toLowerCase()
    return snap.repos.filter(r => r.fullName.toLowerCase().includes(qq) || (r.description ?? '').toLowerCase().includes(qq))
  }, [snap, q])

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-zinc-50 dark:bg-zinc-900/50 p-8 text-center">
        <div className="mx-auto max-w-md space-y-3">
          <div className="mx-auto h-10 w-10 rounded-2xl bg-zinc-900 dark:bg-white grid place-items-center"><Sparkles className="h-5 w-5 text-white dark:text-zinc-900" /></div>
          <h3 className="text-sm font-semibold">Noch kein GitHub-Account verbunden</h3>
          <p className="text-xs text-muted-foreground">Füge in <span className="font-medium">Einstellungen → GitHub</span> einen Account hinzu — per <b>PAT</b> (fine-grained) oder <b>OAuth Device-Flow</b>. Multi-Account wird voll unterstützt; das Dashboard ist pro Account getrennt.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AccountSwitcher accounts={accounts} activeId={active?.id ?? ''} onSelect={onActiveChange} />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Repos filtern…" className="h-8 w-[220px] pl-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="h-8">
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />} Aktualisieren
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2.5 flex gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-amber-900 dark:text-amber-200">{err}</span>
        </div>
      )}

      {active && (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Dashboard — @{active.login}
                <span className="text-xs font-normal text-muted-foreground">· {active.label}</span>
                {active.authKind === 'oauth' ? <Badge variant="outline" className="ml-1 text-[10px]">OAuth</Badge> : <Badge variant="secondary" className="text-[10px]">PAT</Badge>}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">{snap ? `Stand: ${new Date(snap.fetchedAt).toLocaleString('de-DE')} · ${snap.repos.length} Repos · ${snap.issues.length} Issues · ${snap.prs.length} PRs` : loading ? 'Lade…' : '—'}</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'repos', 'issues', 'prs', 'actions', 'notifications'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} className={cn('rounded-full px-3 py-1 text-xs font-medium border', tab === t ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50')}>{t}</button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> API-Limit</CardTitle></CardHeader>
            <CardContent><RateMeter rate={snap?.rate} /></CardContent>
          </Card>
        </div>
      )}

      {!snap && loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-2xl border bg-zinc-50 dark:bg-zinc-900 animate-pulse" />)}
        </div>
      )}

      {snap && (
        <>
          {(tab === 'all' || tab === 'repos') && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4" /> Repositories <Badge variant="secondary" className="ml-1">{filteredRepos.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                {filteredRepos.length === 0 ? <p className="text-xs text-muted-foreground">Keine Repos gefunden.</p> : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredRepos.slice(0, 12).map(r => (
                      <a key={r.id} href={`https://github.com/${r.fullName}`} target="_blank" rel="noreferrer" className="group rounded-xl border bg-white dark:bg-zinc-900 p-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate group-hover:underline">{r.fullName}</div>
                            <div className="text-[11px] text-muted-foreground line-clamp-2 leading-tight mt-1">{r.description ?? '—'}</div>
                          </div>
                          {r.private ? <Lock className="h-3.5 w-3.5 text-zinc-400 shrink-0" /> : <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {r.language && <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">{r.language}</span>}
                          <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{r.stars}</span>
                          <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{r.forks}</span>
                          <span className="ml-auto"><ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" /></span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(tab === 'all' || tab === 'issues') && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CircleDot className="h-4 w-4" /> Issues <Badge variant="secondary" className="ml-1">{snap.issues.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                {snap.issues.length === 0 ? <p className="text-xs text-muted-foreground">Keine offenen Issues (assigned).</p> : (
                  <div className="space-y-2">
                    {snap.issues.slice(0, 10).map((it: IssueListItem) => (
                      <div key={it.id} className="flex items-start gap-3 rounded-xl border p-3 bg-white dark:bg-zinc-900">
                        <span className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0', it.state === 'open' ? 'bg-emerald-500' : 'bg-zinc-400')} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium leading-tight line-clamp-2">#{it.number} {it.title}</div>
                          <div className="text-[11px] text-muted-foreground">von @{it.user} · {new Date(it.updatedAt).toLocaleDateString('de-DE')} · {it.comments} Kommentare</div>
                          {it.labels.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{it.labels.map(l => <span key={l} className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px]">{l}</span>)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(tab === 'all' || tab === 'prs') && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><GitPullRequest className="h-4 w-4" /> Pull Requests <Badge variant="secondary" className="ml-1">{snap.prs.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                {snap.prs.length === 0 ? <p className="text-xs text-muted-foreground">Keine offenen PRs gefunden.</p> : (
                  <div className="space-y-2">
                    {snap.prs.slice(0, 10).map((pr: PRListItem) => (
                      <div key={pr.id} className="flex items-start gap-3 rounded-xl border p-3 bg-white dark:bg-zinc-900">
                        <GitPullRequest className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', pr.draft ? 'text-zinc-400' : 'text-violet-600')} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium leading-tight line-clamp-2">#{pr.number} {pr.title} {pr.draft && <span className="text-[10px] rounded-full bg-zinc-100 px-1.5 py-0.5 ml-1">Draft</span>}</div>
                          <div className="text-[11px] text-muted-foreground">von @{pr.user} · {new Date(pr.updatedAt).toLocaleDateString('de-DE')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(tab === 'all' || tab === 'actions') && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4" /> Actions <Badge variant="secondary" className="ml-1">{snap.runs.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                {snap.runs.length === 0 ? <p className="text-xs text-muted-foreground">Keine Workflow-Runs (Top-Repo) gefunden. In einem Repo mit Actions siehst du hier die letzten Runs.</p> : (
                  <div className="space-y-2">
                    {snap.runs.map(r => (
                      <a key={r.id} href={r.htmlUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border p-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <span className={cn('h-2 w-2 rounded-full shrink-0', r.conclusion === 'success' ? 'bg-emerald-500' : r.conclusion === 'failure' ? 'bg-red-500' : r.conclusion === 'cancelled' ? 'bg-zinc-400' : 'bg-amber-400')} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{r.name} <span className="font-normal text-muted-foreground">· {r.branch}</span></div>
                          <div className="text-[11px] text-muted-foreground">{r.status} {r.conclusion && `· ${r.conclusion}`} · {new Date(r.createdAt).toLocaleString('de-DE')}</div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(tab === 'all' || tab === 'notifications') && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" /> Notifications <Badge variant="secondary" className="ml-1">{snap.notifications.length}</Badge> {snap.notifications.some(n => n.unread) && <Badge variant="success" className="ml-1">neu</Badge>}</CardTitle></CardHeader>
              <CardContent>
                {snap.notifications.length === 0 ? <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Keine Notifications — Inbox Zero!</p> : (
                  <div className="space-y-2">
                    {snap.notifications.slice(0, 12).map(n => (
                      <div key={n.id} className={cn('rounded-xl border p-3 flex gap-3', n.unread ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' : 'bg-white dark:bg-zinc-900')}>
                        <span className={cn('mt-1 h-2 w-2 rounded-full shrink-0', n.unread ? 'bg-amber-500' : 'bg-zinc-300')} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium leading-tight line-clamp-2">{n.subjectTitle}</div>
                          <div className="text-[11px] text-muted-foreground">{n.repo} · {n.subjectType} · {n.reason} · {new Date(n.updatedAt).toLocaleString('de-DE')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
