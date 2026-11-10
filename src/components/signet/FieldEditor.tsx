import { Button } from "@omnidotdev/thornberry/button";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Loader2,
  PenLine,
  Type as TypeIcon,
  X,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type FieldType = "signature" | "initials" | "date" | "text";

interface EditorField {
  key: string;
  id?: string;
  signerId: string | null;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
interface EditorSigner {
  id: string;
  name: string;
  email: string | null;
  color: string | null;
  status: string;
  orderIndex: number;
}
interface EditorData {
  id: string;
  name: string;
  status: string;
  pdfBase64: string;
  signers: EditorSigner[];
  fields: Omit<EditorField, "key">[];
}
interface RenderedPage {
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
  src: string;
}

const SCALE = 1.25;
const DEFAULTS: Record<FieldType, { w: number; h: number }> = {
  signature: { w: 170, h: 30 },
  initials: { w: 72, h: 30 },
  date: { w: 120, h: 24 },
  text: { w: 150, h: 26 },
};
const TYPE_META: { type: FieldType; label: string; icon: typeof PenLine }[] = [
  { type: "signature", label: "Signature", icon: PenLine },
  { type: "date", label: "Date", icon: CalendarDays },
  { type: "initials", label: "Initials", icon: TypeIcon },
  { type: "text", label: "Text", icon: TypeIcon },
];

const base64ToBytes = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const uid = () => Math.random().toString(36).slice(2);
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Native field editor for a draft. Renders the PDF with pdf.js and lets the
 * sender place, move, resize, assign, and delete fields before sending. Runs on
 * the client; saves back to the owner-scoped API.
 */
const FieldEditor = ({ token }: { token: string }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<EditorData | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [fields, setFields] = useState<EditorField[]>([]);
  const [activeSigner, setActiveSigner] = useState<string | null>(null);
  const [addType, setAddType] = useState<FieldType | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const dragRef = useRef<{
    key: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: EditorField;
    ptPerPx: number;
  } | null>(null);

  // Load editor data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/signet/documents/${token}/editor`);
        if (!res.ok) throw new Error();
        const body = (await res.json()) as EditorData;
        if (cancelled) return;
        setData(body);
        setFields(body.fields.map((f) => ({ ...f, key: uid() })));
        setActiveSigner(body.signers[0]?.id ?? null);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Render the PDF
  useEffect(() => {
    if (!data) return;
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

  const signerColor = useCallback(
    (signerId: string | null) =>
      data?.signers.find((s) => s.id === signerId)?.color ?? "#be6221",
    [data],
  );

  // Add a field by clicking the page when a type is armed
  const onPageClick = (
    e: React.MouseEvent,
    pageNo: number,
    pg: RenderedPage,
  ) => {
    if (!addType) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPt = ((e.clientX - rect.left) / rect.width) * pg.widthPt;
    const topFrac = (e.clientY - rect.top) / rect.height;
    const def = DEFAULTS[addType];
    const yPt = pg.heightPt * (1 - topFrac) - def.h;
    const key = uid();
    setFields((prev) => [
      ...prev,
      {
        key,
        signerId: activeSigner,
        type: addType,
        page: pageNo,
        x: clamp(xPt - def.w / 2, 0, pg.widthPt - def.w),
        y: clamp(yPt, 0, pg.heightPt - def.h),
        width: def.w,
        height: def.h,
      },
    ]);
    setSelected(key);
    setAddType(null);
  };

  // Drag + resize
  const onPointerDown = (
    e: React.PointerEvent,
    field: EditorField,
    mode: "move" | "resize",
    pg: RenderedPage,
  ) => {
    e.stopPropagation();
    const pageEl = (e.currentTarget as HTMLElement).closest(
      "[data-page]",
    ) as HTMLElement | null;
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();
    dragRef.current = {
      key: field.key,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: field,
      ptPerPx: pg.widthPt / rect.width,
    };
    setSelected(field.key);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent, pg: RenderedPage) => {
    const d = dragRef.current;
    if (!d) return;
    const dxPt = (e.clientX - d.startX) * d.ptPerPx;
    const dyPt = (e.clientY - d.startY) * d.ptPerPx;
    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== d.key) return f;
        if (d.mode === "move") {
          return {
            ...f,
            x: clamp(d.orig.x + dxPt, 0, pg.widthPt - f.width),
            // screen-down is pt-down (y is bottom-left origin)
            y: clamp(d.orig.y - dyPt, 0, pg.heightPt - f.height),
          };
        }
        // resize from the bottom-right handle: grow width right, height down
        const width = clamp(d.orig.width + dxPt, 40, pg.widthPt - f.x);
        const height = clamp(
          d.orig.height + dyPt,
          16,
          d.orig.y + d.orig.height,
        );
        return { ...f, width, height, y: d.orig.y + d.orig.height - height };
      }),
    );
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const removeField = (key: string) =>
    setFields((prev) => prev.filter((f) => f.key !== key));
  const assignSelected = (signerId: string) => {
    if (selected)
      setFields((prev) =>
        prev.map((f) => (f.key === selected ? { ...f, signerId } : f)),
      );
    setActiveSigner(signerId);
  };

