/**
 * Every time limit of the tests, in one place. A shared CI runner can be several times slower than a
 * normal run: on 2026-11-22, `check` run 45054961551 took 1,170 s to the 259 s of run 45061626306 on the
 * same image and the same code, every one of the 153 files slower by about the same factor (median
 * 4.3, quartiles 3.9 and 4.7, at most 6.6), DuckDB-backed, renderer and the rest alike. Twelve tests
 * then crossed their limits (5 s, 30 s, and Testing Library's 1 s wait for an element) with nothing
 * wrong. The limits stay as written on a developer's machine and are 6 times as long in CI, which
 * covers that run; `METIS_TEST_TIMEOUT_SCALE` sets another factor.
 */
export const TIMEOUT_SCALE = Number(
  process.env.METIS_TEST_TIMEOUT_SCALE ?? (process.env.CI ? 6 : 1)
)

/** A test's time limit, scaled for the machine running it. */
export const slow = (ms: number): number => Math.round(ms * TIMEOUT_SCALE)
