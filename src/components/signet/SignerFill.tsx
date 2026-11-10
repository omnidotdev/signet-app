import { Button } from "@omnidotdev/thornberry/button";
import { CheckCircle2, Download } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useEffect, useRef, useState } from "react";

interface Field {
  id: string;
  type: "signature" | "initials" | "date" | "text";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FillData {
  documentName: string;
  signerName: string;
  alreadySigned: boolean;
  waitingFor: string | null;
  pdfBase64: string;
  fields: Field[];
}

interface RenderedPage {
  width: number;
  height: number;
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
const SignerFill = ({ token }: { token: string }) => {
  const [data, setData] = useState<FillData | null>(null);
  const [state, setState] = useState<
    "loading" | "error" | "notfound" | "ready"
  >("loading");
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [typedName, setTypedName] = useState("");
  const [drawnImage, setDrawnImage] = useState<string | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const padRef = useRef<HTMLCanvasElement>(null);
  const adoptRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<[number, number]>([0, 0]);

  // Load the signer's fill data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/signet/sign/${token}`);
        if (res.status === 404) {
          if (!cancelled) setState("notfound");
          return;
        }
        if (!res.ok) throw new Error();
        const body = (await res.json()) as FillData;
        if (cancelled) return;
        setData(body);
        setTypedName(body.signerName);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Restore a signature adopted earlier on this device
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SIG_STORAGE_KEY) ?? "{}");
      if (typeof saved.name === "string" && saved.name)
        setTypedName(saved.name);
      if (typeof saved.image === "string" && saved.image) {
        setDrawnImage(saved.image);
        setMode("draw");
      }
    } catch {
      // no saved signature, fine
    }
  }, []);

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

  const activeImage = mode === "draw" ? drawnImage : null;
  const sigCount =
    data?.fields.filter((f) => f.type === "signature" || f.type === "initials")
      .length ?? 0;
  const today = new Date().toISOString().slice(0, 10);

  const focusAdopt = useCallback(() => {
    adoptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const finish = async () => {
    const name = typedName.trim();
    if (sigCount > 0 && !name && !activeImage) {
      setSubmitError("Type or draw your signature first.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/signet/sign/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signature: name,
          signatureImage: activeImage ? activeImage.split(",")[1] : null,
          textValues,
        }),
      });
      if (!res.ok) throw new Error();
      try {
        localStorage.setItem(
          SIG_STORAGE_KEY,
          JSON.stringify({ name, image: activeImage ?? null }),
        );
      } catch {
        // storing the adopted signature is best-effort
      }
      setDone(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- States that don't render the document ---

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
        <a href={`/api/signet/sign/${token}/download`}>
          <Button className="mt-6 gap-2">
            <Download className="size-4" /> Download signed PDF
          </Button>
        </a>
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
          <TabButton active={mode === "type"} onClick={() => setMode("type")}>
            Type
          </TabButton>
          <TabButton active={mode === "draw"} onClick={() => setMode("draw")}>
            Draw
          </TabButton>
        </div>

        {mode === "type" ? (
          <input
            className="input mt-3"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Your full name"
          />
        ) : (
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
      </div>

      {/* Toolbar */}
      <div className="sticky top-16 z-10 mt-6 flex items-center gap-3 border-border border-b bg-background/90 py-3 backdrop-blur">
        <span className="text-muted-foreground text-sm">
          {sigCount
            ? `Sign in ${sigCount} place${sigCount === 1 ? "" : "s"}; dates fill in automatically.`
            : "Click Finish to apply your signature."}
        </span>
        <span className="flex-1" />
        <Button onClick={finish} disabled={submitting}>
          {submitting ? "Signing..." : "Finish and sign"}
        </Button>
      </div>
      {submitError && (
        <p className="mt-2 text-destructive text-sm">{submitError}</p>
      )}

      {/* Document */}
      <div className="mt-6 space-y-4">
        {pages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Rendering the document.
          </p>
        ) : (
          pages.map((pg, i) => {
            const pageNo = i + 1;
            return (
              <div
                key={pageNo}
                className="relative mx-auto w-fit shadow-sm"
                style={{ width: pg.width, height: pg.height }}
              >
                <img
                  src={pg.src}
                  alt={`Page ${pageNo}`}
                  width={pg.width}
                  height={pg.height}
                />
                {data.fields
                  .filter((f) => f.page === pageNo)
                  .map((f) => (
                    <FieldOverlay
                      key={f.id}
                      field={f}
                      pageHeightPt={pg.heightPt}
                      today={today}
                      typedName={typedName}
                      image={activeImage}
                      textValue={textValues[f.id] ?? ""}
                      onText={(v) =>
                        setTextValues((prev) => ({ ...prev, [f.id]: v }))
                      }
                      onAdoptClick={focusAdopt}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const FieldOverlay = ({
  field,
  pageHeightPt,
  today,
  typedName,
  image,
  textValue,
  onText,
  onAdoptClick,
}: {
  field: Field;
  pageHeightPt: number;
  today: string;
  typedName: string;
  image: string | null;
  textValue: string;
  onText: (v: string) => void;
  onAdoptClick: () => void;
}) => {
  const style: React.CSSProperties = {
    position: "absolute",
    left: field.x * SCALE,
    top: (pageHeightPt - field.y - field.height) * SCALE,
    width: field.width * SCALE,
    height: field.height * SCALE,
  };

  const name = typedName.trim();
  const filledClass =
    "flex items-center justify-center overflow-hidden rounded border border-primary";

  if (field.type === "date") {
    return (
      <div style={style} className={filledClass}>
        <span className="whitespace-nowrap font-semibold text-slate-800 italic">
          {today}
        </span>
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div
        style={style}
        className="overflow-hidden rounded border border-primary bg-primary/10"
      >
        <input
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
      style={style}
      className={`${filledClass} cursor-pointer ${filled ? "" : "bg-primary/10"}`}
    >
      {image ? (
        <img src={image} alt="signature" className="max-h-full max-w-full" />
      ) : name ? (
        <span className="whitespace-nowrap font-semibold text-slate-800 italic">
          {mark}
        </span>
      ) : (
        <span className="font-semibold text-primary text-xs uppercase tracking-wide">
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
