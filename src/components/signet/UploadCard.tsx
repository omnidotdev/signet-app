import { Button } from "@omnidotdev/thornberry/button";
import { useRouteContext } from "@tanstack/react-router";
import { FileSignature, Plus, Stamp, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

type Mode = "self" | "send";

interface SignerInput {
  name: string;
  email: string;
  accessCode: string;
}

interface SentResult {
  draft?: boolean;
  manageUrl: string;
  signers: { name: string; signUrl: string }[];
}

interface Props {
  /** Called after a document is successfully sent for signature, so a
   * surrounding list can refresh. Quick-sign does not fire it (it persists
   * nothing). */
  onSent?: () => void;
}

const emptySigner = (): SignerInput => ({
  name: "",
  email: "",
  accessCode: "",
});

/** Formats a sender can upload: a PDF is signed as-is, an image is placed on a page */
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  DOCX_MIME,
];
const ACCEPTED_UPLOAD_EXT = /\.(pdf|png|jpe?g|docx)$/i;
const ACCEPTED_UPLOAD_ATTR = `application/pdf,image/png,image/jpeg,${DOCX_MIME},.docx`;
/** Shown when a chosen or uploaded file is not a format we can turn into a PDF */
const UNSUPPORTED_UPLOAD_MSG = "Upload a PDF, image, or Word document (.docx).";

/**
 * Upload a PDF and either sign it yourself (download) or send it to one or more
 * signers. Shared by the landing page and the documents page so a signed-in
 * user can start from either place.
 */
