import type { RateLimitView } from '../../shared/types.js'

export function RateMeter({ rate }: { rate: RateLimitView | null | undefined }) {
  if (!rate) return <div className="text-xs text-muted-foreground">Kein Rate-Limit geladen</div>
  const pct = Math.max(0, Math.min(100, Math.round((rate.remaining / Math.max(1, rate.limit)) * 100)))
  const resetsIn = (() => {
    const ms = new Date(rate.resetAt).getTime() - Date.now()
    if (ms <= 0) return 'läuft ab'
    const m = Math.round(ms / 60000)
    if (m < 60) return `in ${m} Min`
    return `in ${Math.round(m / 60)} Std`
  })()
  const color = pct > 40 ? 'bg-emerald-500' : pct > 15 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{rate.remaining.toLocaleString('de-DE')} / {rate.limit.toLocaleString('de-DE')} verbleibend</span>
        <span className="text-muted-foreground">{resetsIn}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11px] text-muted-foreground">Resource: {rate.resource} · Reset: {new Date(rate.resetAt).toLocaleString('de-DE')}</div>
    </div>
  )
}
