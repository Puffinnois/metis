/** A season as the screens write it: the data's `2026` is `2025-26`. */
export function seasonLabel(season: number): string {
  return `${season - 1}-${String(season % 100).padStart(2, '0')}`
}
