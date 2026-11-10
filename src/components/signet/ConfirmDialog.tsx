import { Button } from "@omnidotdev/thornberry/button";

import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** true while the confirmed action is in flight: locks the dialog */
  busy?: boolean;
  /** style the confirm button as destructive (delete/remove) */
  destructive?: boolean;
}

/**
 * A confirmation dialog for actions the user cannot trivially undo. Built on the
 * shared dialog primitive (never a native confirm): the dialog cannot be
 * dismissed while the action is in flight, and the confirm button carries the
 * destructive styling when the action removes data.
 */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  destructive = false,
}: Props) => (
  <DialogRoot
    open={open}
    onOpenChange={(e) => {
      // do not allow dismissing while the action is running
      if (busy) return;
      onOpenChange(e.open);
    }}
    closeOnEscape={!busy}
    closeOnInteractOutside={!busy}
  >
    <DialogBackdrop />
    <DialogContent>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant={destructive ? "destructive" : "solid"}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Working..." : confirmLabel}
        </Button>
      </div>
    </DialogContent>
  </DialogRoot>
);

export default ConfirmDialog;
