import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";

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

/**
 * The signed-in sender's documents. Lists everything they own (and anything
 * shared through their workspace), so an upload is never stranded.
 */
function DocumentsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["signet", "documents"],
    queryFn: async (): Promise<OwnerDocument[]> => {
      const res = await fetch("/api/signet/documents");
      if (!res.ok) throw new Error("documents_unavailable");
      const body = (await res.json()) as { documents: OwnerDocument[] };
      return body.documents;
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
      <h1 className="font-semibold text-3xl tracking-tight">Your documents</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Everything you have signed or sent for signature.
      </p>

      <div className="mt-8">
        {isPending ? (
          <p className="text-muted-foreground text-sm">
            Loading your documents.
          </p>
        ) : isError ? (
          <p className="text-destructive text-sm">
            Could not load your documents. Please try again.
          </p>
        ) : data.length === 0 ? (
          <div className="rounded-2xl border border-border border-dashed bg-card p-10 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium text-sm">No documents yet.</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Upload a PDF from the home page to sign it or send it for
              signature.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-4 px-5 py-4 sm:px-6"
              >
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{doc.name}</p>
                  <p className="mt-0.5 truncate text-muted-foreground text-xs">
                    {doc.signerName ? `${doc.signerName} · ` : ""}
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
                {doc.hasSignedPdf && (
                  <a
                    href={`/api/signet/documents/${doc.id}/signed`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-primary text-sm hover:bg-primary/10"
                  >
                    <Download className="size-4" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
