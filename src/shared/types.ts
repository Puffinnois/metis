/** Auto-update progress as owned by the main process; the renderer only renders it. */
export type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string; notes: string | null }
  | { status: 'downloading'; version: string; notes: string | null; percent: number }
  | { status: 'ready'; version: string; notes: string | null }
  | { status: 'error'; message: string }
