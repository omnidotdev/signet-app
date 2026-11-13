import { Button } from "@omnidotdev/thornberry/button";
import { useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  ChevronDown,
  CircleDot,
  Loader2,
  PenLine,
  Pencil,
  Plus,
  SquareCheck,
  Trash2,
  Type as TypeIcon,
  X,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/signet/ConfirmDialog";
import {
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { DATE_FORMAT_OPTIONS } from "@/lib/signet/dateFormat";

/** The default stamped ink (the signing blue), shown when a field has no color */
const DEFAULT_FIELD_INK = "#1c2e73";

type FieldType =
  | "signature"
  | "initials"
  | "date"
  | "text"
  | "checkbox"
  | "dropdown"
  | "radio";

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
  /** choices for a dropdown field, or [label] for a radio button */
  options?: string[] | null;
  /** whether the signer must fill this field before submitting */
  required?: boolean;
  /** links mutually-exclusive radio buttons into one group */
  groupId?: string | null;
  /** date style for a date field: iso | us | eu | long */
  dateFormat?: string | null;
  /** ink for this field's stamped mark, as #rrggbb; null uses the default */
  color?: string | null;
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
  signature: { w: 200, h: 44 },
  initials: { w: 96, h: 44 },
  date: { w: 140, h: 32 },
  text: { w: 170, h: 32 },
  checkbox: { w: 28, h: 28 },
  dropdown: { w: 170, h: 32 },
  radio: { w: 170, h: 32 },
};
const DEFAULT_OPTIONS = ["Option 1", "Option 2"];
// checkboxes and choice fields are optional by default; the rest must be filled
const defaultRequired = (type: FieldType): boolean =>
  type !== "checkbox" && type !== "dropdown" && type !== "radio";
const TYPE_META: { type: FieldType; label: string; icon: typeof PenLine }[] = [
  { type: "signature", label: "Signature", icon: PenLine },
  { type: "date", label: "Date", icon: CalendarDays },
  { type: "initials", label: "Initials", icon: TypeIcon },
  { type: "text", label: "Text", icon: TypeIcon },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "radio", label: "Radio", icon: CircleDot },
  { type: "checkbox", label: "Checkbox", icon: SquareCheck },
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
  // signers are held separately from `data` so adding/editing/removing one does
  // not re-render the PDF
  const [signers, setSigners] = useState<EditorSigner[]>([]);
  const [addType, setAddType] = useState<FieldType | null>(null);
  // the signer dialog (add a new signer, or edit an existing one), and the
  // pending removal awaiting confirmation
  const [signerForm, setSignerForm] = useState<{
    id: string | null;
    name: string;
    email: string;
  } | null>(null);
  const [signerBusy, setSignerBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<EditorSigner | null>(null);
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
        setSigners(body.signers);
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
      signers.find((s) => s.id === signerId)?.color ?? "#be6221",
    [signers],
  );

  // Add a signer to this draft, then open it for naming
  const addSigner = async () => {
    setSignerBusy(true);
    try {
      const res = await fetch(`/api/signet/documents/${token}/signers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New signer" }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { signer: EditorSigner };
      setSigners((prev) => [...prev, body.signer]);
      setSignerForm({ id: body.signer.id, name: body.signer.name, email: "" });
    } catch {
      toast.error("Could not add a signer.");
    } finally {
      setSignerBusy(false);
    }
  };

  // Save the signer dialog (name/email) for the signer it targets
  const saveSigner = async () => {
    if (!signerForm) return;
    const name = signerForm.name.trim();
    if (!name) return;
    setSignerBusy(true);
    try {
      const res = await fetch(
        `/api/signet/documents/${token}/signers/${signerForm.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, email: signerForm.email.trim() }),
        },
      );
      if (!res.ok) throw new Error();
      setSigners((prev) =>
        prev.map((s) =>
          s.id === signerForm.id
            ? { ...s, name, email: signerForm.email.trim() || null }
            : s,
        ),
      );
      setSignerForm(null);
    } catch {
      toast.error("Could not save this signer.");
    } finally {
      setSignerBusy(false);
    }
  };

  // Remove a signer (and the fields assigned to them)
  const removeSigner = async (target: EditorSigner) => {
    setSignerBusy(true);
    try {
      const res = await fetch(
        `/api/signet/documents/${token}/signers/${target.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      setSigners((prev) => prev.filter((s) => s.id !== target.id));
      setFields((prev) => prev.filter((f) => f.signerId !== target.id));
      setActiveSigner((cur) =>
        cur === target.id
          ? (signers.find((s) => s.id !== target.id)?.id ?? null)
          : cur,
      );
      setRemoveTarget(null);
    } catch {
      toast.error("Could not remove this signer.");
    } finally {
      setSignerBusy(false);
    }
  };

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
    const x = clamp(xPt - def.w / 2, 0, pg.widthPt - def.w);
    const y = clamp(yPt, 0, pg.heightPt - def.h);
    const key = uid();
    const placed: EditorField = {
      key,
      signerId: activeSigner,
      type: addType,
      page: pageNo,
      x,
      y,
      width: def.w,
      height: def.h,
      required: defaultRequired(addType),
      options:
        addType === "dropdown"
          ? [...DEFAULT_OPTIONS]
          : addType === "radio"
            ? ["Option"]
            : undefined,
      groupId: addType === "radio" ? "choice" : undefined,
    };
    // a signature brings a companion "date signed" field beneath it, like the
    // major e-sign tools, so the signing date is always captured
    const extras: EditorField[] = [];
    if (addType === "signature") {
      const dateDef = DEFAULTS.date;
      extras.push({
        key: uid(),
        signerId: activeSigner,
        type: "date",
        page: pageNo,
        x,
        y: clamp(y - dateDef.h - 4, 0, pg.heightPt - dateDef.h),
        width: dateDef.w,
        height: dateDef.h,
        required: true,
      });
    }
    setFields((prev) => [...prev, placed, ...extras]);
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
  const selectedField = fields.find((f) => f.key === selected);
  const setSelectedOptions = (raw: string) => {
    const options = raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    setFields((prev) =>
      prev.map((f) => (f.key === selected ? { ...f, options } : f)),
    );
  };
  const setSelectedRequired = (required: boolean) =>
    setFields((prev) =>
      prev.map((f) => (f.key === selected ? { ...f, required } : f)),
    );
  const setSelectedRadioLabel = (label: string) =>
    setFields((prev) =>
      prev.map((f) => (f.key === selected ? { ...f, options: [label] } : f)),
    );
  const setSelectedGroup = (groupId: string) =>
    setFields((prev) =>
      prev.map((f) => (f.key === selected ? { ...f, groupId } : f)),
    );
  const setSelectedDateFormat = (dateFormat: string) =>
    setFields((prev) =>
      prev.map((f) =>
        f.key === selected
          ? { ...f, dateFormat: dateFormat === "iso" ? null : dateFormat }
          : f,
      ),
    );
  const setSelectedColor = (color: string | null) =>
    setFields((prev) =>
      prev.map((f) => (f.key === selected ? { ...f, color } : f)),
    );
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
          {signers.length > 1 && (
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
                {signers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedField?.type === "dropdown" && (
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:flex-none">
              <span className="text-muted-foreground">Options</span>
              <input
                className="input h-9 min-w-0 flex-1 py-1 sm:w-64"
                value={(selectedField.options ?? []).join(", ")}
                onChange={(e) => setSelectedOptions(e.target.value)}
                placeholder="Comma-separated choices"
              />
            </label>
          )}
          {selectedField?.type === "radio" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Label</span>
                <input
                  className="input h-9 w-32 py-1"
                  value={selectedField.options?.[0] ?? ""}
                  onChange={(e) => setSelectedRadioLabel(e.target.value)}
                  placeholder="Choice"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Group</span>
                <input
                  className="input h-9 w-28 py-1"
                  value={selectedField.groupId ?? ""}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  placeholder="Group"
                />
              </label>
            </>
          )}
          {selectedField?.type === "date" && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Date format</span>
              <select
                className="input h-9 py-1"
                value={selectedField.dateFormat ?? "iso"}
                onChange={(e) => setSelectedDateFormat(e.target.value)}
              >
                {DATE_FORMAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedField && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Color</span>
              <input
                type="color"
                aria-label="Field color"
                className="h-9 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
                value={selectedField.color ?? DEFAULT_FIELD_INK}
                onChange={(e) => setSelectedColor(e.target.value)}
              />
              {selectedField.color && (
                <button
                  type="button"
                  className="text-muted-foreground text-xs underline"
                  onClick={() => setSelectedColor(null)}
                >
                  Reset
                </button>
              )}
            </label>
          )}
          {selectedField && selectedField.type !== "date" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selectedField.required !== false}
                onChange={(e) => setSelectedRequired(e.target.checked)}
              />
              <span className="text-muted-foreground">Required</span>
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

        {/* Signer roster: add, edit, or remove signers on this draft */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            Signers
          </span>
          {signers.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pr-1 pl-2.5 text-sm"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: s.color ?? "#be6221" }}
              />
              <span className="max-w-[12rem] truncate font-medium">
                {s.name}
              </span>
              <button
                type="button"
                aria-label={`Edit ${s.name}`}
                onClick={() =>
                  setSignerForm({
                    id: s.id,
                    name: s.name,
                    email: s.email ?? "",
                  })
                }
                className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              {signers.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => setRemoveTarget(s)}
                  className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </span>
          ))}
          <button
            type="button"
            disabled={signerBusy}
            onClick={addSigner}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-2.5 py-1 font-medium text-primary text-sm hover:bg-primary/10 disabled:opacity-60"
          >
            <Plus className="size-4" /> Add signer
          </button>
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
              // biome-ignore lint/a11y/noStaticElementInteractions: the page is a pointer-driven placement canvas that must contain interactive field boxes, so it cannot be a native button; nesting interactive content inside a button is invalid and breaks field drag on hydration
              // biome-ignore lint/a11y/useKeyWithClickEvents: placing a field at pointer coordinates is an inherently pointer-driven canvas gesture with no keyboard-coordinate equivalent; fields are added and then repositioned with pointer drag
              <div
                key={pageNo}
                data-page={pageNo}
                onClick={(e) => onPageClick(e, pageNo, pg)}
                className={`relative mx-auto block w-full shadow-sm ${addType ? "cursor-crosshair" : "cursor-default"}`}
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
              </div>
            );
          })
        )}
      </div>

      {/* Add or edit a signer */}
      <DialogRoot
        open={signerForm !== null}
        onOpenChange={(e) => {
          if (signerBusy) return;
          if (!e.open) setSignerForm(null);
        }}
        closeOnEscape={!signerBusy}
        closeOnInteractOutside={!signerBusy}
      >
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Signer</DialogTitle>
          <DialogDescription>
            Name the signer, and optionally add their email so they receive a
            signing link when you send.
          </DialogDescription>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveSigner();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name</span>
              <input
                className="input"
                value={signerForm?.name ?? ""}
                onChange={(e) =>
                  setSignerForm((f) => (f ? { ...f, name: e.target.value } : f))
                }
                placeholder="Full name"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Email</span>
              <input
                className="input"
                type="email"
                value={signerForm?.email ?? ""}
                onChange={(e) =>
                  setSignerForm((f) =>
                    f ? { ...f, email: e.target.value } : f,
                  )
                }
                placeholder="name@example.com"
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={signerBusy}
                onClick={() => setSignerForm(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={signerBusy || !signerForm?.name.trim()}
              >
                {signerBusy ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogRoot>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={`Remove ${removeTarget?.name ?? "signer"}?`}
        description="Their fields on this document will be removed too. This cannot be undone."
        confirmLabel="Remove signer"
        destructive
        busy={signerBusy}
        onConfirm={() => {
          if (removeTarget) removeSigner(removeTarget);
        }}
      />
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
      {field.type === "checkbox" ? (
        <SquareCheck
          className="pointer-events-none size-3.5"
          style={{ color }}
        />
      ) : field.type === "radio" ? (
        <span
          className="pointer-events-none flex select-none items-center gap-1 text-[0.6rem]"
          style={{ color }}
        >
          <CircleDot className="size-3" /> {field.options?.[0] ?? "Option"}
        </span>
      ) : (
        <span
          className="pointer-events-none select-none font-semibold text-[0.6rem] uppercase tracking-wide"
          style={{ color }}
        >
          {field.type}
        </span>
      )}
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
            className="absolute -right-2 -bottom-2 size-4 cursor-se-resize touch-none rounded-sm border-2 border-white shadow-sm"
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
