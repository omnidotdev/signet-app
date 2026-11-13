import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LayoutTemplate, Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import BulkSendDialog from "@/components/signet/BulkSendDialog";
import {
  DialogBackdrop,
  DialogContent,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";

interface TemplateSummary {
  id: string;
  name: string;
  createdAt: string;
  fieldCount: number;
  /** signer role labels in signing order; one signer is needed per role */
  roles?: string[];
}

/** Templates saved before roles existed have a single role */
const rolesOf = (t: TemplateSummary): string[] =>
  t.roles && t.roles.length > 0 ? t.roles : ["Signer 1"];

interface SignerInput {
  name: string;
  email: string;
}

const emptySigner = (): SignerInput => ({ name: "", email: "" });

/**
 * The owner's reusable templates. Lists them and lets the owner start a new
 * draft from one by naming a signer for each of its roles (then finalize in the
 * field editor), or bulk send it to many recipients from a CSV. Renders nothing
 * when the owner has no templates.
 */
const TemplatesSection = () => {
  const navigate = useNavigate();
  const [using, setUsing] = useState<TemplateSummary | null>(null);
  const [bulk, setBulk] = useState<TemplateSummary | null>(null);
  const [signers, setSigners] = useState<SignerInput[]>([emptySigner()]);

  const { data } = useQuery({
    queryKey: ["signet", "templates"],
    queryFn: async (): Promise<TemplateSummary[]> => {
      const res = await fetch("/api/signet/templates");
      if (!res.ok) throw new Error("templates_unavailable");
      return (await res.json()) as TemplateSummary[];
    },
  });

  // the first rows fill the template's roles (each needs a signer); any rows
  // after them are additional signers, included only when named
  const roles = using ? rolesOf(using) : [];
  const roleRows = signers.slice(0, roles.length);
  const extraRows = signers.slice(roles.length).filter((s) => s.name.trim());
  const rolesFilled =
    roleRows.length === roles.length && roleRows.every((s) => s.name.trim());

  const create = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch("/api/signet/drafts/from-template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId,
          signers: JSON.stringify(
            [...roleRows, ...extraRows].map((s) => ({
              name: s.name.trim(),
              email: s.email.trim() || undefined,
            })),
          ),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "from_template_failed");
      }
      return (await res.json()) as { draftId: string };
    },
    onSuccess: (r) => {
      setUsing(null);
      setSigners([emptySigner()]);
      navigate({ to: "/documents/$id/edit", params: { id: r.draftId } });
    },
    onError: (e) =>
      toast.error(
        e.message === "signers_for_each_role"
          ? "Add a signer for every role in this template."
          : "Could not start a draft from this template.",
      ),
  });

  if (!data || data.length === 0) return null;

  return (
    <>
      <h2 className="mt-12 flex items-center gap-2 font-medium text-lg">
        <LayoutTemplate className="size-5 text-muted-foreground" /> Templates
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Reuse a document and its field layout. Start a new request and just add
        the signers.
      </p>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {data.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
          >
            <LayoutTemplate className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{t.name}</p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {t.fieldCount} field{t.fieldCount === 1 ? "" : "s"}
                {rolesOf(t).length > 1 && ` · ${rolesOf(t).length} signers`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBulk(t)}>
              <Send className="size-4" /> Bulk send
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSigners(rolesOf(t).map(() => emptySigner()));
                setUsing(t);
              }}
            >
              Use
            </Button>
          </li>
        ))}
      </ul>

      <DialogRoot
        open={using !== null}
        onOpenChange={(e) => {
          if (create.isPending) return;
          if (!e.open) setUsing(null);
        }}
        closeOnEscape={!create.isPending}
        closeOnInteractOutside={!create.isPending}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Who is signing?</DialogTitle>
          <div className="mt-3 space-y-3">
            {signers.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and reorderable only by add/remove
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-muted-foreground text-xs">
                    {i < roles.length ? roles[i] : "Additional signer"}
                  </p>
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <input
                      className="input"
                      value={s.name}
                      onChange={(e) =>
                        setSigners((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, name: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Signer name"
                    />
                    <input
                      className="input"
                      type="email"
                      value={s.email}
                      onChange={(e) =>
                        setSigners((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, email: e.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Email (optional)"
                    />
                  </div>
                </div>
                {i >= roles.length && (
                  <button
                    type="button"
                    aria-label={`Remove signer ${i + 1}`}
                    onClick={() =>
                      setSigners((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="mb-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSigners((prev) => [...prev, emptySigner()])}
              className="inline-flex items-center gap-1.5 font-medium text-primary text-sm hover:underline"
            >
              <Plus className="size-4" /> Add another signer
            </button>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={create.isPending}
              onClick={() => setUsing(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={create.isPending || !rolesFilled}
              onClick={() => using && create.mutate(using.id)}
            >
              {create.isPending ? "Creating..." : "Create draft"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      <BulkSendDialog
        template={bulk && { ...bulk, roles: rolesOf(bulk) }}
        onClose={() => setBulk(null)}
      />
    </>
  );
};

export default TemplatesSection;
