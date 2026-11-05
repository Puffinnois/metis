import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { renderNotes } from '@/lib/updateNotes'
import type { UpdateState } from '@shared/types'

interface UpdateDialogProps {
  state: UpdateState
  currentVersion: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The update popup: release notes, download progress, Update & restart / Later. */
export function UpdateDialog({
  state,
  currentVersion,
  open,
  onOpenChange
}: UpdateDialogProps): React.JSX.Element | null {
  const [installing, setInstalling] = useState(false)
  if (state.status === 'idle' || state.status === 'error') return null

  const notes = renderNotes(state.notes)
  const ready = state.status === 'ready'
  const percent = state.status === 'downloading' ? state.percent : ready ? 100 : 0
  const install = (): void => {
    setInstalling(true)
    void api.update.install().catch(() => setInstalling(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update to {state.version}</DialogTitle>
          <DialogDescription>You&apos;re on {currentVersion}</DialogDescription>
        </DialogHeader>
        {notes === null ? (
          <p className="text-sm text-muted-foreground">No release notes for this version.</p>
        ) : (
          <div
            className="max-h-[50vh] overflow-auto text-sm [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: notes }}
          />
        )}
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
            <div
              data-testid="update-progress"
              className="h-full bg-good transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          {!ready && <p className="text-xs text-muted-foreground">Downloading {percent}%</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Later
          </Button>
          <Button disabled={!ready || installing} onClick={install}>
            {installing ? 'Restarting…' : 'Update & restart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
