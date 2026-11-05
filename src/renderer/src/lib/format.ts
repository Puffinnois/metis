export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'never'
  const minutes = Math.round((now - t) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function errorMessage(err: unknown): string {
  return err instanceof Error
    ? err.message.replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, '')
    : String(err)
}

/** "+3.20" / "-0.80" / "—"; two decimals for points, pass `decimals = 1` for other stats. */
export function fmtSigned(value: number | null, decimals = 2): string {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(decimals)}`
}

/** Percentages are 0–1 fractions. */
export function fmtPct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

/** "+9%" / "-13%" / "0%" / "—" from a fraction. */
export function fmtSignedPct(value: number | null): string {
  if (value === null) return '—'
  const pct = Math.round(value * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}