const UploadCard = ({ onSent }: Props) => {
  const { auth } = useRouteContext({ strict: false });
  const me = auth?.user;

  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [mode, setMode] = useState<Mode>("send");
  const [selfName, setSelfName] = useState("");
  const [selfConsent, setSelfConsent] = useState(false);
  const [signers, setSigners] = useState<SignerInput[]>([emptySigner()]);
  const [sequential, setSequential] = useState(false);
  const [requireCode, setRequireCode] = useState(false);
  const [requireVerification, setRequireVerification] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [result, setResult] = useState<SentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    if (!f) return;
    // a PDF is signed as-is; an image is placed onto a page. Accept by MIME or
    // extension (drag-drop can omit the MIME); the server verifies the bytes
    const ok =
      ACCEPTED_UPLOAD_TYPES.includes(f.type) ||
      ACCEPTED_UPLOAD_EXT.test(f.name);
    if (!ok) {
      setError(UNSUPPORTED_UPLOAD_MSG);
      return;
    }
    setFile(f);
    if (!docName) setDocName(f.name.replace(/\.[^./\\]+$/, ""));
    setResult(null);
    setError(null);
  };

  const reset = () => {
    setFile(null);
    setDocName("");
    setSelfName("");
    setSigners([emptySigner()]);
    setSequential(false);
    setRequireCode(false);
    setRequireVerification(false);
    setResult(null);
    setError(null);
  };

  const setSigner = (i: number, patch: Partial<SignerInput>) =>
    setSigners((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );
  const addSigner = () => setSigners((prev) => [...prev, emptySigner()]);
  const removeSigner = (i: number) =>
    setSigners((prev) => prev.filter((_, idx) => idx !== i));

  const namedSigners = signers.filter((s) => s.name.trim());

  // email identity verification needs every signer to have an address to
  // receive their one-time code, so block the send until each has one
  const verificationNeedsEmail =
    requireVerification && namedSigners.some((s) => !s.email.trim());

  // whether the signed-in user is already in the signer list
  const meAdded = Boolean(
    me?.email &&
      signers.some(
        (s) => s.email.trim().toLowerCase() === me.email?.toLowerCase(),
      ),
  );
  const addMyself = () => {
    if (!me) return;
    const row: SignerInput = {
      name: me.name ?? "",
      email: me.email ?? "",
      accessCode: "",
    };
    // fill the first empty row, else append
    setSigners((prev) => {
      const i = prev.findIndex((s) => !s.name.trim() && !s.email.trim());
      if (i >= 0) return prev.map((s, idx) => (idx === i ? row : s));
      return [...prev, row];
    });
  };

  const signMyself = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", docName || selfName || "Signer");
      // ESIGN / UETA: the API refuses to stamp without affirmed consent
      fd.set("consent", "true");
      const res = await fetch("/api/signet/sign", { method: "POST", body: fd });
      if (res.status === 415) throw new Error("unsupported");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName || "document"}-signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "unsupported"
          ? `That file type isn't supported. ${UNSUPPORTED_UPLOAD_MSG}`
          : "Could not sign the document. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (draft: boolean) => {
    if (!file || namedSigners.length === 0 || verificationNeedsEmail) return;
    draft ? setSavingDraft(true) : setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", docName || file.name);
      fd.set(
        "signers",
        JSON.stringify(
          namedSigners.map((s) => ({
            name: s.name.trim(),
            email: s.email.trim() || undefined,
            accessCode:
              requireCode && s.accessCode.trim()
                ? s.accessCode.trim()
                : undefined,
          })),
        ),
      );
      if (sequential && namedSigners.length > 1)
        fd.set("signingMode", "sequential");
      if (requireVerification) fd.set("verificationLevel", "email_otp");
      if (draft) fd.set("draft", "true");
      const res = await fetch("/api/signet/documents", {
        method: "POST",
        body: fd,
      });
      if (res.status === 415) throw new Error("unsupported");
      if (!res.ok) throw new Error();
      setResult((await res.json()) as SentResult);
      onSent?.();
    } catch (e) {
      setError(
        e instanceof Error && e.message === "unsupported"
          ? `That file type isn't supported. ${UNSUPPORTED_UPLOAD_MSG}`
          : draft
            ? "Could not save the draft. Please try again."
            : "Could not send the document. Please try again.",
      );
    } finally {
      setBusy(false);
      setSavingDraft(false);
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
              Drop a PDF, image, or Word doc here, or click to choose
            </span>
            <span className="text-muted-foreground text-xs">
              Your document is signed securely and never used to train AI.
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_UPLOAD_ATTR}
          hidden
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </button>

      {file && !result && (
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
            <div className="space-y-4">
              {signers.map((s, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and reorderable only by add/remove
                <div key={i} className="flex items-end gap-2">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <Field
                      label={
                        signers.length > 1 ? `Signer ${i + 1}` : "Signer name"
                      }
                    >
                      <input
                        className="input"
                        value={s.name}
                        onChange={(e) => setSigner(i, { name: e.target.value })}
                        placeholder="Jordan Rivera"
                      />
                    </Field>
                    <Field label="Email (optional)">
                      <input
                        className="input"
                        type="email"
                        value={s.email}
                        onChange={(e) =>
                          setSigner(i, { email: e.target.value })
                        }
                        placeholder="jordan@example.com"
                      />
                    </Field>
                  </div>
                  {signers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSigner(i)}
                      aria-label={`Remove signer ${i + 1}`}
                      className="mb-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}

              {requireCode && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-muted-foreground text-xs">
                    Each signer must enter their code to open the document.
                    Share it with them separately (not by email).
                  </p>
                  {signers.map((s, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and reorderable only by add/remove
                    <Field
                      key={i}
                      label={`Access code for ${s.name || `signer ${i + 1}`}`}
                    >
                      <input
                        className="input"
                        value={s.accessCode}
                        onChange={(e) =>
                          setSigner(i, { accessCode: e.target.value })
                        }
                        placeholder="e.g. 4821"
                      />
                    </Field>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <button
                  type="button"
                  onClick={addSigner}
                  className="inline-flex items-center gap-1.5 font-medium text-primary text-sm hover:underline"
                >
                  <Plus className="size-4" /> Add another signer
                </button>
                {me && !meAdded && (
                  <button
                    type="button"
                    onClick={addMyself}
                    className="inline-flex items-center gap-1.5 font-medium text-primary text-sm hover:underline"
                  >
                    <Plus className="size-4" /> Add myself
                  </button>
                )}
                {namedSigners.length > 1 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sequential}
                      onChange={(e) => setSequential(e.target.checked)}
                    />
                    Sign in order
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requireCode}
                    onChange={(e) => setRequireCode(e.target.checked)}
                  />
                  Require an access code
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requireVerification}
                    onChange={(e) => setRequireVerification(e.target.checked)}
                  />
                  Verify each signer by email (one-time code)
                </label>
                {verificationNeedsEmail && (
                  <p className="text-destructive text-xs">
                    Email verification needs an email address for every signer.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Field label="Your name (shown on the signature)">
              <input
                className="input"
                value={selfName}
                onChange={(e) => setSelfName(e.target.value)}
                placeholder="Your name"
              />
              <label className="mt-3 flex items-start gap-2 text-muted-foreground text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selfConsent}
                  onChange={(e) => setSelfConsent(e.target.checked)}
                />
                I agree to sign this document electronically and that my
                electronic signature is legally binding (ESIGN / UETA).
              </label>
            </Field>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full min-w-0 sm:flex-1"
              disabled={
                busy ||
                savingDraft ||
                (mode === "send"
                  ? namedSigners.length === 0 || verificationNeedsEmail
                  : !selfName.trim() || !selfConsent)
              }
              onClick={mode === "send" ? () => submit(false) : signMyself}
            >
              {busy
                ? "Working..."
                : mode === "send"
                  ? "Send for signature"
                  : "Sign and download"}
            </Button>
            {/* drafts are owner-scoped, so only offer them when signed in */}
            {mode === "send" && me && (
              <Button
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                disabled={busy || savingDraft || namedSigners.length === 0}
                onClick={() => submit(true)}
              >
                {savingDraft ? "Saving..." : "Save as draft"}
              </Button>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
          {result.draft ? (
            <>
              <p className="font-medium text-sm">Saved as a draft.</p>
              <p className="mt-1 text-muted-foreground text-xs">
                It is not sent yet. Find it under Documents to send or delete
                it.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-sm">Ready to sign.</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Each signer can sign at their link
                {sequential && result.signers.length > 1
                  ? " (in order; the next is emailed as each finishes)"
                  : ""}
                . We email anyone you gave an address.
              </p>
              <ul className="mt-3 space-y-2">
                {result.signers.map((s) => (
                  <li key={s.signUrl}>
                    <span className="font-medium text-sm">{s.name}</span>
                    <code className="mt-1 block overflow-x-auto rounded-md bg-background px-3 py-2 text-xs">
                      {s.signUrl}
                    </code>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3 flex items-center gap-4">
            {!result.draft && (
              <a
                href={result.manageUrl}
                className="text-primary text-sm underline-offset-4 hover:underline"
              >
                Track status
              </a>
            )}
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              {result.draft ? "Start another" : "Send another"}
            </button>
          </div>
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
