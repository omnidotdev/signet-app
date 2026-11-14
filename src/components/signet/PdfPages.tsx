import { Minus, Plus } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/** A page's size in PDF points and at the viewer's base display scale */
export interface PdfPageInfo {
  widthPt: number;
  heightPt: number;
  /** CSS px at 100% zoom */
  width: number;
  height: number;
}

/**
 * CSS px per PDF point at 100% zoom: a Letter page shows about 980px wide, the
 * size reading documents usually opens at on a desktop
 */
const VIEW_SCALE = 1.6;

/** Zoom steps offered by the viewer controls; 1 fits the page to the column */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Load a PDF and measure its pages. The pages themselves render lazily in
 * `PdfPageSurface`, so a long contract opens as soon as its sizes are known
 * instead of after every page has been painted.
 */
export const usePdfDocument = (source: Uint8Array | string | null) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PdfPageInfo[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setError(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        // pdf.js detaches the buffer it is given, so hand it a copy
        const loading = pdfjs.getDocument(
          typeof source === "string"
            ? { url: source }
            : { data: source.slice() },
        );
        task = loading;
        const doc = await loading.promise;
        const out: PdfPageInfo[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const vp = (await doc.getPage(p)).getViewport({ scale: 1 });
          out.push({
            widthPt: vp.width,
            heightPt: vp.height,
            width: vp.width * VIEW_SCALE,
            height: vp.height * VIEW_SCALE,
          });
        }
        if (cancelled) return;
        setPdf(doc);
        setPages(out);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      // close the document and its worker side once the view moves on
      void task?.destroy();
    };
  }, [source]);

  return { pdf, pages, error };
};

/**
 * The box a page occupies at a zoom level: at 100% or less it fits the column
 * (never wider than the base size); above, it grows past the column and the
 * document scrolls sideways, as in any PDF reader
 */
export const pageBoxStyle = (
  page: PdfPageInfo,
  zoom: number,
): React.CSSProperties => ({
  width: page.width * zoom,
  maxWidth: zoom <= 1 ? "100%" : undefined,
  aspectRatio: `${page.width} / ${page.height}`,
});

/**
 * One page, drawn to fill its (relatively positioned) parent: a canvas painted
 * at the box's real pixel size (sharp at any zoom or screen density, and only
 * once the page nears the screen) under a pdf.js text layer, so the document's
 * text can be found with the browser's find (Ctrl/Cmd+F) and selected. Callers
 * that use the page as a pointer surface (the field editor) pass
 * `selectableText={false}`; the text still searches, it just ignores clicks.
 */
export const PdfPageSurface = ({
  pdf,
  pageNumber,
  page,
  selectableText = true,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  page: PdfPageInfo;
  selectableText?: boolean;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [widthPx, setWidthPx] = useState(0);

  // track the box's size (zoom, window) and whether it is near the screen
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const resize = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      // the text layer sizes and places every glyph from this one variable
      host.style.setProperty("--total-scale-factor", String(w / page.widthPt));
      setWidthPx(w);
    });
    resize.observe(host);
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "1200px 0px" },
    );
    seen.observe(host);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, [page.widthPt]);

  // the text layer is laid out once, in points; CSS scales it with the box, so
  // every page is searchable from the start
  useEffect(() => {
    const container = textRef.current;
    if (!container) return;
    let cancelled = false;
    let layer: { cancel: () => void } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const pdfPage = await pdf.getPage(pageNumber);
        if (cancelled) return;
        container.replaceChildren();
        const textLayer = new pdfjs.TextLayer({
          textContentSource: pdfPage.streamTextContent(),
          container,
          viewport: pdfPage.getViewport({ scale: 1 }),
        });
        layer = textLayer;
        await textLayer.render();
      } catch {
        // a page without extractable text simply is not searchable
      }
    })();
    return () => {
      cancelled = true;
      layer?.cancel();
    };
  }, [pdf, pageNumber]);

  // paint (or repaint after a resize) once the page is near the screen, at the
  // box's device-pixel size so text stays crisp
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!near || !canvas || widthPx === 0) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    // settle on a size before painting, so dragging a window edge or stepping
    // the zoom does not queue a paint per frame
    const timer = setTimeout(async () => {
      try {
        const pdfPage = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const viewport = pdfPage.getViewport({
          scale: (widthPx / page.widthPt) * dpr,
        });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        task = pdfPage.render({ canvas, canvasContext: ctx, viewport });
        await task.promise;
      } catch {
        // cancelled by a newer paint, or the document was closed
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [near, widthPx, pdf, pageNumber, page.widthPt]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 overflow-hidden bg-white"
      style={
        {
          "--scale-round-x": "1px",
          "--scale-round-y": "1px",
        } as React.CSSProperties
      }
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
      <div
        ref={textRef}
        className={`textLayer ${selectableText ? "" : "pointer-events-none"}`}
      />
    </div>
  );
};

/**
 * Zoom and page position for a document view, floating at the bottom right of
 * the screen. The current page is the one nearest the middle of the screen,
 * read from the `data-page` boxes under `containerRef`.
 */
export const ViewerControls = ({
  containerRef,
  pageCount,
  zoom,
  onZoom,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  pageCount: number;
  zoom: number;
  onZoom: (zoom: number) => void;
}) => {
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || pageCount === 0) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      let best = 1;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const el of root.querySelectorAll<HTMLElement>("[data-page]")) {
        const r = el.getBoundingClientRect();
        const dist =
          r.top <= mid && r.bottom >= mid
            ? 0
            : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (dist < bestDist) {
          bestDist = dist;
          best = Number(el.dataset.page) || 1;
        }
      }
      setCurrent(best);
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
  }, [containerRef, pageCount]);

  const step = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.indexOf(zoom);
    const next =
      ZOOM_STEPS[Math.min(Math.max(i + dir, 0), ZOOM_STEPS.length - 1)];
    if (next !== undefined) onZoom(next);
  };

  if (pageCount === 0) return null;
  return (
    <div className="fixed right-4 bottom-6 z-20 flex items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1 text-sm shadow-lg backdrop-blur">
      <span className="px-2 text-muted-foreground tabular-nums">
        Page {current} of {pageCount}
      </span>
      <span aria-hidden className="h-4 w-px bg-border" />
      <button
        type="button"
        aria-label="Zoom out"
        disabled={zoom === ZOOM_STEPS[0]}
        onClick={() => step(-1)}
        className="rounded-full p-1.5 hover:bg-muted disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Fit page to width"
        onClick={() => onZoom(1)}
        className="min-w-12 rounded-full px-1.5 py-1 tabular-nums hover:bg-muted"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={zoom === ZOOM_STEPS.at(-1)}
        onClick={() => step(1)}
        className="rounded-full p-1.5 hover:bg-muted disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
};

/** Decode base64 PDF bytes once per distinct payload */
export const usePdfBytes = (base64: string | null | undefined) =>
  useMemo(() => {
    if (!base64) return null;
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }, [base64]);
