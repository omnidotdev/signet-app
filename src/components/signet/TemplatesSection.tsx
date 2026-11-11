import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LayoutTemplate, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
}

interface SignerInput {
  name: string;
  email: string;
}

const emptySigner = (): SignerInput => ({ name: "", email: "" });

/**
 * The owner's reusable templates. Lists them and lets the owner start a new
 * draft from one by entering its signers, then drops into the field editor to
 * finalize and send. Renders nothing when the owner has no templates.
 */
const TemplatesSection = () => {
  const navigate = useNavigate();
  const [useId, setUseId] = useState<string | null>(null);
  const [signers, setSigners] = useState<SignerInput[]>([emptySigner()]);

  const { data } = useQuery({
    queryKey: ["signet", "templates"],
    queryFn: async (): Promise<TemplateSummary[]> => {
      const res = await fetch("/api/signet/templates");
      if (!res.ok) throw new Error("templates_unavailable");
      return (await res.json()) as TemplateSummary[];
    },
  });

  const named = signers.filter((s) => s.name.trim());

  const create = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch("/api/signet/drafts/from-template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId,
          signers: JSON.stringify(
            named.map((s) => ({
              name: s.name.trim(),
              email: s.email.trim() || undefined,
            })),
          ),
        }),
      });
      if (!res.ok) throw new Error("from_template_failed");
      return (await res.json()) as { draftId: string };
    },
    onSuccess: (r) => {
      setUseId(null);
      setSigners([emptySigner()]);
      navigate({ to: "/documents/$id/edit", params: { id: r.draftId } });
    },
    onError: () => toast.error("Could not start a draft from this template."),
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
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSigners([emptySigner()]);
                setUseId(t.id);
              }}
            >
              Use
            </Button>
          </li>
        ))}
      </ul>

      <DialogRoot
        open={useId !== null}
        onOpenChange={(e) => {
          if (create.isPending) return;
          if (!e.open) setUseId(null);
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
                {signers.length > 1 && (
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
              onClick={() => setUseId(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={create.isPending || named.length === 0}
              onClick={() => useId && create.mutate(useId)}
            >
              {create.isPending ? "Creating..." : "Create draft"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default TemplatesSection;
