import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useRouteContext } from "@tanstack/react-router";
import {
  ArrowLeft,
  BellRing,
  CircleCheck,
  CircleDashed,
  Clock,
  Download,
  Eye,
  FileCheck,
  LayoutTemplate,
  PenLine,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/signet/ConfirmDialog";
import PdfViewer from "@/components/signet/PdfViewer";
import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { canCorrectSigner } from "@/lib/signet/signerCorrection";
import createMetaTags from "@/lib/util/createMetaTags";

export const Route = createFileRoute("/_auth/documents/$id/")({
  head: () => ({ meta: createMetaTags({ title: "Document" }) }),
  component: DocumentDetailPage,
});

interface DetailSigner {
  id: string;
  name: string;
  email: string | null;
  status: string;
  orderIndex: number;
  active: boolean;
}
interface HistoryEvent {
  type: string;
  timestamp: string;
  signer: string | null;
}
interface DocumentDetail {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  signingMode: string;
  hasSignedPdf: boolean;
  signers: DetailSigner[];
  history: HistoryEvent[];
  provenanceValid: boolean;
  trustedTimestamp: { genTime: string | null; tsa: string } | null;
}

const statusTone: Record<string, string> = {
  completed: "bg-primary/10 text-primary",
  signed: "bg-primary/10 text-primary",
  sent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  viewed: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  draft: "bg-muted text-muted-foreground",
  voided: "bg-destructive/10 text-destructive",
};

const prettyDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const EVENT_LABEL: Record<string, string> = {
  "document.created": "Created",
  "document.sent": "Sent for signature",
  "document.viewed": "Opened",
  "signature.completed": "Signed",
  "document.completed": "Completed and sealed",
  "document.declined": "Declined",
  "document.voided": "Voided",
  "signer.corrected": "Signer updated",
};
const labelFor = (type: string) =>
  EVENT_LABEL[type] ?? type.replace(/^[a-z]+\./, "").replace(/[._]/g, " ");

function DocumentDetailPage() {
  const { id } = Route.useParams();

  const { data, isPending, isError } = useQuery({
    queryKey: ["signet", "document", id],
    queryFn: async (): Promise<DocumentDetail> => {
      const res = await fetch(`/api/signet/documents/${id}`);
      if (!res.ok) throw new Error("not_found");
      return (await res.json()) as DocumentDetail;
    },
  });

  const { auth } = useRouteContext({ strict: false });
  const myEmail = auth?.user?.email?.trim().toLowerCase();
  const mySigner = myEmail
    ? data?.signers.find(
        (s) => (s.email ?? "").trim().toLowerCase() === myEmail,
      )
    : undefined;
  // the signed-in user can sign in-app when they are the active signer whose
  // turn it is and they have not already signed or declined
  const canSign =
    data?.status === "sent" &&
    Boolean(mySigner?.active) &&
    mySigner?.status !== "signed" &&
    mySigner?.status !== "declined";

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/signet/documents/${id}/template`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("template_failed");
    },
    onSuccess: () =>
      toast.success("Saved as a template. Find it on your documents page."),
    onError: () => toast.error("Could not save this as a template."),
  });

  const remind = useMutation({
    mutationFn: async (signerId?: string) => {
      const res = await fetch(`/api/signet/documents/${id}/remind`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signerId ? { signerId } : {}),
      });
      if (!res.ok) throw new Error("remind_failed");
      return (await res.json()) as { reminded: number };
    },
    onSuccess: (r) =>
      toast.success(
        `Reminder sent to ${r.reminded} signer${r.reminded === 1 ? "" : "s"}.`,
      ),
    onError: () => toast.error("No one to remind right now."),
  });
  const remindingId =
    remind.isPending && typeof remind.variables === "string"
      ? remind.variables
      : null;

  const queryClient = useQueryClient();
  // the pending signer being corrected (typo fix or email reassignment), or null
  const [editing, setEditing] = useState<DetailSigner | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const correctSigner = useMutation({
    mutationFn: async (vars: {
      signerId: string;
      name: string;
      email: string;
    }) => {
      const res = await fetch(
        `/api/signet/documents/${id}/signers/${vars.signerId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: vars.name,
            email: vars.email.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error("correct_failed");
      return (await res.json()) as {
        ok: boolean;
        signer: { email: string | null; reissued: boolean };
      };
    },
    onSuccess: (r) => {
      setEditing(null);
      queryClient.invalidateQueries({
        queryKey: ["signet", "document", id],
      });
      if (r.signer?.reissued && r.signer.email) {
        toast.success(
          `Updated. A new signing link was sent to ${r.signer.email}.`,
        );
      } else {
        toast.success("Signer updated.");
      }
    },
    onError: () => toast.error("Could not update this signer."),
  });

  const openEdit = (s: DetailSigner) => {
    setEditing(s);
    setEditName(s.name);
    setEditEmail(s.email ?? "");
  };

  const submitEdit = () => {
    if (!editing) return;
    const name = editName.trim();
    if (!name) return;
    correctSigner.mutate({ signerId: editing.id, name, email: editEmail });
  };

  // add a late signer (approver) to a sent document
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const addSigner = useMutation({
    mutationFn: async (vars: { name: string; email: string }) => {
      const res = await fetch(`/api/signet/documents/${id}/signers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: vars.name,
          email: vars.email || undefined,
        }),
      });
      if (!res.ok) throw new Error("add_failed");
    },
    onSuccess: () => {
      setAddOpen(false);
      setAddName("");
      setAddEmail("");
      queryClient.invalidateQueries({ queryKey: ["signet", "document", id] });
      toast.success("Signer added.");
    },
    onError: () => toast.error("Could not add this signer."),
  });

  // remove a still-pending signer from a sent document
  const [removeTarget, setRemoveTarget] = useState<DetailSigner | null>(null);
  const removeSigner = useMutation({
    mutationFn: async (signerId: string) => {
      const res = await fetch(
        `/api/signet/documents/${id}/signers/${signerId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("remove_failed");
    },
    onSuccess: () => {
      setRemoveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["signet", "document", id] });
      toast.success("Signer removed.");
    },
    onError: () =>
      toast.error("Could not remove this signer. They may have already acted."),
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <Link
        to="/documents"
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All documents
      </Link>

      {isPending ? (
        <p className="mt-8 text-muted-foreground text-sm">Loading.</p>
      ) : isError || !data ? (
        <p className="mt-8 text-destructive text-sm">
          Could not load this document, or you do not have access to it.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="font-semibold text-2xl tracking-tight">
              {data.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 font-medium text-xs capitalize ${
                statusTone[data.status] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {data.status}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            Created {prettyDateTime(data.createdAt)}
            {data.signingMode === "sequential" ? " · signs in order" : ""}
          </p>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            {canSign && (
              <Link to="/documents/$id/sign" params={{ id: data.id }}>
                <Button className="gap-2">
                  <PenLine className="size-4" /> Sign
                </Button>
              </Link>
            )}
            <a
              href={`/api/signet/documents/${data.id}/file`}
              target="_blank"
              rel="noreferrer"
            >
              <Button className="gap-2">
                <Download className="size-4" />
                {data.hasSignedPdf ? "Download signed PDF" : "Download PDF"}
              </Button>
            </a>
            {data.status === "completed" && (
              <a
                href={`/api/signet/documents/${data.id}/certificate`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="gap-2">
                  <FileCheck className="size-4" /> Certificate
                </Button>
              </a>
            )}
            {data.status === "draft" && (
              <Link to="/documents/$id/edit" params={{ id: data.id }}>
                <Button variant="outline" className="gap-2">
                  <Pencil className="size-4" /> Edit fields
                </Button>
              </Link>
            )}
            {data.status === "draft" && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={saveTemplate.isPending}
                onClick={() => saveTemplate.mutate()}
              >
                <LayoutTemplate className="size-4" />
                {saveTemplate.isPending ? "Saving..." : "Save as template"}
              </Button>
            )}
            {data.status === "sent" && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={remind.isPending}
                onClick={() => remind.mutate(undefined)}
              >
                <BellRing className="size-4" />
                {remind.isPending && remindingId === null
                  ? "Sending..."
                  : "Remind all"}
              </Button>
            )}
          </div>

          {/* Document preview: the signed PDF once sealed, else the original */}
          <h2 className="mt-10 font-medium text-lg">
            {data.hasSignedPdf ? "Signed document" : "Document"}
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            <PdfViewer
              url={`/api/signet/documents/${data.id}/file?disposition=inline`}
              label={data.name}
            />
          </div>

          {/* Signers */}
          <div className="mt-10 flex items-center justify-between gap-3">
            <h2 className="font-medium text-lg">Signers</h2>
            {data.status === "sent" && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => {
                  setAddName("");
                  setAddEmail("");
                  setAddOpen(true);
                }}
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add signer</span>
              </Button>
            )}
          </div>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.signers.map((s) => {
              const signed = s.status === "signed";
              return (
                <li
                  key={`${s.orderIndex}-${s.name}`}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  {signed ? (
                    <CircleCheck className="size-5 shrink-0 text-primary" />
                  ) : (
                    <CircleDashed className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{s.name}</p>
                    {s.email && (
                      <p className="truncate text-muted-foreground text-xs">
                        {s.email}
                      </p>
                    )}
                  </div>
                  {!signed && s.active && data.status === "sent" && (
                    <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
                      Waiting
                    </span>
                  )}
                  {!signed && s.active && s.email && data.status === "sent" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      disabled={remind.isPending}
                      onClick={() => remind.mutate(s.id)}
                    >
                      <BellRing className="size-3.5" />
                      {remindingId === s.id ? "Sending..." : "Resend"}
                    </Button>
                  ) : (
                    <span className="shrink-0 text-muted-foreground text-xs capitalize">
                      {s.status}
                    </span>
                  )}
                  {canCorrectSigner(data.status, s.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${s.name}`}
                      className="shrink-0 gap-1.5"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil className="size-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  )}
                  {canCorrectSigner(data.status, s.status) &&
                    data.signers.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => setRemoveTarget(s)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                </li>
              );
            })}
          </ul>

          {/* History */}
          <h2 className="mt-10 font-medium text-lg">History</h2>
          <ol className="mt-3 space-y-3">
            {data.history.map((e, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: ledger events are an ordered append-only list
                key={i}
                className="flex items-start gap-3"
              >
                <EventIcon type={e.type} />
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {labelFor(e.type)}
                    {e.signer ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {e.signer}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {prettyDateTime(e.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Integrity */}
          <div className="mt-10 rounded-2xl border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`size-5 ${data.provenanceValid ? "text-primary" : "text-destructive"}`}
              />
              <span className="font-medium text-sm">
                {data.provenanceValid
                  ? "Provenance trail is intact"
                  : "Provenance trail could not be verified"}
              </span>
            </div>
            {data.trustedTimestamp?.genTime && (
              <p className="mt-1.5 text-muted-foreground text-xs">
                Trusted timestamp:{" "}
                {prettyDateTime(data.trustedTimestamp.genTime)}
              </p>
            )}
          </div>
        </>
      )}

      {/* Correct a pending signer: fix a name or reassign the email. Changing
          the email reissues the signing link and re-sends it. */}
      <DialogRoot
        open={editing !== null}
        onOpenChange={(e) => {
          if (correctSigner.isPending) return;
          if (!e.open) setEditing(null);
        }}
        closeOnEscape={!correctSigner.isPending}
        closeOnInteractOutside={!correctSigner.isPending}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Edit signer</DialogTitle>
          <DialogDescription>
            Fix a name, or reassign the email. Changing the email sends a fresh
            signing link and invalidates the old one.
          </DialogDescription>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitEdit();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Email</span>
              <input
                className="input"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={correctSigner.isPending}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={correctSigner.isPending || !editName.trim()}
              >
                {correctSigner.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogRoot>

      {/* Add a late signer (approver) to a sent document */}
      <DialogRoot
        open={addOpen}
        onOpenChange={(e) => {
          if (addSigner.isPending) return;
          if (!e.open) setAddOpen(false);
        }}
        closeOnEscape={!addSigner.isPending}
        closeOnInteractOutside={!addSigner.isPending}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Add signer</DialogTitle>
          <DialogDescription>
            Add another party to this document. They are emailed a signing link
            and sign after the current signers.
          </DialogDescription>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const name = addName.trim();
              if (name) addSigner.mutate({ name, email: addEmail.trim() });
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <input
                className="input"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Full name"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Email</span>
              <input
                className="input"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={addSigner.isPending}
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addSigner.isPending || !addName.trim()}
              >
                {addSigner.isPending ? "Adding..." : "Add signer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogRoot>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={`Remove ${removeTarget?.name ?? "signer"}?`}
        description="They will be removed from this document and can no longer sign it. This cannot be undone."
        confirmLabel="Remove signer"
        destructive
        busy={removeSigner.isPending}
        onConfirm={() => {
          if (removeTarget) removeSigner.mutate(removeTarget.id);
        }}
      />
    </div>
  );
}

const EventIcon = ({ type }: { type: string }) => {
  const cls = "mt-0.5 size-4 shrink-0 text-muted-foreground";
  if (type === "document.viewed") return <Eye className={cls} />;
  if (type === "signature.completed")
    return <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />;
  if (type === "document.completed")
    return <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />;
  return <Clock className={cls} />;
};
