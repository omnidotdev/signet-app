import { Loader2 } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useState } from "react";

/**
 * Render a PDF to page images with pdf.js, so the preview looks the same in
 * every browser (an inline `<iframe>` PDF renders inconsistently and often not
 * at all on mobile). Falls back to a plain link if rendering fails.
 */
const PdfViewer = ({ url, label }: { url: string; label: string }) => {
  const [pages, setPages] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const pdf = await pdfjs.getDocument({ url }).promise;
        const out: string[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 1.3 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          out.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) {
          setPages(out);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state === "loading")
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading the document.
      </div>
    );

  if (state === "error")
    return (
      <div className="px-5 py-12 text-center text-muted-foreground text-sm">
        Could not render a preview here.{" "}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          Open the document
        </a>
      </div>
    );

  return (
    <div className="max-h-[44rem] space-y-3 overflow-y-auto bg-muted/40 p-3">
      {pages.map((src, i) => (
        <img
          // biome-ignore lint/suspicious/noArrayIndexKey: pages are a fixed ordered list
          key={i}
          src={src}
          alt={`${label}, page ${i + 1}`}
          className="mx-auto block w-full max-w-full rounded border border-border shadow-sm"
        />
      ))}
    </div>
  );
};

export default PdfViewer;
