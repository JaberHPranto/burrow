import type { Box } from "./geometry";

/** Decode PNG/JPEG bytes into a ready-to-draw image element. */
export async function decodeImage(bytes: Uint8Array): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Crop a region (image pixels) out of an image and encode it as PNG bytes. */
export async function cropToPng(image: CanvasImageSource, box: Box): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.w));
  canvas.height = Math.max(1, Math.round(box.h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't encode PNG");
  return new Uint8Array(await blob.arrayBuffer());
}
