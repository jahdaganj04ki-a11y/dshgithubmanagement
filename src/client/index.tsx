/**
 * dsh-plugin-github-manager — Client half
 * Runs inside the Harness Web UI (via dsh.client). Registers:
 * - one `settings.section` ("GitHub")
 * - one main panel key (`github`) + sidebar entry
 * - overlay / dashboard / settings UI
 */
import * as React from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { cordisRemote } from './api.js'
import { Dashboard } from './Dashboard.js'
import { SettingsPage } from './Settings.js'
import { Github, Settings2 } from 'lucide-react'

export const inject = ['slots', 'locale'] as const

// Very small i18n helper (real plugins use @deepseek-ai/dsh-client-locale)
const NS = 'github-manager'
const dict = {
  nav: 'GitHub',
  settingsNav: 'GitHub',
  panelLabel: 'GitHub Manager',
}

function Shell({ ctx }: { ctx: ClientContext }) {
  const api = React.useMemo(() => cordisRemote(ctx), [ctx])
  const [settings, setSettings] = React.useState(() => api.getSettings())
  const [activeId, setActiveId] = React.useState(() => settings.defaultAccountId || settings.accounts[0]?.id || '')
  const [tab, setTab] = React.useState<'dashboard' | 'settings'>('dashboard')

  // Poll settings (cheap) so external writes reflect without reload
  React.useEffect(() => {
    const id = setInterval(() => {
      const s = api.getSettings()
      setSettings(s)
      if (!activeId && s.accounts[0]) setActiveId(s.accounts[0].id)
    }, 2000)
    return () => clearInterval(id)
  }, [api, activeId])

  const effectiveActive = activeId || settings.defaultAccountId || settings.accounts[0]?.id || ''

  return (
    <div className="min-h-[60vh]">
      <div className="flex items-center gap-2 border-b px-3 py-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="h-7 w-7 rounded-xl bg-zinc-900 dark:bg-white grid place-items-center"><Github className="h-4 w-4 text-white dark:text-zinc-900" /></div>
        <span className="text-sm font-semibold">GitHub Manager</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">· Multi-Account · Repos · Issues · PRs · Actions · Notifications</span>
        <div className="ml-auto flex rounded-full bg-zinc-100 dark:bg-zinc-800 p-1 text-xs">
          <button onClick={() => setTab('dashboard')} className={`px-3 py-1 rounded-full font-medium ${tab === 'dashboard' ? 'bg-white dark:bg-zinc-700 shadow' : 'text-muted-foreground hover:text-foreground'}`}>Dashboard</button>
          <button onClick={() => setTab('settings')} className={`px-3 py-1 rounded-full font-medium flex items-center gap-1 ${tab === 'settings' ? 'bg-white dark:bg-zinc-700 shadow' : 'text-muted-foreground hover:text-foreground'}`}><Settings2 className="h-3.5 w-3.5" /> Einstellungen</button>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {tab === 'dashboard' ? (
          <Dashboard api={api} accounts={settings.accounts} activeId={effectiveActive} onActiveChange={setActiveId} />
        ) : (
          <SettingsPage api={api} />
        )}
      </div>
    </div>
  )
}

// Placeholder panel component — the layout slot will render this
function GithubPanel(props: any) {
  // ctx is available via closure in real Harness injection; we also accept props for preview
  // In Harness, `ctx` comes from the Cordis fiber; here we just render Shell with a stub ctx
  const ctx = (props as any).__ctx ?? ({} as ClientContext)
  return <Shell ctx={ctx} />
}

export function apply(ctx: ClientContext): void {
  // Locale
  try { ctx.effect(() => (ctx as any).locale?.register?.(NS, { en: dict, zh: dict }), 'github-manager: locale') } catch {}

  // Register a main panel + a sidebar entry so the user sees "GitHub" in the UI
  // We use the generic layout/slots seam exactly like conversation does
  try {
    const t = (key: string) => (dict as Record<string, string>)[key] ?? key

    // Sidebar panel list entry — shows the GitHub icon in the left nav
    // The actual panel rendering is bound to the `main` keyed slot below
    ctx.slots.inject('sidebar.panellist', () =>
      ctx.slots.register(
        { name: 'sidebar.panellist', id: 'github', order: 25, label: () => t('nav') },
        () => React.createElement('span', { className: 'inline-flex h-5 w-5 items-center justify-center' }, 'GH'),
      ),
    )

    // Main panel — keyed slot `main` with key 'github'
    ctx.slots.inject('main', function* () {
      yield ctx.slots.register(
        { name: 'main', key: 'github' },
        (p: any) => React.createElement(Shell, { ctx }),
      )
    })

    // Settings section — one GitHub page under Settings
    ctx.slots.inject('settings.section', () =>
      ctx.slots.register(
        { name: 'settings.section', id: 'github', order: 12, label: () => t('settingsNav'), locale: NS },
        (p: any) => {
          const api = cordisRemote(ctx)
          return React.createElement(SettingsPage, { api })
        },
      ),
    )
  } catch (e) {
    // When running outside Harness (no slots service) this is expected — Vite demo mounts Shell directly
    // eslint-disable-next-line no-console
    console.warn('[github-manager] slots not available (outside Harness?)', e)
  }
}

export default { apply, inject }
