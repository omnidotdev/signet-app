import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/signet/ConfirmDialog";
import {
  ACCEPTED_UPLOAD_ATTR,
  UNSUPPORTED_UPLOAD_MSG,
  isAcceptedUpload,
} from "@/lib/signet/uploadTypes";

interface Props {
  documentId: string;
  documentName: string;
  status: string;
  /** a newer version already exists, so this one cannot be revised again */
  hasNewerVersion: boolean;
}

/**
 * Upload a new version of a document. A signed document is never edited: the
 * new file becomes the next version, a draft with the same signers and fields
 * for the sender to review and send. A document still out for signature is
 * voided first, so this asks for confirmation; a completed one stays as the
 * record of what was signed. Not offered on drafts (edit those directly) or on
 * a version that already has a newer one.
 */
const NewVersionAction = ({
  documentId,
  documentName,
  status,
  hasNewerVersion,
}: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(
        `/api/signet/documents/${encodeURIComponent(documentId)}/revise`,
        { method: "POST", body: fd },
      );
      const body = (await res.json().catch(() => ({}))) as {
        draftId?: string;
        error?: string;
      };
      if (!res.ok || !body.draftId) throw new Error(body.error ?? "failed");
      return body.draftId;
    },
    onSuccess: (draftId) => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["signet"] });
      toast.success("New version created. Review the fields, then send it.");
      navigate({ to: "/documents/$id/edit", params: { id: draftId } });
    },
    onError: (e) => {
      setPending(null);
      toast.error(
        e.message === "unsupported_format"
          ? `That file type isn't supported. ${UNSUPPORTED_UPLOAD_MSG}`
          : e.message === "already_revised"
            ? "A newer version of this document already exists."
            : "Could not create the new version. Please try again.",
      );
    },
  });

  if (status === "draft" || hasNewerVersion) return null;

  const onPick = (file: File | null) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!isAcceptedUpload(file)) {
      toast.error(UNSUPPORTED_UPLOAD_MSG);
      return;
    }
    // replacing a request that is still being signed voids it, so confirm
    if (status === "sent") setPending(file);
    else upload.mutate(file);
  };

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <FilePlus2 className="size-4" />
        {upload.isPending ? "Uploading..." : "Upload new version"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_UPLOAD_ATTR}
        hidden
        aria-label="New version file"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={`Replace "${documentName}" with a new version?`}
        description="This voids the current request, so no one can keep signing it. The new version starts as a draft with the same signers and fields for you to review and send. Signatures already collected stay in this version's record. This cannot be undone."
        confirmLabel="Void and create new version"
        destructive
        busy={upload.isPending}
        onConfirm={() => pending && upload.mutate(pending)}
      />
    </>
  );
};

export default NewVersionAction;
