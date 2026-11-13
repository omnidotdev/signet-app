import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseBulkCsv } from "@/lib/signet/bulkCsv";

/** Matches the API's per-request cap */
const BULK_SEND_MAX = 100;

interface Props {
  template: { id: string; name: string; roles: string[] } | null;
  onClose: () => void;
}

/**
 * Send one template to many recipients from a CSV: one line per document, a
 * name and email for each signer role. The CSV is parsed and checked in the
 * browser first, and nothing is sent until every line is valid.
 */
const BulkSendDialog = ({ template, onClose }: Props) => {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const roles = template?.roles ?? [];
  const parsed = useMemo(
    () => parseBulkCsv(text, Math.max(roles.length, 1)),
    [text, roles.length],
  );
  const tooMany = parsed.rows.length > BULK_SEND_MAX;
  const columns = roles.flatMap((r) => [`${r} name`, `${r} email`]).join(", ");

  const send = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("no_template");
      const res = await fetch(
        `/api/signet/templates/${encodeURIComponent(template.id)}/bulk-send`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rows: parsed.rows }),
        },
      );
      if (!res.ok) throw new Error("bulk_send_failed");
      return (await res.json()) as { sent: unknown[]; failed: number[] };
    },
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["signet"] });
      if (r.failed.length > 0) {
        toast.warning(
          `Sent ${r.sent.length} document${r.sent.length === 1 ? "" : "s"}; ${r.failed.length} could not be sent. Check your documents list.`,
        );
      } else {
        toast.success(
          `Sent ${r.sent.length} document${r.sent.length === 1 ? "" : "s"} for signature.`,
        );
      }
      setText("");
      onClose();
    },
    onError: () => toast.error("Could not send. Nothing was sent; try again."),
  });

  const onFile = (f: File | null) => {
    if (!f) return;
    void f.text().then(setText);
  };

  const canSend =
    parsed.rows.length > 0 &&
    parsed.errors.length === 0 &&
    !tooMany &&
    !send.isPending;

  return (
    <DialogRoot
      open={template !== null}
      onOpenChange={(e) => {
        if (send.isPending) return;
        if (!e.open) onClose();
      }}
      closeOnEscape={!send.isPending}
      closeOnInteractOutside={!send.isPending}
    >
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>Bulk send "{template?.name}"</DialogTitle>
        <DialogDescription>
          Each line becomes its own document, sent for signature right away.
          List a name and email for every signer, in this order: {columns}.
        </DialogDescription>

        <textarea
          className="input mt-3 min-h-36 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={roles
            .flatMap((_, i) => [`Name ${i + 1}`, `name${i + 1}@example.com`])
            .join(",")}
          aria-label="Recipients CSV"
        />
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-primary text-sm hover:underline">
          Or upload a .csv file
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-3 space-y-1 text-sm">
          {parsed.skippedHeader && (
            <p className="text-muted-foreground">
              Skipped the first line as a header: "{parsed.skippedHeader}"
            </p>
          )}
          {parsed.rows.length > 0 && parsed.errors.length === 0 && !tooMany && (
            <p>
              {parsed.rows.length} document
              {parsed.rows.length === 1 ? "" : "s"} ready to send.
            </p>
          )}
          {tooMany && (
            <p className="text-destructive">
              Up to {BULK_SEND_MAX} documents per batch; this has{" "}
              {parsed.rows.length}. Split it into smaller batches.
            </p>
          )}
          {parsed.errors.slice(0, 5).map((e) => (
            <p key={e.line} className="text-destructive">
              Line {e.line}: {e.message}
            </p>
          ))}
          {parsed.errors.length > 5 && (
            <p className="text-destructive">
              And {parsed.errors.length - 5} more line
              {parsed.errors.length - 5 === 1 ? "" : "s"} to fix.
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={send.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSend} onClick={() => send.mutate()}>
            {send.isPending
              ? "Sending..."
              : parsed.rows.length > 0
                ? `Send ${parsed.rows.length} document${parsed.rows.length === 1 ? "" : "s"}`
                : "Send"}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
};

export default BulkSendDialog;
