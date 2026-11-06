import type {
  BoardMode,
  MetricInfo,
  MetricKind,
  MetricValue,
  StatsResultColumn
} from '@shared/stats/types'

/** What a value needs to be written: its unit and decimals, and whether a mode rescales it. */
export type ValueFormat = Pick<StatsResultColumn, 'unit' | 'decimals'> &
  Partial<Pick<MetricInfo, 'aggregation' | 'totalOnly' | 'perGameOnly'>>

const MINUS = '−'

/** Whether a mode rescales this metric: only a sum that is not kept as a total. */
export function isRescaled(f: ValueFormat, mode: BoardMode): boolean {
  if (mode === 'raw' || f.aggregation !== 'sum' || f.totalOnly) return false
  return mode === 'perGame' || !f.perGameOnly
}

/**
 * A value as the stats screens write it, in Geist Mono: a fraction as a percentage, a total whole, a
 * rescaled total to one decimal at least, a real minus sign.
 */
export function fmtStat(value: number | null, f: ValueFormat, mode: BoardMode = 'raw'): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const decimals = isRescaled(f, mode) ? Math.max(1, f.decimals) : f.decimals
  const shown = f.unit === 'pct' ? value * 100 : value
  let text = Math.abs(shown).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  if (f.unit === 'pct') text += '%'
  const zero = Number(Math.abs(shown).toFixed(decimals)) === 0
  return shown < 0 && !zero ? MINUS + text : text
}

/** The seven shading steps: ≥90 / ≥75 / ≥60 good, ≤10 / ≤25 / ≤40 bad. */
export type Heat = 'h3' | 'h2' | 'h1' | 'n' | 'l1' | 'l2' | 'l3'

export function heatOf(percentile: number | null, direction: MetricInfo['direction']): Heat {
  if (percentile === null || direction === 'neutral') return 'n'
  if (percentile >= 90) return 'h3'
  if (percentile >= 75) return 'h2'
  if (percentile >= 60) return 'h1'
  if (percentile <= 10) return 'l3'
  if (percentile <= 25) return 'l2'
  if (percentile <= 40) return 'l1'
  return 'n'
}

/** "1st", "22nd", "73rd", "11th". */
export function ordinal(n: number): string {
  const r = Math.round(n)
  const teen = r % 100 >= 11 && r % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[r % 10]
  return `${r}${suffix ?? 'th'}`
}

const POSITION_WORDS: Record<string, string> = { G: 'guards', F: 'forwards', C: 'centers' }

/** A cell's hover: percentile and rank within the position, the sample in words, whether it qualifies. */
export function cellTitle(
  v: MetricValue,
  info: Pick<MetricInfo, 'sampleLabel' | 'direction'>,
  position: string | null
): string {
  const among = position ? (POSITION_WORDS[position] ?? `${position}s`) : 'teams'
  const lines: string[] = []
  if (v.percentile !== null && info.direction !== 'neutral') {
    lines.push(`${ordinal(v.percentile)} percentile among qualified ${among}`)
  }
  if (v.rank !== null) lines.push(`Rank ${v.rank}${position ? ` among ${among}` : ''}`)
  if (v.sample !== null) {
    lines.push(`${fmtStat(v.sample, { unit: 'count', decimals: 0 })} ${info.sampleLabel}`)
  }
  if (!v.qualified && v.value !== null) lines.push('Below the qualifying sample')
  return lines.join('\n')
}

const FAMILY_LABELS: Record<MetricInfo['family'], string> = {
  traditional: 'Traditional',
  shooting: 'Shooting',
  possessions: 'Possessions',
  scoring: 'Scoring',
  composite: 'Composite'
}

export function familyLabel(family: MetricInfo['family']): string {
  return FAMILY_LABELS[family]
}

const KIND_LABELS: Record<MetricKind, string> = {
  recorded: 'Recorded',
  derived: 'Derived',
  estimated: 'Estimated',
  model: 'Model'
}

export function kindLabel(kind: MetricKind): string {
  return KIND_LABELS[kind]
}