  const persist = async () => {
    const payload = fields.map(({ key, ...f }) => f);
    const res = await fetch(`/api/signet/documents/${token}/fields`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields: JSON.stringify(payload) }),
    });
    if (!res.ok) throw new Error();
  };

  const save = async () => {
    setSaving(true);
    try {
      await persist();
      toast.success("Fields saved.");
    } catch {
      toast.error("Could not save the fields.");
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      await persist();
      const res = await fetch(`/api/signet/documents/${token}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Sent for signature.");
      navigate({ to: "/documents/$id", params: { id: token } });
    } catch {
      toast.error("Could not send the document.");
      setSending(false);
    }
  };

  if (state === "loading") return <Centered>Loading the editor.</Centered>;
  if (state === "error" || !data)
    return (
      <Centered>
        Could not load this draft, or it can no longer be edited.
      </Centered>
    );
  if (data.status !== "draft")
    return (
      <Centered>
        This document has been sent and can no longer be edited.
      </Centered>
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="font-semibold text-2xl tracking-tight">{data.name}</h1>
      <p className="mt-1 text-muted-foreground text-sm">
        Place a field, then click the page to drop it. Drag to move, use the
        corner to resize.
      </p>

      {/* Toolbar */}
      <div className="sticky top-16 z-10 mt-5 flex flex-col gap-3 border-border border-b bg-background/90 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            Add
          </span>
          {TYPE_META.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setAddType(addType === type ? null : type)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-medium text-sm transition-colors ${
                addType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data.signers.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Signer</span>
              <select
                className="input h-9 py-1"
                value={
                  (selected &&
                    fields.find((f) => f.key === selected)?.signerId) ||
                  activeSigner ||
                  ""
                }
                onChange={(e) => assignSelected(e.target.value)}
              >
                {data.signers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="flex-1" />
          <Button variant="outline" disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button disabled={sending} onClick={sendNow}>
            {sending ? "Sending..." : "Save and send"}
          </Button>
        </div>
      </div>

      {/* Document */}
      <div className="mt-6 space-y-4">
        {pages.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" /> Rendering the document.
          </div>
        ) : (
          pages.map((pg, i) => {
            const pageNo = i + 1;
            return (
              <button
                type="button"
                key={pageNo}
                data-page={pageNo}
                onClick={(e) => onPageClick(e, pageNo, pg)}
                className={`relative mx-auto block w-full p-0 shadow-sm ${addType ? "cursor-crosshair" : "cursor-default"}`}
                style={{
                  maxWidth: pg.width,
                  aspectRatio: `${pg.width} / ${pg.height}`,
                }}
              >
                <img
                  src={pg.src}
                  alt={`Page ${pageNo}`}
                  className="pointer-events-none block w-full"
                />
                {fields
                  .filter((f) => f.page === pageNo)
                  .map((f) => (
                    <FieldBox
                      key={f.key}
                      field={f}
                      page={pg}
                      color={signerColor(f.signerId)}
                      selected={selected === f.key}
                      onSelect={() => setSelected(f.key)}
                      onRemove={() => removeField(f.key)}
                      onDown={(e, mode) => onPointerDown(e, f, mode, pg)}
                      onMove={(e) => onPointerMove(e, pg)}
                      onUp={onPointerUp}
                    />
                  ))}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

const FieldBox = ({
  field,
  page,
  color,
  selected,
  onSelect,
  onRemove,
  onDown,
  onMove,
  onUp,
}: {
  field: EditorField;
  page: RenderedPage;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDown: (e: React.PointerEvent, mode: "move" | "resize") => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
}) => {
  const pct = (n: number, total: number) => `${(n / total) * 100}%`;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a draggable field box carries nested controls (delete, resize), so it cannot be a native <button>
    <div
      role="button"
      tabIndex={0}
      aria-label={`${field.type} field`}
      onPointerDown={(e) => {
        onSelect();
        onDown(e, "move");
      }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{
        position: "absolute",
        left: pct(field.x, page.widthPt),
        top: pct(page.heightPt - field.y - field.height, page.heightPt),
        width: pct(field.width, page.widthPt),
        height: pct(field.height, page.heightPt),
        borderColor: color,
        background: `${color}1a`,
        boxShadow: selected ? `0 0 0 2px ${color}` : undefined,
      }}
      className="flex cursor-move touch-none items-center justify-center overflow-visible rounded border"
    >
      <span
        className="pointer-events-none select-none font-semibold text-[0.6rem] uppercase tracking-wide"
        style={{ color }}
      >
        {field.type}
      </span>
      {selected && (
        <>
          <button
            type="button"
            aria-label="Delete field"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
          >
            <X className="size-3" />
          </button>
          <div
            onPointerDown={(e) => onDown(e, "resize")}
            className="absolute -right-1.5 -bottom-1.5 size-3 cursor-se-resize rounded-sm border border-white"
            style={{ background: color }}
          />
        </>
      )}
    </div>
  );
};

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-md px-5 py-20 text-center text-muted-foreground text-sm">
    {children}
  </div>
);

export default FieldEditor;
