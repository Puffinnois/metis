import { Star } from 'lucide-react'
import { favouriteLabel, useFavourites, useHasFavourites } from '@/lib/stats/favourites'
import { cn } from '@/lib/utils'
import type { FavouriteKind } from '@shared/favourites'

const SIZES = {
  sm: { box: 'size-4', icon: 'size-3' },
  lg: { box: 'size-7', icon: 'size-[18px]' }
} as const

/**
 * The favourite star (D49): outlined when off, filled with the gold `--fav` when on. A real button
 * that says whose star it is, and whose click stays its own, never opening the row it sits on. With
 * `reveal`, a star that is off shows only while its row (a `group/fav`) is hovered or holds the focus,
 * and keeps its room while hidden, so nothing on the row moves. Outside a favourites provider it is
 * not drawn.
 */
export function FavouriteStar({
  kind,
  id,
  name,
  size = 'sm',
  reveal = false,
  className
}: {
  kind: FavouriteKind
  id: string
  name: string
  size?: keyof typeof SIZES
  reveal?: boolean
  className?: string
}): React.JSX.Element | null {
  const favourites = useFavourites()
  const shown = useHasFavourites()
  if (!shown) return null
  const on = favourites.isFavourite(kind, id)
  const label = favouriteLabel(name, on)
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      data-favourite={on ? 'true' : 'false'}
      onClick={(e) => {
        e.stopPropagation()
        favourites.toggle(kind, id, name)
      }}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[4px] outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]',
        SIZES[size].box,
        on ? 'text-fav' : 'text-fg-3 hover:text-fg-2',
        reveal &&
          !on &&
          'opacity-0 group-focus-within/fav:opacity-100 group-hover/fav:opacity-100 focus-visible:opacity-100',
        className
      )}
    >
      <Star
        aria-hidden="true"
        className={SIZES[size].icon}
        fill={on ? 'currentColor' : 'none'}
        strokeWidth={on ? 1.5 : 2}
      />
    </button>
  )
}
