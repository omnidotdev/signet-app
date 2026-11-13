import { Button } from "@omnidotdev/thornberry/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/signet/ConfirmDialog";

interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const KEYS_QUERY = ["signet", "api-keys"];

const day = (iso: string) => new Date(iso).toLocaleDateString();

/**
 * Managed API keys for sending documents from your own systems. A key acts as
 * you in your workspace; its secret is shown once, when it is created, and a
 * key can be revoked at any time.
 */
const ApiKeysSection = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{
    name: string;
    secret: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeySummary | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: KEYS_QUERY,
    queryFn: async (): Promise<ApiKeySummary[]> => {
      const res = await fetch("/api/signet/keys");
      if (!res.ok) throw new Error("keys_unavailable");
      return ((await res.json()) as { keys: ApiKeySummary[] }).keys;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/signet/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        key?: { name: string; secret: string };
        error?: string;
      };
      if (!res.ok || !body.key) throw new Error(body.error ?? "create_failed");
      return body.key;
    },
    onSuccess: (key) => {
      setCreated({ name: key.name, secret: key.secret });
      setCopied(false);
      setName("");
      void queryClient.invalidateQueries({ queryKey: KEYS_QUERY });
    },
    onError: (e) =>
      toast.error(
        e.message === "too_many_keys"
          ? "You have the maximum number of keys. Revoke one you no longer use."
          : "Could not create the key. Please try again.",
      ),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/signet/keys/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("revoke_failed");
    },
    onSuccess: () => {
      setRevoking(null);
      toast.success("Key revoked.");
      void queryClient.invalidateQueries({ queryKey: KEYS_QUERY });
    },
    onError: () => toast.error("Could not revoke the key. Please try again."),
  });

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied(true);
    } catch {
      toast.error("Copy failed. Select the key and copy it manually.");
    }
  };

  return (
    <div className="mt-10 flex flex-col text-start">
      <h1 className="flex items-center gap-2 font-bold sm:text-xl">
        <KeyRound className="size-5 text-muted-foreground" /> API keys
      </h1>
      <h2 className="text-muted-foreground text-xs sm:text-sm">
        Send documents for signature from your own systems. A key acts as you,
        so keep it secret. Send it as an{" "}
        <code className="rounded bg-muted px-1">Authorization: Bearer</code>{" "}
        header.
      </h2>

      <form
        method="post"
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <input
          className="input max-w-xs flex-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name, e.g. Billing server"
          aria-label="Key name"
          maxLength={80}
        />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {create.isPending ? "Creating..." : "Create key"}
        </Button>
      </form>

      {created && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="font-medium text-sm">
            Copy "{created.name}" now. You won't be able to see it again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1.5 text-xs">
              {created.secret}
            </code>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-muted-foreground text-xs underline"
            onClick={() => setCreated(null)}
          >
            I've stored it, hide the key
          </button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading && (
          <li className="px-5 py-4 text-muted-foreground text-sm">Loading…</li>
        )}
        {!isLoading && (keys?.length ?? 0) === 0 && (
          <li className="px-5 py-4 text-muted-foreground text-sm">
            No API keys yet.
          </li>
        )}
        {keys?.map((k) => (
          <li
            key={k.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{k.name}</p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                <code>{k.prefix}…</code> · created {day(k.createdAt)} ·{" "}
                {k.lastUsedAt ? `last used ${day(k.lastUsedAt)}` : "never used"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRevoking(k)}>
              Revoke
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title={`Revoke API key "${revoking?.name ?? ""}"?`}
        description="Anything using this key stops working immediately. This cannot be undone."
        confirmLabel="Revoke key"
        destructive
        busy={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      />
    </div>
  );
};

export default ApiKeysSection;
