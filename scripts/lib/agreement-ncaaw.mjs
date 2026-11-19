// The ncaaw agreement checks: the college module's, for this league (`agreement-college.mjs`).
import { collegeAgreement } from './agreement-college.mjs'

export const runAgreement = (read, out, query) => collegeAgreement('ncaaw', read, out, query)
