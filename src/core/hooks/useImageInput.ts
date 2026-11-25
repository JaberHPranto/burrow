import { useEffect } from "react";

/**
 * Accept images pasted anywhere in the window (Ctrl+V) or dropped on it.
 * Shared by image tools (palette, and later OCR).
 */
export function useImageInput(onImage: (file: File) => void) {
  useEffect(() => {
    const isImage = (file: File | null): file is File => !!file?.type.startsWith("image/");
    const fromItems = (items: DataTransferItemList | undefined) =>
      Array.from(items ?? [])
        .map((item) => (item.kind === "file" ? item.getAsFile() : null))
        .find(isImage) ?? null;
    const fromFiles = (files: FileList | undefined) =>
      Array.from(files ?? []).find(isImage) ?? null;

    const onPaste = (e: ClipboardEvent) => {
      const file = fromItems(e.clipboardData?.items);
      if (file) {
        e.preventDefault();
        onImage(file);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = fromFiles(e.dataTransfer?.files);
      if (file) onImage(file);
    };

    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [onImage]);
}

/** Decode an image file and return downscaled RGBA pixels (fast to analyse). */
export async function readImagePixels(
  file: Blob,
  maxSide = 160,
): Promise<{ pixels: Uint8ClampedArray; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(img, 0, 0, w, h);
  return { pixels: ctx.getImageData(0, 0, w, h).data, url };
}
