import { FavouritesContext, useFavouritesState } from '@/lib/stats/favourites'
import { useLeague } from '@/lib/stats/league'

/**
 * The favourites every screen reads through `useFavourites()` (D49). It sits above the shell in
 * `App.tsx`, outside the shell's per-league key, so a switch reads them again without losing them.
 */
export function FavouritesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const league = useLeague().id
  const favourites = useFavouritesState(league)
  return <FavouritesContext.Provider value={favourites}>{children}</FavouritesContext.Provider>
}
