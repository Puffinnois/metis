import type { IdentityRecipeName } from '@shared/leagues'

/**
 * Sources of a later tier an identity recipe reads when they are there, by the recipe's name: a play by
 * play that fills what the core tier leaves unknown. A refresh that writes one builds the identity and
 * game tables again at its end (`sync.ts`). Kept apart from the recipes, so the refresh reads it
 * whatever builds the tables.
 */
export const IDENTITY_LATE: Readonly<Record<IdentityRecipeName, readonly string[]>> = {
  nba: [],
  // The league's play by play: a game's overtimes where the game logs and ESPN do not tell them, most
  // games of 1997 to 2001 (`identityWnba.ts`).
  wnba: ['src_wnba_pbp']
}
