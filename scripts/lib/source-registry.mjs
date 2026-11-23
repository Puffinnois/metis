// The source registry (`src/main/stats/sources.ts`) read under plain Node, without bundling, for the
// scripts that measure a load. It imports the league registry (`@shared/leagues`, since T1304.2's
// pairs), an alias Node cannot resolve, so that import is pointed at the league registry's own
// transpiled text; the league registry imports only types.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const transpiled = (file) =>
  ts.transpileModule(readFileSync(join(ROOT, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
const asUrl = (code) => `data:text/javascript,${encodeURIComponent(code)}`

/** The source registry's exports: `SOURCES_BY_LEAGUE`, `LOAD_TIERS`, `fileName` and the rest. */
export async function loadSourceRegistry() {
  const sources = transpiled('src/main/stats/sources.ts').replace(
    /from '@shared\/leagues'/,
    // Double quotes: the encoded text keeps its apostrophes, and encodes double quotes.
    `from "${asUrl(transpiled('src/shared/leagues.ts'))}"`
  )
  return import(asUrl(sources))
}
