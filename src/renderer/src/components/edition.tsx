import { ArrowLeft } from 'lucide-react'

/** ← at the start of the nav: the page before. Alt+← does the same. */
export function BackButton({
  enabled,
  onBack
}: {
  enabled: boolean
  onBack?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="Back"
      title="Back (Alt+←)"
      disabled={!enabled}
      onClick={onBack}
      className="-ml-1.5 flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-fg-2 hover:bg-hover hover:text-fg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <ArrowLeft className="size-4" />
    </button>
  )
}

/** "v0.1.0" beside the wordmark; nothing until the version is read. */
export function VersionTag({ version }: { version: string | null }): React.JSX.Element | null {
  if (version === null) return null
  return <span className="font-mono text-[11px] leading-none text-fg-3">v{version}</span>
}

/** The mark: three stacked bars on a cobalt square. */
export function Mark(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="flex size-[22px] shrink-0 flex-col justify-center gap-[2.5px] rounded-[6px] bg-cobalt px-[5px]"
    >
      {[100, 72, 44].map((w) => (
        <span key={w} className="h-[2.5px] rounded-[2px] bg-on-cobalt" style={{ width: `${w}%` }} />
      ))}
    </span>
  )
}
