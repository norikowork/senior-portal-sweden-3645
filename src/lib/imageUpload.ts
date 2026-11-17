/**
 * Phone photos are often 5–15 MB and carry EXIF data (GPS position, camera serial). The public
 * original stays reachable without ?w=, so every photo is redrawn to at most MAX_EDGE px and saved
 * as JPEG before upload; redrawing drops all metadata. Kliv then serves resized WebP copies via ?w=.
 */
const MAX_EDGE = 2560;
const QUALITY = 0.85;

/** Largest file accepted from the picker, before shrinking. */
export const MAX_PICK_BYTES = 30 * 1024 * 1024;

export async function optimizeImage(file: File): Promise<File> {
  // GIF/SVG would lose animation or vectors; leave them alone.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black, as JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "bild";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    // Formats the browser can't decode (e.g. HEIC outside Safari) are uploaded as they are.
    return file;
  }
}
