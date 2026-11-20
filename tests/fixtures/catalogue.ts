import { LEAGUES } from '@shared/leagues'
import { CATALOGUE, metricIn } from '@shared/stats/catalogue'
import { sampleLabel } from '@shared/stats/samples'
import type { MetricDef, MetricInfo } from '@shared/stats/types'

/**
 * The catalogue as the renderer receives it, for tests of the screens: the NBA's, so a metric only
 * another league has reads unavailable, as the league's catalogue sends it.
 */
export function catalogueFixture(): MetricInfo[] {
  return CATALOGUE.map((m) => metricIn(m, LEAGUES.nba)).map((def) => {
    const info: Partial<MetricDef> = { ...def }
    delete info.value
    delete info.sample
    return {
      ...(info as Omit<MetricDef, 'value' | 'sample'>),
      grains: def.published ? ['season'] : ['game', 'season'],
      sampleLabel: sampleLabel(def.sample),
      qualifyLabel: sampleLabel(def.qualifyBy ?? def.sample),
      stability: null
    }
  })
}
