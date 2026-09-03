/**
 * pdf.js setup, in one place.
 *
 * The worker is imported as a URL rather than bundled into the main chunk:
 * parsing and rasterising a 600-page dossier on the UI thread would freeze
 * scrolling, and the worker build is large enough that it should not be part
 * of the initial download either.
 */

import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

/** Rendering wider than this is wasted pixels on any screen we target. */
export const MAX_PAGE_WIDTH = 1100;

/**
 * Loads a PDF from a signed URL.
 *
 * `withCredentials` because the local storage driver serves objects from a
 * route on our own API, which still checks the session cookie — the signature
 * on the URL bounds its lifetime, it doesn't replace authentication.
 */
export function loadPdf(url: string): { promise: Promise<PDFDocumentProxy>; cancel: () => void } {
  const task = getDocument({ url, withCredentials: true });
  return {
    promise: task.promise,
    cancel: () => void task.destroy().catch(() => undefined),
  };
}

export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
