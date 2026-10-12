import { Button, Dialog, DialogActions, DialogContent, DialogHeader, Text } from "@salt-ds/core";

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for destructive steps. Salt's Dialog traps focus and returns it on close (A11Y-03). */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }} size="small">
      <DialogHeader header={title} />
      <DialogContent><Text>{body}</Text></DialogContent>
      <DialogActions>
        <Button appearance="bordered" sentiment="neutral" onClick={onCancel}>{cancelLabel}</Button>
        <Button appearance="solid" sentiment="accented" onClick={onConfirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
