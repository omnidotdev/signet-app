import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Download,
  FileText,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/signet/ConfirmDialog";
import UploadCard from "@/components/signet/UploadCard";
import createMetaTags from "@/lib/util/createMetaTags";

export const Route = createFileRoute("/_auth/documents")({
  head: () => ({
    meta: createMetaTags({ title: "Your documents" }),
  }),
  component: DocumentsPage,
});

interface OwnerDocument {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  manageToken: string;
  hasSignedPdf: boolean;
  signerName: string | null;
  signerStatus: string | null;
  signerCount: number;
}

const statusTone: Record<string, string> = {
  completed: "bg-primary/10 text-primary",
  signed: "bg-primary/10 text-primary",
  sent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  draft: "bg-muted text-muted-foreground",
  voided: "bg-destructive/10 text-destructive",
};

const prettyDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const DOCS_KEY = ["signet", "documents"] as const;

/**
 * The signed-in sender's documents. Lists everything they own (and anything
 * shared through their workspace), so an upload is never stranded. Drafts can
 * be sent or deleted; sent documents can be downloaded or deleted.
 */
function DocumentsPage() {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<OwnerDocument | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: DOCS_KEY,
    queryFn: async (): Promise<OwnerDocument[]> => {
      const res = await fetch("/api/signet/documents");
      if (!res.ok) throw new Error("documents_unavailable");
      const body = (await res.json()) as { documents: OwnerDocument[] };
      return body.documents;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: DOCS_KEY });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/signet/documents/${id}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("send_failed");
    },
    onSuccess: () => {
      toast.success("Sent for signature.");
      invalidate();
    },
    onError: () => toast.error("Could not send the document."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/signet/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete_failed");
    },
    onSuccess: () => {
      toast.success("Document deleted.");
      setToDelete(null);
      invalidate();
    },
    onError: () => toast.error("Could not delete the document."),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/signet/documents/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("rename_failed");
    },
    onSuccess: () => {
      setRenamingId(null);
      invalidate();
    },
    onError: () => toast.error("Could not rename the document."),
  });

  const startRename = (doc: OwnerDocument) => {
    setRenamingId(doc.id);
    setDraftName(doc.name);
  };
  const commitRename = (id: string) => {
    const name = draftName.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    renameMutation.mutate({ id, name });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
      <h1 className="font-semibold text-3xl tracking-tight">Your documents</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Upload a PDF to sign it or send it for signature, and track everything
        here.
      </p>

      <div className="mt-8">
        <UploadCard onSent={invalidate} />
      </div>

      <h2 className="mt-12 font-medium text-lg">History</h2>

      <div className="mt-4">
        {isPending ? (
          <p className="text-muted-foreground text-sm">
            Loading your documents.
          </p>
        ) : isError ? (
          <p className="text-destructive text-sm">
            Could not load your documents. Please try again.
          </p>
        ) : data.length === 0 ? (
          <div className="rounded-2xl border border-border border-dashed bg-card p-8 text-center">
            <FileText className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 font-medium text-sm">Nothing here yet.</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Anything you sign or send for signature will show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
              >
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {renamingId === doc.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        // biome-ignore lint/a11y/noAutofocus: focus the field the user just chose to edit
                        autoFocus
                        className="input h-8 py-1"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(doc.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Save name"
                        disabled={renameMutation.isPending}
                        onClick={() => commitRename(doc.id)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/10"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel rename"
                        onClick={() => setRenamingId(null)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-1.5">
                      <Link
                        to="/documents/$id"
                        params={{ id: doc.id }}
                        className="truncate font-medium text-sm hover:text-primary hover:underline"
                      >
                        {doc.name}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Rename ${doc.name}`}
                        onClick={() => startRename(doc)}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="mt-0.5 truncate text-muted-foreground text-xs">
                    {doc.signerName ? `${doc.signerName}` : ""}
                    {doc.signerCount > 1 ? ` +${doc.signerCount - 1}` : ""}
                    {doc.signerName ? " · " : ""}
                    {prettyDate(doc.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium text-xs capitalize ${
                    statusTone[doc.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {doc.status}
                </span>

                {doc.status === "draft" && (
                  <Link
                    to="/documents/$id/edit"
                    params={{ id: doc.id }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-medium text-sm hover:bg-muted"
                  >
                    <Pencil className="size-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Link>
                )}

                {doc.status === "draft" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sendMutation.isPending}
                    onClick={() => sendMutation.mutate(doc.id)}
                  >
                    <Send className="size-4" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                )}

                {/* open the document file at any stage: signed once sealed,
                    else the original, so history is always accessible */}
                <a
                  href={`/api/signet/documents/${doc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-primary text-sm hover:bg-primary/10"
                >
                  <Download className="size-4" />
                  <span className="hidden sm:inline">
                    {doc.hasSignedPdf ? "Download" : "Open"}
                  </span>
                </a>

                <button
                  type="button"
                  aria-label={`Delete ${doc.name}`}
                  onClick={() => setToDelete(doc)}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={toDelete ? `Delete "${toDelete.name}"?` : "Delete document?"}
        description="This permanently removes the document, its signatures, and its provenance record. This cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </div>
  );
}
