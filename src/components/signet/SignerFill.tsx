import { Button } from "@omnidotdev/thornberry/button";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Download,
  FileCheck,
  Loader2,
  Lock,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  guideTargetField,
  isFieldIncomplete,
  isTourField,
} from "@/lib/signet/fieldCompletion";

interface Field {
  id: string;
  type:
    | "signature"
    | "initials"
    | "date"
    | "text"
    | "checkbox"
    | "dropdown"
    | "radio";
  options?: string[] | null;
  required?: boolean;
  groupId?: string | null;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FillData {
  documentName: string;
  signerName: string;
  signerColor?: string | null;
  alreadySigned: boolean;
  documentCompleted: boolean;
  waitingFor: string | null;
  pdfBase64: string;
  fields: Field[];
}

interface RenderedPage {
  width: number;
  height: number;
  /** page width in PDF points, for proportional field placement */
  widthPt: number;
  /** page height in PDF points (bottom-left origin), for field placement */
  heightPt: number;
  src: string;
}

const SCALE = 1.25;
const SIG_STORAGE_KEY = "signet.sig";

const base64ToBytes = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

/**
 * The native signer page: renders the document with pdf.js, overlays the
 * signer's fields, and lets them adopt a signature (typed or drawn), fill text
 * fields in place, and sign. Date fields fill automatically. Runs entirely on
 * the client (pdf.js touches the DOM), hosted on the app origin.
 */
/** A signer-facing message for a failed one-time-code check */
const otpMessage = (error?: string): string => {
  switch (error) {
    case "expired":
      return "That code has expired. Resend to get a new one.";
    case "too_many_attempts":
      return "Too many attempts. Resend to get a new code.";
    case "no_code":
      return "Resend a code to continue.";
    default:
      return "That code is not right. Check it and try again.";
  }
};

const SignerFill = ({
  token,
  basePath,
  savedSignatureUrl,
  backHref,
}: {
  /** public signer flow: the capability token from the emailed link */
  token?: string;
  /**
   * authenticated in-app flow: an app-origin base path whose GET/POST and
   * /decline mirror the token endpoints, with the capability resolved
   * server-side so it never reaches the browser
   */
  basePath?: string;
  /**
   * when set, the signed-in user's saved signature is loaded from and written
   * back to this endpoint, so it is reused across their documents and devices
   */
  savedSignatureUrl?: string;
  /** when set (in-app flow), the completion screen links back here */
  backHref?: string;
}) => {
  const base = basePath ?? `/api/signet/sign/${token}`;
  const [data, setData] = useState<FillData | null>(null);
  const [state, setState] = useState<
    "loading" | "error" | "notfound" | "locked" | "verify" | "ready"
  >("loading");
  const [accessCode, setAccessCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [mode, setMode] = useState<"type" | "draw" | "upload">("type");
  const [typedName, setTypedName] = useState("");
  const [drawnImage, setDrawnImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [completedAll, setCompletedAll] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);
  const padRef = useRef<HTMLCanvasElement>(null);
  const adoptRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<[number, number]>([0, 0]);

  // Load the signer's fill data, forwarding an access code when one is entered
  const load = useCallback(
    async (code?: string): Promise<void> => {
      try {
        const res = await fetch(base, {
          headers: code ? { "x-signet-access-code": code } : {},
        });
        if (res.status === 404) {
          setState("notfound");
          return;
        }
        if (res.status === 401) {
          setCodeError(Boolean(code));
          setState("locked");
          return;
        }
        // identity verification required: show the one-time-code screen
        if (res.status === 403) {
          const body = (await res.json().catch(() => ({}))) as {
            verify?: boolean;
            email?: string | null;
          };
          if (body.verify) {
            setOtpEmail(body.email ?? null);
            setState("verify");
            return;
          }
          throw new Error();
        }
        if (!res.ok) throw new Error();
        const body = (await res.json()) as FillData;
        setData(body);
        setTypedName(body.signerName);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [base],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim() || unlocking) return;
    setUnlocking(true);
    setCodeError(false);
    await load(accessCode.trim());
    setUnlocking(false);
  };

  // Submit the emailed one-time code; on success, reload into the fill page
  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpBusy) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const res = await fetch(`${base}/otp/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      if (res.ok) {
        setOtpCode("");
        setState("loading");
        await load();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setOtpError(otpMessage(body.error));
    } catch {
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setOtpBusy(false);
    }
  };

  const resendOtp = async () => {
    if (otpBusy) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      await fetch(`${base}/otp/request`, { method: "POST" });
    } catch {
      // best effort; the signer can try again
    } finally {
      setOtpBusy(false);
    }
  };

  // On touch devices drawing a signature is natural, so lead with Draw; on a
  // desktop pointer typing is faster and more legible, so lead with Type.
  // Compute after mount to keep the first client paint matching the server.
  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    try {
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      setCoarsePointer(coarse);
      // lead with Draw on touch; a saved signature (loaded next) overrides this
      if (coarse) setMode("draw");
    } catch {
      // matchMedia unavailable, keep the desktop default
    }
  }, []);

  // Restore a previously adopted signature: from the signed-in user's saved
  // signature when available (reused across devices), else from this device's
  // local storage for anonymous signers
  useEffect(() => {
    const applySaved = (saved: {
      name?: string | null;
      image?: string | null;
      kind?: string;
    }) => {
      if (saved.name) setTypedName(saved.name);
      if (saved.image) {
        if (saved.kind === "upload") {
          setUploadedImage(saved.image);
          setMode("upload");
        } else {
          setDrawnImage(saved.image);
          setMode("draw");
        }
      }
    };
    if (savedSignatureUrl) {
      let cancelled = false;
      void (async () => {
        try {
          const res = await fetch(savedSignatureUrl);
          if (!res.ok) return;
          const body = (await res.json()) as {
            signature?: {
              typedName?: string | null;
              image?: string | null;
              mode?: string;
            } | null;
          };
          const sig = body.signature;
          if (!sig || cancelled) return;
          applySaved({ name: sig.typedName, image: sig.image, kind: sig.mode });
        } catch {
          // no saved signature, fine
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    try {
      applySaved(JSON.parse(localStorage.getItem(SIG_STORAGE_KEY) ?? "{}"));
    } catch {
      // no saved signature, fine
    }
  }, [savedSignatureUrl]);

  // Adopt a signature from an uploaded image file
  const onUploadFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setUploadedImage(reader.result);
    };
    reader.readAsDataURL(f);
  };

  // Render the PDF to page images once the data is available
  useEffect(() => {
    if (!data || data.alreadySigned || data.waitingFor) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const pdf = await pdfjs.getDocument({
          data: base64ToBytes(data.pdfBase64),
        }).promise;
        const out: RenderedPage[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: SCALE });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          out.push({
            width: viewport.width,
            height: viewport.height,
            widthPt: viewport.width / SCALE,
            heightPt: viewport.height / SCALE,
            src: canvas.toDataURL("image/png"),
          });
        }
        if (!cancelled) setPages(out);
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  // Signature pad drawing
  const padPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pad = padRef.current;
    if (!pad) return [0, 0] as const;
    const r = pad.getBoundingClientRect();
    return [
      (e.clientX - r.left) * (pad.width / r.width),
      (e.clientY - r.top) * (pad.height / r.height),
    ] as const;
  };

  const padCtx = () => padRef.current?.getContext("2d") ?? null;

  const onPadDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = padCtx();
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c2e73";
    drawingRef.current = true;
    lastRef.current = padPoint(e) as [number, number];
    padRef.current?.setPointerCapture(e.pointerId);
  };
  const onPadMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = padCtx();
    if (!ctx) return;
    const [x, y] = padPoint(e);
    const [lx, ly] = lastRef.current;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastRef.current = [x, y];
  };
  const onPadUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pad = padRef.current;
    if (pad) setDrawnImage(pad.toDataURL("image/png"));
  };
  const clearPad = () => {
    const pad = padRef.current;
    const ctx = padCtx();
    if (pad && ctx) ctx.clearRect(0, 0, pad.width, pad.height);
    setDrawnImage(null);
  };

  const activeImage =
    mode === "draw" ? drawnImage : mode === "upload" ? uploadedImage : null;
  const sigCount =
    data?.fields.filter((f) => f.type === "signature" || f.type === "initials")
      .length ?? 0;
  const today = new Date().toISOString().slice(0, 10);

  const focusAdopt = useCallback(() => {
    adoptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // the required fields a signer must act on, top-to-bottom, for the "next
  // field" tour (dates fill automatically and optional fields are skipped)
  const tourFields = useMemo(
    () =>
      (data?.fields ?? [])
        .filter(isTourField)
        .sort((a, b) => a.page - b.page || b.y - a.y),
    [data],
  );

  const isIncomplete = useCallback(
    (f: Field) =>
      isFieldIncomplete(f, {
        textValue: textValues[f.id] ?? "",
        hasSignature: Boolean(typedName.trim() || activeImage),
      }),
    [textValues, typedName, activeImage],
  );

  const incompleteCount = tourFields.filter(isIncomplete).length;

  // the next field that still needs the signer's input, in reading order; the
  // guide points here and retires once everything is filled
  const nextField = useMemo(
    () => tourFields.find(isIncomplete) ?? null,
    [tourFields, isIncomplete],
  );

  // A signature is pre-filled from the signer's name, so every signature field
  // counts as "complete" from the first paint and `nextField` is null; the
  // guide would then vanish before the signer has even seen where their
  // signature lands, which on a multi-page document means no prompt to scroll
  // down to it at all. guideTargetField falls back to the signature to review.
  // The target is persistent: the guide's visibility is driven purely by whether
  // this target is on screen (below), so scrolling away from the signature
  // brings the guide back to lead the signer down to it again
  const guideTarget = useMemo(
    () => guideTargetField(tourFields, isIncomplete),
    [tourFields, isIncomplete],
  );

  // scroll a field to center and nudge the signer into it: a text field takes
  // focus, a signature field pulls up to the adopt box while still empty
  const focusField = useCallback(
    (field: Field) => {
      const el = document.querySelector<HTMLElement>(
        `[data-fid="${field.id}"]`,
      );
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(field.id);
      if (field.type === "text") setTimeout(() => el.focus(), 350);
      else if (isIncomplete(field)) focusAdopt();
      setTimeout(
        () => setHighlightId((id) => (id === field.id ? null : id)),
        1600,
      );
    },
    [isIncomplete, focusAdopt],
  );

  // the floating guide is a navigation aid, so it only shows when the next
  // field is off screen: it fades out once that field is in view and points up
  // or down toward it, matching the guided-signing pattern
  const [guide, setGuide] = useState<{ show: boolean; dir: "up" | "down" }>({
    show: false,
    dir: "down",
  });

  useEffect(() => {
    // nothing to point at, or the document (and its field overlays) have not
    // rendered yet, so there is nothing to measure against
    if (!guideTarget || pages.length === 0) {
      setGuide((g) => (g.show ? { show: false, dir: g.dir } : g));
      return;
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = document.querySelector<HTMLElement>(
        `[data-fid="${guideTarget.id}"]`,
      );
      if (!el) {
        setGuide((g) => (g.show ? { show: false, dir: g.dir } : g));
        return;
      }
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const margin = Math.min(140, vh * 0.2);
      const onScreen = rect.top >= margin && rect.bottom <= vh - margin;
      const dir: "up" | "down" = rect.top < margin ? "up" : "down";
      setGuide((g) =>
        g.show === !onScreen && g.dir === dir ? g : { show: !onScreen, dir },
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [guideTarget, pages.length]);

  const finish = async () => {
    const name = typedName.trim();
    if (!agreed) {
      setSubmitError(
        "Please agree to sign electronically before you continue.",
      );
      return;
    }
    if (sigCount > 0 && !name && !activeImage) {
      setSubmitError("Type, draw, or upload your signature first.");
      return;
    }
    // every required field must be filled before submitting
    if (incompleteCount > 0 && nextField) {
      setSubmitError("Please complete all required fields before signing.");
      focusField(nextField);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signature: name,
          signatureImage: activeImage ? activeImage.split(",")[1] : null,
          textValues,
          consent: true,
          accessCode: accessCode.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        if (err.error === "missing_required") {
          setSubmitError("Please complete all required fields before signing.");
          setSubmitting(false);
          if (nextField) focusField(nextField);
          return;
        }
        throw new Error();
      }
      const body = (await res.json().catch(() => ({}))) as {
        completed?: boolean;
      };
      setCompletedAll(body.completed === true);
      // remember the adopted signature for next time: to the signed-in user's
      // account when available (reused across devices), else to this device
      if (savedSignatureUrl) {
        void fetch(savedSignatureUrl, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            typedName: mode === "type" ? name : null,
            image: activeImage ?? null,
            mode,
          }),
        }).catch(() => {
          // saving the signature is best-effort
        });
      } else {
        try {
          localStorage.setItem(
            SIG_STORAGE_KEY,
            JSON.stringify({ name, image: activeImage ?? null, kind: mode }),
          );
        } catch {
          // storing the adopted signature is best-effort
        }
      }
      setDone(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async () => {
    setDeclining(true);
    try {
      const res = await fetch(`${base}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: declineReason.trim() || undefined,
          accessCode: accessCode.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setDeclineOpen(false);
      setDeclined(true);
    } catch {
      setSubmitError("Could not decline right now. Please try again.");
      setDeclineOpen(false);
    } finally {
      setDeclining(false);
    }
  };

  // --- States that don't render the document ---

  if (declined) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <XCircle className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 font-semibold text-2xl tracking-tight">
          You declined to sign
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          The sender has been notified, and this document can no longer be
          signed.
        </p>
      </div>
    );
  }

  if (state === "loading") {
    return <Centered>Loading the document.</Centered>;
  }
  if (state === "notfound") {
    return (
      <Centered>This signing link is not valid or has been revoked.</Centered>
    );
  }
  if (state === "error") {
    return <Centered>Could not load the document. Please try again.</Centered>;
  }
  if (state === "locked") {
    return (
      <div className="mx-auto w-full max-w-sm px-5 py-20 text-center">
        <Lock className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 font-semibold text-xl tracking-tight">
          Enter your access code
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          The sender protected this document with an access code. Enter the code
          they shared with you to open it.
        </p>
        <form onSubmit={submitCode} className="mt-6">
          <input
            className="input text-center"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Access code"
            // biome-ignore lint/a11y/noAutofocus: a single-purpose unlock screen
            autoFocus
          />
          {codeError && (
            <p className="mt-2 text-destructive text-sm">
              That code is not correct. Please try again.
            </p>
          )}
          <Button
            type="submit"
            className="mt-4 w-full"
            disabled={unlocking || !accessCode.trim()}
          >
            {unlocking ? "Checking..." : "Open document"}
          </Button>
        </form>
      </div>
    );
  }
  if (state === "verify") {
    return (
      <div className="mx-auto w-full max-w-sm px-5 py-20 text-center">
        <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 font-semibold text-xl tracking-tight">
          Verify it is you
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {otpEmail
            ? `We emailed a code to ${otpEmail}. Enter it to open the document.`
            : "We emailed you a code. Enter it to open the document."}
        </p>
        <form onSubmit={submitOtp} className="mt-6">
          <input
            className="input text-center text-lg tracking-[0.3em]"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            // biome-ignore lint/a11y/noAutofocus: a single-purpose verify screen
            autoFocus
          />
          {otpError && (
            <p className="mt-2 text-destructive text-sm">{otpError}</p>
          )}
          <Button
            type="submit"
            className="mt-4 w-full"
            disabled={otpBusy || !otpCode.trim()}
          >
            {otpBusy ? "Checking..." : "Verify and continue"}
          </Button>
        </form>
        <button
          type="button"
          onClick={resendOtp}
          disabled={otpBusy}
          className="mt-4 text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground disabled:opacity-60"
        >
          Resend code
        </button>
      </div>
    );
  }
  if (!data) return null;

  if (done || data.alreadySigned) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 font-semibold text-2xl tracking-tight">
          {data.documentName}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Thank you. This document has your signature.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {backHref ? (
            <a href={backHref}>
              <Button className="gap-2">View document</Button>
            </a>
          ) : (
            <>
              <a href={`${base}/download`}>
                <Button className="gap-2">
                  <Download className="size-4" /> Download signed PDF
                </Button>
              </a>
              {(completedAll || data.documentCompleted) && (
                <a href={`${base}/certificate`}>
                  <Button variant="outline" className="gap-2">
                    <FileCheck className="size-4" /> Certificate of completion
                  </Button>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (data.waitingFor) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          {data.documentName}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm">
          This document is signed in order, and it is not your turn yet. You
          will be emailed a link once {data.waitingFor} has signed.
        </p>
      </div>
    );
  }

  // --- The signing surface ---

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="font-semibold text-2xl tracking-tight">
        {data.documentName}
      </h1>
      <p className="mt-1 text-muted-foreground text-sm">
        {data.signerName}, review the document and sign where it is highlighted.
      </p>

      {/* Adopt signature */}
      <div
        ref={adoptRef}
        className="mt-6 rounded-2xl border border-border bg-card p-5"
      >
        <span className="font-medium text-sm">Adopt your signature</span>
        <div className="mt-3 inline-flex rounded-lg border border-border bg-muted/50 p-1 text-sm">
          {(coarsePointer
            ? (["draw", "type", "upload"] as const)
            : (["type", "draw", "upload"] as const)
          ).map((m) => (
            <TabButton key={m} active={mode === m} onClick={() => setMode(m)}>
              {m === "type" ? "Type" : m === "draw" ? "Draw" : "Upload"}
            </TabButton>
          ))}
        </div>

        {mode === "type" && (
          <input
            className="input mt-3"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Your full name"
          />
        )}
        {mode === "draw" && (
          <div className="mt-3">
            <canvas
              ref={padRef}
              width={420}
              height={120}
              onPointerDown={onPadDown}
              onPointerMove={onPadMove}
              onPointerUp={onPadUp}
              className="w-full max-w-[420px] touch-none rounded-lg border border-border border-dashed bg-background"
            />
            <button
              type="button"
              onClick={clearPad}
              className="mt-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              Clear
            </button>
          </div>
        )}
        {mode === "upload" && (
          <div className="mt-3">
            {uploadedImage ? (
              <div className="flex max-w-[420px] items-center justify-center rounded-lg border border-border bg-background p-3">
                <img
                  src={uploadedImage}
                  alt="Uploaded signature"
                  className="max-h-24 max-w-full"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="flex w-full max-w-[420px] flex-col items-center gap-1.5 rounded-lg border border-border border-dashed bg-background px-4 py-6 text-muted-foreground text-sm hover:border-primary/60 hover:bg-muted/40"
              >
                <UploadCloud className="size-6" />
                Upload an image of your signature (PNG or JPG)
              </button>
            )}
            <input
              ref={uploadRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => onUploadFile(e.target.files?.[0] ?? null)}
            />
            {uploadedImage && (
              <button
                type="button"
                onClick={() => {
                  setUploadedImage(null);
                  if (uploadRef.current) uploadRef.current.value = "";
                }}
                className="mt-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="sticky top-16 z-10 mt-6 flex flex-col gap-2 border-border border-b bg-background/90 py-3 backdrop-blur sm:flex-row sm:items-center sm:gap-3">
        <span className="text-muted-foreground text-sm sm:flex-1">
          {sigCount
            ? `Sign in ${sigCount} place${sigCount === 1 ? "" : "s"}; dates fill in automatically.`
            : "Click Finish to apply your signature."}
        </span>
        <Button
          className="w-full shrink-0 sm:w-auto"
          onClick={finish}
          disabled={submitting || !agreed}
        >
          {submitting ? "Signing..." : "Finish and sign"}
        </Button>
      </div>

      {/* Electronic-records consent (ESIGN / UETA) */}
      <label className="mt-3 flex items-start gap-2.5 text-muted-foreground text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          I agree to sign this document electronically, and that my electronic
          signature and initials are the legal equivalent of my handwritten
          signature and are binding.
        </span>
      </label>
      {submitError && (
        <p className="mt-2 text-destructive text-sm">{submitError}</p>
      )}
      <button
        type="button"
        onClick={() => setDeclineOpen(true)}
        className="mt-2 text-muted-foreground text-sm underline-offset-4 hover:text-destructive hover:underline"
      >
        Decline to sign
      </button>

      {/* Document */}
      <div className="mt-6 space-y-4">
        {pages.length === 0 ? (
          <>
            <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Rendering the
              document.
            </div>
            {[0, 1].map((k) => (
              <div
                key={k}
                className="mx-auto w-full animate-pulse rounded bg-muted"
                style={{ maxWidth: 612, aspectRatio: "612 / 792" }}
              />
            ))}
          </>
        ) : (
          pages.map((pg, i) => {
            const pageNo = i + 1;
            return (
              <div
                key={pageNo}
                className="relative mx-auto w-full shadow-sm"
                style={{
                  maxWidth: pg.width,
                  aspectRatio: `${pg.width} / ${pg.height}`,
                }}
              >
                <img
                  src={pg.src}
                  alt={`Page ${pageNo}`}
                  className="block w-full"
                />
                {data.fields
                  .filter((f) => f.page === pageNo)
                  .map((f) => (
                    <FieldOverlay
                      key={f.id}
                      field={f}
                      pageWidthPt={pg.widthPt}
                      pageHeightPt={pg.heightPt}
                      today={today}
                      typedName={typedName}
                      image={activeImage}
                      highlight={highlightId === f.id}
                      color={data.signerColor || "#be6221"}
                      textValue={textValues[f.id] ?? ""}
                      onText={(v) =>
                        setTextValues((prev) => {
                          // selecting a radio clears its group siblings
                          if (f.type === "radio" && f.groupId) {
                            const next = { ...prev };
                            for (const other of data.fields) {
                              if (
                                other.type === "radio" &&
                                other.groupId === f.groupId
                              ) {
                                next[other.id] = "";
                              }
                            }
                            next[f.id] = v;
                            return next;
                          }
                          return { ...prev, [f.id]: v };
                        })
                      }
                      onAdoptClick={focusAdopt}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>

      {/* Floating guide to the next field: shown whenever a required field is
          still unfilled, so it is always discoverable, and the arrow points
          toward the field (up/down) */}
      {pages.length > 0 && guideTarget && (
        <button
          type="button"
          onClick={() => focusField(guideTarget)}
          className="fixed bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground text-sm shadow-lg transition-colors hover:bg-primary/90"
        >
          {guide.dir === "up" ? (
            <ArrowUp className="size-4" />
          ) : (
            <ArrowDown className="size-4" />
          )}
          {incompleteCount > 1
            ? `Next field (${incompleteCount} left)`
            : incompleteCount === 1
              ? "Go to next field"
              : "Go to your signature"}
        </button>
      )}

      {/* Decline to sign */}
      <DialogRoot
        open={declineOpen}
        onOpenChange={(e) => {
          if (declining) return;
          setDeclineOpen(e.open);
        }}
        closeOnEscape={!declining}
        closeOnInteractOutside={!declining}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Decline to sign?</DialogTitle>
          <DialogDescription>
            This voids the document for everyone, and it can no longer be
            signed. The sender will be notified.
          </DialogDescription>
          <textarea
            className="input mt-3 min-h-20"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Reason (optional)"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={declining}
              onClick={() => setDeclineOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={declining}
              onClick={decline}
            >
              {declining ? "Declining..." : "Decline to sign"}
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
};

const FieldOverlay = ({
  field,
  pageWidthPt,
  pageHeightPt,
  today,
  typedName,
  image,
  highlight,
  color,
  textValue,
  onText,
  onAdoptClick,
}: {
  field: Field;
  pageWidthPt: number;
  pageHeightPt: number;
  today: string;
  typedName: string;
  image: string | null;
  highlight: boolean;
  /** this signer's color, used to tint their fields (Adobe-Sign style) */
  color: string;
  textValue: string;
  onText: (v: string) => void;
  onAdoptClick: () => void;
}) => {
  // position proportionally so overlays track the page as it scales to fit
  const pct = (n: number, total: number) => `${(n / total) * 100}%`;
  const base: React.CSSProperties = {
    position: "absolute",
    left: pct(field.x, pageWidthPt),
    top: pct(pageHeightPt - field.y - field.height, pageHeightPt),
    width: pct(field.width, pageWidthPt),
    height: pct(field.height, pageHeightPt),
  };
  const tint = `${color}1a`; // ~10% alpha
  const style: React.CSSProperties = {
    ...base,
    borderColor: color,
    background: tint,
  };
  const name = typedName.trim();
  const ring = highlight ? "ring-2 ring-primary ring-offset-2" : "";

  if (field.type === "checkbox") {
    const checked = textValue === "true";
    return (
      <button
        type="button"
        data-fid={field.id}
        aria-pressed={checked}
        onClick={() => onText(checked ? "" : "true")}
        style={{
          ...base,
          borderColor: color,
          background: checked ? `${color}33` : tint,
        }}
        className={`flex items-center justify-center rounded border ${ring}`}
      >
        {checked && (
          <Check className="size-[80%]" style={{ color }} strokeWidth={3} />
        )}
      </button>
    );
  }

  if (field.type === "dropdown") {
    return (
      <div style={style} className={`overflow-hidden rounded border ${ring}`}>
        <select
          data-fid={field.id}
          value={textValue}
          onChange={(e) => onText(e.target.value)}
          className="size-full border-0 bg-transparent px-1 text-slate-800"
        >
          <option value="">Select...</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "radio") {
    // one button of a radio group: an outlined circle (filled when chosen) and
    // its label; selecting it clears the group's other buttons
    const selected = textValue === "selected";
    const label = field.options?.[0] ?? "";
    return (
      <button
        type="button"
        data-fid={field.id}
        aria-pressed={selected}
        onClick={() => onText("selected")}
        style={{ ...base, background: "transparent" }}
        className={`flex items-center gap-1.5 overflow-hidden px-0.5 text-left ${ring}`}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: color, width: "0.9em", height: "0.9em" }}
        >
          {selected && (
            <span
              className="rounded-full"
              style={{ background: color, width: "0.5em", height: "0.5em" }}
            />
          )}
        </span>
        <span className="truncate text-slate-800 text-xs">{label}</span>
      </button>
    );
  }

  if (field.type === "date") {
    return (
      <div style={style} className={`overflow-hidden rounded border ${ring}`}>
        <input
          data-fid={field.id}
          value={textValue || today}
          onChange={(e) => onText(e.target.value)}
          className="size-full border-0 bg-transparent px-1 text-center font-semibold text-slate-800 italic"
        />
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div style={style} className={`overflow-hidden rounded border ${ring}`}>
        <input
          data-fid={field.id}
          value={textValue}
          onChange={(e) => onText(e.target.value)}
          placeholder="Text"
          className="size-full border-0 bg-transparent px-1 text-slate-800"
        />
      </div>
    );
  }

  // signature or initials
  const isInitials = field.type === "initials";
  const mark = isInitials ? initialsOf(name) : name;
  const filled = Boolean(image || name);

  return (
    <button
      type="button"
      onClick={onAdoptClick}
      style={{
        ...base,
        borderColor: color,
        background: filled ? "transparent" : tint,
      }}
      data-fid={field.id}
      className={`flex cursor-pointer items-center justify-center overflow-hidden rounded border ${ring}`}
    >
      {image ? (
        <img src={image} alt="signature" className="max-h-full max-w-full" />
      ) : name ? (
        <span className="whitespace-nowrap font-semibold text-slate-800 italic">
          {mark}
        </span>
      ) : (
        <span
          className="font-semibold text-xs uppercase tracking-wide"
          style={{ color }}
        >
          {isInitials ? "Initials" : "Sign"}
        </span>
      )}
    </button>
  );
};

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-md px-5 py-20 text-center text-muted-foreground text-sm">
    {children}
  </div>
);

export default SignerFill;
