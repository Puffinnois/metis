import { configure } from '@testing-library/dom'
import { slow } from './timeouts'

// Testing Library's wait for an element (`findBy…`, `waitFor`), 1 s by default, scaled as every other
// time limit (`timeouts.ts`).
configure({ asyncUtilTimeout: slow(1_000) })
