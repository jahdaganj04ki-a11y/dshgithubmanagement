import { useEffect, useMemo, useState } from 'react'
import type { GithubAccount } from '../shared/types.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label, Badge, Separator, Textarea } from './components/ui.js'
import { RateMeter } from './components/RateMeter.js'
import type { GithubRemote } from './api.js'
import { Shield, KeyRound, Link2, Trash2, Star, Globe, Settings2, Check, Loader2, AlertTriangle, ExternalLink, Copy, RefreshCw } from 'lucide-react'

export function SettingsPage({ api }: { api: GithubRemote }) {
  const [settings, setSettings] = useState(() => api.getSettings())
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [patLabel, setPatLabel] = useState('')
  const [patToken, setPatToken] = useState('')
  const [patBaseUrl, setPatBaseUrl] = useState('')
  const [showToken, setShowToken] = useState(false)

  // OAuth device-flow UI
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthPending, setOauthPending] = useState<{ accountId: string; user_code: string; verification_uri: string; verification_uri_complete?: string } | null>(null)
  const [oauthPolling, setOauthPolling] = useState(false)

  const [rateById, setRateById] = useState<Record<string, any>>({})
  const [query, setQuery] = useState('')

  // hydrate from actual settings
  const refresh = () => setSettings(api.getSettings())
  useEffect(() => { refresh() }, [])

  // Load rate for all accounts on entry
  useEffect(() => {
    let cancelled = false
    for (const a of settings.accounts) {
      api.getRateLimit(a.id).then(r => { if (!cancelled) setRateById(m => ({ ...m, [a.id]: r })) }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [settings.accounts.length])

  const filtered = useMemo(() => {
    if (!query) return settings.accounts
    const q = query.toLowerCase()
    return settings.accounts.filter(a => a.label.toLowerCase().includes(q) || a.login.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
  }, [settings.accounts, query])

  const handleAddPat = async () => {
    if (!patToken.trim()) { setMsg({ kind: 'err', text: 'Token ist leer.' }); return }
    if (!patLabel.trim()) { setMsg({ kind: 'err', text: 'Label erforderlich (z. B. "Work" / "Privat").' }); return }
    setBusy('add'); setMsg(null)
    try {
      const acct = await api.addAccount({ label: patLabel.trim(), token: patToken.trim(), baseUrl: patBaseUrl.trim() || undefined })
      setPatToken(''); setPatLabel(''); setPatBaseUrl('')
      refresh()
      // try rate
      api.getRateLimit(acct.id).then(r => setRateById(m => ({ ...m, [acct.id]: r }))).catch(() => {})
      setMsg({ kind: 'ok', text: `Account @${acct.login} verbunden.` })
    } catch (e: any) { setMsg({ kind: 'err', text: String(e?.message ?? e) }) }
    finally { setBusy(null) }
  }

  const handleRemove = async (id: string) => {
    if (!confirm('Account wirklich entfernen? Token wird gelöscht.')) return
    setBusy(id)
    try { await api.removeAccount(id); refresh(); setMsg({ kind: 'ok', text: 'Account entfernt.' }) } catch (e: any) { setMsg({ kind: 'err', text: String(e?.message ?? e) }) }
    finally { setBusy(null) }
  }

  const handleDefault = async (id: string) => {
    setBusy(`def-${id}`)
    try { await api.setDefault(id); refresh(); setMsg({ kind: 'ok', text: 'Default-Account gesetzt.' }) } catch (e: any) { setMsg({ kind: 'err', text: String(e?.message ?? e) }) }
    finally { setBusy(null) }
  }

  const handleValidate = async (id: string) => {
    setBusy(`val-${id}`)
    try {
      const st = await api.getStatus(id)
      if (st.ok) { setMsg({ kind: 'ok', text: `@${st.login} — Token gültig. Scopes: ${(st.scopes ?? []).join(', ') || '—'}` }); refresh(); api.getRateLimit(id).then(r => setRateById(m => ({ ...m, [id]: r }))).catch(() => {}) }
      else setMsg({ kind: 'err', text: st.message ?? 'Validierung fehlgeschlagen' })
    } catch (e: any) { setMsg({ kind: 'err', text: String(e?.message ?? e) }) }
    finally { setBusy(null) }
  }

  // NOTE: OAuth Device Flow via Host (when running inside DSH Desktop, Host proxies the token exchange).
  // In Vite demo we show the PAT flow; OAuth button explains how it works in the real plugin.
  const handleOAuthStartDemo = () => {
    if (!oauthClientId.trim()) { setMsg({ kind: 'err', text: 'GitHub OAuth App Client ID eintragen (GitHub → Settings → Developer settings → OAuth Apps).' }); return }
    setMsg({ kind: 'err', text: 'OAuth Device-Flow läuft im DSH Desktop (Host) — dort öffnet das Plugin den Geräte-Code und tauscht serverseitig. In dieser Vite-Demo nutze bitte PAT.' })
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {msg && (
        <div className={`rounded-xl border px-3 py-2.5 flex gap-2 text-xs ${msg.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-200' : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200'}`}>
          {msg.kind === 'ok' ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-auto text-xs underline opacity-70 hover:opacity-100">schließen</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Account hinzufügen — PAT</CardTitle>
            <CardDescription>Fine-grained PAT (empfohlen) oder classic PAT. Token wird im DSH Desktop im Credential-Store gespeichert (0600, OS-geschützt), nicht im Klartext auf Disk. In dieser Demo lokal (localStorage) — niemals in Screenshots teilen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input value={patLabel} onChange={e => setPatLabel(e.target.value)} placeholder='z. B. "Privat" / "Work"' />
              </div>
              <div className="space-y-1.5">
                <Label>GitHub Enterprise Base URL (optional)</Label>
                <div className="flex gap-2">
                  <Input value={patBaseUrl} onChange={e => setPatBaseUrl(e.target.value)} placeholder="https://ghe.example.com/api/v3" className="flex-1" />
                </div>
                <p className="text-[11px] text-muted-foreground">Leer lassen für github.com</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Token</Label>
              <div className="flex gap-2">
                <Input value={patToken} onChange={e => setPatToken(e.target.value)} placeholder="github_pat_… oder ghp_…" type={showToken ? 'text' : 'password'} className="flex-1 font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={() => setShowToken(v => !v)}>{showToken ? 'Verbergen' : 'Anzeigen'}</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Scopes-Empfehlung: <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">repo</code> <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">read:org</code> <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">notifications</code> <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px]">workflow</code> (für Actions-Runs)</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddPat} disabled={busy === 'add'} className="gap-1.5">
                {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Account verbinden
              </Button>
              <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline">Token auf GitHub erstellen <ExternalLink className="h-3 w-3" /></a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> OAuth — Device Flow</CardTitle>
            <CardDescription>In DSH Desktop: beides anbieten (PAT <em>und</em> OAuth). Device-Flow braucht keine Redirect-URL — User bestätigt auf github.com/device. Token-Tausch läuft Host-seitig (Pat nie im Browser).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>GitHub OAuth App — Client ID</Label>
              <Input value={oauthClientId} onChange={e => setOauthClientId(e.target.value)} placeholder="Iv1.… (aus deiner OAuth App)" className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">Erstelle eine OAuth App unter GitHub → Settings → Developer settings → OAuth Apps. Callback-URL ist egal (Device-Flow).</p>
            </div>
            {oauthPending ? (
              <div className="rounded-xl border bg-zinc-50 dark:bg-zinc-900 p-3 space-y-2">
                <div className="text-xs font-semibold">Auf Bestätigung warten — Code: <span className="font-mono tracking-widest text-sm bg-white dark:bg-zinc-800 px-2 py-1 rounded border">{oauthPending.user_code}</span> <Button variant="ghost" size="sm" className="h-7 ml-1" onClick={() => navigator.clipboard.writeText(oauthPending.user_code)}><Copy className="h-3.5 w-3.5" /></Button></div>
                <a href={oauthPending.verification_uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">Auf GitHub bestätigen <ExternalLink className="h-3 w-3" /></a>
                {oauthPending.verification_uri_complete && <div className="text-[11px] break-all text-muted-foreground">{oauthPending.verification_uri_complete}</div>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={oauthPolling} onClick={async () => {
                    // In Harness: polls host. In Vite demo: inform user.
                    setOauthPolling(true)
                    setMsg({ kind: 'err', text: 'OAuth Device-Poll läuft im DSH Desktop-Host — in dieser Demo per PAT verbinden.' })
                    setTimeout(() => setOauthPolling(false), 800)
                  }}>{oauthPolling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Pollen</Button>
                  <Button variant="outline" size="sm" onClick={() => setOauthPending(null)}>Abbrechen</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={handleOAuthStartDemo} className="w-full gap-1.5"><Globe className="h-4 w-4" /> OAuth Device-Flow starten</Button>
            )}
            <p className="text-[11px] text-muted-foreground">Scritt: App anlegen → Client-ID hier eintragen → <em>Geräte-Code</em> generieren → User bestätigt auf GitHub → Host tauscht Code → Account erscheint unten.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Accounts <Badge variant="secondary" className="ml-1">{settings.accounts.length}</Badge> {settings.defaultAccountId && <Badge variant="outline" className="text-[10px]">Default: @{settings.accounts.find(a => a.id === settings.defaultAccountId)?.login ?? '—'}</Badge>}</CardTitle>
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtern…" className="h-8 w-[180px] text-xs" />
          </div>
          <CardDescription>Multi-Account: jeder Account ist isoliert (eigenes Token, eigener Dashboard-Cache, eigene Rate-Limits). Default-Account wird für Tools ohne <code>accountId</code> genutzt und ist im Dashboard vorausgewählt.</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">{settings.accounts.length === 0 ? 'Noch keine Accounts.' : 'Kein Treffer.'}</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(a => {
                const rate = rateById[a.id]
                const isDefault = settings.defaultAccountId === a.id
                const busyThis = busy === a.id || busy === `def-${a.id}` || busy === `val-${a.id}`
                return (
                  <div key={a.id} className={`rounded-2xl border p-3 sm:p-4 ${isDefault ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/60' : 'bg-white dark:bg-zinc-900'}`}>
                    <div className="flex gap-3">
                      {a.avatarUrl ? <img src={a.avatarUrl} alt={a.login} className="h-10 w-10 rounded-full object-cover shrink-0" /> : <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 grid place-items-center text-sm font-semibold shrink-0">{a.login.slice(0, 1).toUpperCase()}</div>}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{a.label}</span>
                          <span className="text-xs text-muted-foreground">@{a.login}</span>
                          {isDefault ? <Badge variant="success" className="gap-1"><Star className="h-3 w-3" /> Default</Badge> : <Badge variant="outline" className="text-[10px]">ID {a.id.slice(0, 8)}</Badge>}
                          <Badge variant={a.authKind === 'oauth' ? 'outline' : 'secondary'} className="text-[10px]">{a.authKind.toUpperCase()}</Badge>
                          {a.lastValidatedOk === false && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Token prüfen</Badge>}
                        </div>
                        {a.scopes && a.scopes.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{a.scopes.map(s => <span key={s} className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px]">{s}</span>)}</div>}
                        <div className="mt-2">
                          <RateMeter rate={rate} />
                        </div>
                        {a.lastValidatedAt && <div className="text-[11px] text-muted-foreground mt-2">Zuletzt validiert: {new Date(a.lastValidatedAt).toLocaleString('de-DE')}</div>}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {!isDefault && <Button variant="outline" size="sm" disabled={!!busyThis} onClick={() => handleDefault(a.id)} className="h-7 text-xs gap-1"><Star className="h-3 w-3" /> Default</Button>}
                        <Button variant="outline" size="sm" disabled={!!busyThis} onClick={() => handleValidate(a.id)} className="h-7 text-xs gap-1">{busy === `val-${a.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Prüfen</Button>
                        <Button variant="ghost" size="sm" disabled={!!busyThis} onClick={() => handleRemove(a.id)} className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-3 w-3" /> Entfernen</Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <Separator className="my-4" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-zinc-50 dark:bg-zinc-900 p-3">
              <div className="text-xs font-semibold mb-1">API-Limits</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">GitHub erlaubt 5.000 Requests/Stunde (PAT) pro Account. Der Manager cached pro Account (Default 45s), dedupliziert parallele Requests und zeigt <em>pro Account</em> verbleibendes Limit + Reset-Zeit. Bei Enterprise (GHE) kann pro Account eine eigene <code>baseUrl</code> hinterlegt werden.</p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                  const s = api.getSettings()
                  for (const a of s.accounts) {
                    try { const r = await api.getRateLimit(a.id); setRateById(m => ({ ...m, [a.id]: r })) } catch {}
                  }
                }}><RefreshCw className="h-3 w-3 mr-1" /> Limits neu laden</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={async () => { await api.invalidateCache(); setMsg({ kind: 'ok', text: 'Cache geleert.' }) }}>Cache leeren</Button>
              </div>
            </div>
            <div className="rounded-xl border bg-zinc-50 dark:bg-zinc-900 p-3">
              <div className="text-xs font-semibold mb-1">Agent-Tools</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">25 Tools sind im Harness registriert — Repos, Issues, PRs (inkl. merge), Actions, Notifications, Suche, Branches, Dashboard, Rate, usw. Jedes Tool nimmt <code>accountId</code> (optional, sonst Default). So kann der Agent pro Aufgabe den richtigen Account wählen (<em>beides</em> wie gewünscht).</p>
              <p className="text-[11px] text-muted-foreground mt-1">Install: <code className="px-1 py-0.5 rounded bg-white dark:bg-zinc-800 border text-[11px]">dsh plugin --profile web add /pfad/zu/dsh-plugin-github-manager</code></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Hinweis für DSH Desktop</CardTitle><CardDescription className="text-xs leading-relaxed">Dieses Plugin nutzt — wenn im Harness installiert — <code>settings: github-manager</code> (Accounts + Prefs, ohne Tokens) + <code>credentials: github-manager/&lt;accountId&gt;</code> (Token, 0600, Host-geschützt) + Typert-Remote <code>githubManager</code>. Tokens verlassen nie den Host. Der Agent kann <code>github_list_repos</code>, <code>github_dashboard</code>, <code>github_create_issue</code>, <code>github_create_pr</code> usw. direkt aufrufen — Multi-Account inklusive. <a href="https://github.com/dataelement/dsh-desktop" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">DSH Desktop <ExternalLink className="h-3 w-3" /></a> · <a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">Harness <ExternalLink className="h-3 w-3" /></a></CardDescription></CardHeader>
      </Card>
    </div>
  )
}
