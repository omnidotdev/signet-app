import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  PdfPageSurface,
  ViewerControls,
  pageBoxStyle,
  usePdfDocument,
} from "./PdfPages";

/**
 * Show a PDF with pdf.js, so it looks the same in every browser (an inline
 * `<iframe>` PDF renders inconsistently and often not at all on mobile): sharp
 * pages that render as they near the screen, text that can be found with the
 * browser's find and selected, and zoom. Falls back to a plain link if the
 * document cannot be read.
 */
const PdfViewer = ({ url, label }: { url: string; label: string }) => {
  const { pdf, pages, error } = usePdfDocument(url);
  const [zoom, setZoom] = useState(1);
  const docRef = useRef<HTMLDivElement>(null);

  if (error)
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

  if (!pdf || pages.length === 0)
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading the document.
      </div>
    );

  return (
    <>
      <section
        ref={docRef}
        aria-label={label}
        className="space-y-3 overflow-x-auto bg-muted/40 p-3"
      >
        {pages.map((pg, i) => {
          const pageNo = i + 1;
          return (
            <div
              key={pageNo}
              data-page={pageNo}
              className="relative mx-auto rounded border border-border shadow-sm"
              style={pageBoxStyle(pg, zoom)}
            >
              <PdfPageSurface pdf={pdf} pageNumber={pageNo} page={pg} />
            </div>
          );
        })}
      </section>
      <ViewerControls
        containerRef={docRef}
        pageCount={pages.length}
        zoom={zoom}
        onZoom={setZoom}
      />
    </>
  );
};

export default PdfViewer;
