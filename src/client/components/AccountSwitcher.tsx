import type { GithubAccount } from '../../shared/types.js'
import { cn } from './ui.js'

export function AccountSwitcher({
  accounts,
  activeId,
  onSelect,
  compact,
}: {
  accounts: GithubAccount[]
  activeId: string
  onSelect: (id: string) => void
  compact?: boolean
}) {
  if (accounts.length === 0) return <div className="text-xs text-muted-foreground">Keine Accounts — in Einstellungen hinzufügen.</div>
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto pb-1', compact && 'flex-wrap')}>
      {accounts.map(a => {
        const active = a.id === activeId
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              active ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800',
            )}
          >
            {a.avatarUrl ? <img src={a.avatarUrl} alt={a.login} className="h-5 w-5 rounded-full object-cover" /> : <span className="h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-700 grid place-items-center text-[10px]">{a.login.slice(0, 1).toUpperCase()}</span>}
            <span className="max-w-[14ch] truncate">{a.label}</span>
            <span className={cn('text-[10px] rounded-full px-1.5 py-0.5', active ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')}>@{a.login}</span>
          </button>
        )
      })}
    </div>
  )
}
