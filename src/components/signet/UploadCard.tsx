import { Button } from "@omnidotdev/thornberry/button";
import { FileSignature, Stamp, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type Mode = "self" | "send";

interface Props {
  /** Called after a document is successfully sent for signature, so a
   * surrounding list can refresh. Quick-sign does not fire it (it persists
   * nothing). */
  onSent?: () => void;
}

/**
 * Upload a PDF and either sign it yourself (download) or send it for signature.
 * Shared by the landing page and the documents page so a signed-in user can
 * start from either place.
 */
const UploadCard = ({ onSent }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [mode, setMode] = useState<Mode>("send");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    signUrl: string;
    manageUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.pdf$/i, ""));
    setResult(null);
    setError(null);
  };

  const reset = () => {
    setFile(null);
    setDocName("");
    setSignerName("");
    setSignerEmail("");
    setResult(null);
    setError(null);
  };

  const signMyself = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", docName || signerName || "Signer");
      const res = await fetch("/api/signet/sign", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName || "document"}-signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not sign the document. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!file || !signerName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", docName || file.name);
      fd.set("signerName", signerName.trim());
      if (signerEmail.trim()) fd.set("signerEmail", signerEmail.trim());
      const res = await fetch("/api/signet/documents", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { signUrl: string; manageUrl: string };
      setResult(data);
      onSent?.();
    } catch {
      setError("Could not send the document. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
      {/* Upload zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/60 hover:bg-muted/40"
        }`}
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        {file ? (
          <span className="font-medium text-sm">{file.name}</span>
        ) : (
          <>
            <span className="font-medium text-sm">
              Drop a PDF here, or click to choose
            </span>
            <span className="text-muted-foreground text-xs">
              Your document is signed securely and never used to train AI.
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </button>

      {file && (
        <div className="mt-5 space-y-5">
          <Field label="Document name">
            <input
              className="input"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder={file.name}
            />
          </Field>

          {/* Mode toggle */}
          <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1 text-sm">
            <ModeButton
              active={mode === "send"}
              onClick={() => setMode("send")}
            >
              <FileSignature className="size-4" /> Send for signature
            </ModeButton>
            <ModeButton
              active={mode === "self"}
              onClick={() => setMode("self")}
            >
              <Stamp className="size-4" /> Sign it myself
            </ModeButton>
          </div>

          {mode === "send" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Signer name">
                <input
                  className="input"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Jordan Rivera"
                />
              </Field>
              <Field label="Signer email">
                <input
                  className="input"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="jordan@example.com"
                />
              </Field>
            </div>
          ) : (
            <Field label="Your name (shown on the signature)">
              <input
                className="input"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Your name"
              />
            </Field>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {result ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="font-medium text-sm">Ready to sign.</p>
              <p className="mt-1 text-muted-foreground text-xs">
                {signerEmail.trim()
                  ? "We emailed the signing link. You can also share it directly:"
                  : "Share this signing link with the signer:"}
              </p>
              <code className="mt-2 block overflow-x-auto rounded-md bg-background px-3 py-2 text-xs">
                {result.signUrl}
              </code>
              <div className="mt-3 flex items-center gap-4">
                <a
                  href={result.manageUrl}
                  className="text-primary text-sm underline-offset-4 hover:underline"
                >
                  Track status
                </a>
                <button
                  type="button"
                  onClick={reset}
                  className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                >
                  Send another
                </button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={busy || !signerName.trim()}
              onClick={mode === "send" ? send : signMyself}
            >
              {busy
                ? "Working..."
                : mode === "send"
                  ? "Send for signature"
                  : "Sign and download"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is nested via children
    <label className="block space-y-1.5">
      <span className="font-medium text-sm">{label}</span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default UploadCard;
