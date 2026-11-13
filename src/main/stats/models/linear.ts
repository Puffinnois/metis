/** Small dense linear algebra for the models: they solve for 30 teams, not millions of rows. */

/**
 * Solves `A x = b` by Gaussian elimination with partial pivoting. `A` is n × n, row-major; neither
 * input is changed. Throws on a singular system.
 */
export function solve(a: Float64Array, b: Float64Array, n: number): Float64Array {
  const m = Float64Array.from(a)
  const x = Float64Array.from(b)
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r * n + col]) > Math.abs(m[pivot * n + col])) pivot = r
    }
    if (Math.abs(m[pivot * n + col]) < 1e-15) throw new Error('singular system')
    if (pivot !== col) {
      for (let c = 0; c < n; c++) {
        const t = m[col * n + c]
        m[col * n + c] = m[pivot * n + c]
        m[pivot * n + c] = t
      }
      const t = x[col]
      x[col] = x[pivot]
      x[pivot] = t
    }
    const d = m[col * n + col]
    for (let r = col + 1; r < n; r++) {
      const f = m[r * n + col] / d
      if (f === 0) continue
      for (let c = col; c < n; c++) m[r * n + c] -= f * m[col * n + c]
      x[r] -= f * x[col]
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r]
    for (let c = r + 1; c < n; c++) s -= m[r * n + c] * x[c]
    x[r] = s / m[r * n + r]
  }
  return x
}
