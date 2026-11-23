import { Star } from 'lucide-react'
import { favouriteLabel, useFavourites, useHasFavourites } from '@/lib/stats/favourites'
import { cn } from '@/lib/utils'
import type { FavouriteKind } from '@shared/favourites'

/**
 * The static favourite mark (T1601.2): a small filled gold star, shown only for a favourite, never a
 * button. Every screen that lists players or teams where the star is not toggled uses it; a row that
 * is not a favourite gets nothing. `on` is for a caller that already looked it up.
 */
export function FavouriteMark({
  kind,
  id,
  on,
  className
}: {
  kind: FavouriteKind
  id: string | null | undefined
  on?: boolean
  className?: string
}): React.JSX.Element | null {
  const favourites = useFavourites()
  const shown = on ?? (id != null && favourites.isFavourite(kind, id))
  if (!shown) return null
  return (
    <span
      role="img"
      aria-label="Favourite"
      title="Favourite"
      className={cn('inline-flex shrink-0 items-center text-fav', className)}
    >
      <Star aria-hidden="true" className="size-[11px]" fill="currentColor" strokeWidth={1.5} />
    </span>
  )
}

/**
 * A name with the mark before it, for a favourite, cut with an ellipsis where it runs long. Before the
 * name so a long one never hides it, and inside the name's own cell so no column moves.
 */
export function FavouriteName({
  kind,
  id,
  children,
  className
}: {
  kind: FavouriteKind
  id: string | null | undefined
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn('inline-flex max-w-full min-w-0 items-center gap-1 align-bottom', className)}
    >
      <FavouriteMark kind={kind} id={id} />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

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
