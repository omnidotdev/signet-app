import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  BellRing,
  CircleCheck,
  CircleDashed,
  Clock,
  Download,
  Eye,
  FileCheck,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

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
  "document.voided": "Voided",
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
            <a
              href={`/api/signet/documents/${data.id}/file`}
              target="_blank"
              rel="noreferrer"
            >
              <Button className="gap-2">
                <Download className="size-4" />
                {data.hasSignedPdf ? "Download signed PDF" : "Open document"}
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

          {/* Signers */}
          <h2 className="mt-10 font-medium text-lg">Signers</h2>
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
