// Tabard images, composited in the browser from the game's layer textures (served as WebP by /api/layer/).
// Everything the app shows or exports comes from here: the 3D model's tabard halves, the flat front view, border
// thumbnails, the badge emblem and the PNG exports.
import {
  FLAT_H,
  FLAT_W,
  FRONT_VIEW_VERSION,
  HALF_SIZE,
  emblemFile,
  layerFiles,
  packDesign,
  type Design,
  type Half,
} from "../../shared/tabard.ts";

type Canvas = HTMLCanvasElement;

function canvas(w: number, h: number): Canvas {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function context(c: Canvas) {
  const ctx = c.getContext("2d", { willReadFrequently: false })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

// ---- Layer textures -----------------------------------------------------------------------------------------

const layers = new Map<number, Promise<ImageBitmap>>();

/** One game texture layer (background, border or emblem half), decoded once. */
export function loadLayer(fileDataId: number): Promise<ImageBitmap> {
  let p = layers.get(fileDataId);
  if (!p) {
    p = fetch(`/api/layer/${fileDataId}.webp?v=${FRONT_VIEW_VERSION}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Texture ${fileDataId} unavailable (${r.status})`);
        return r.blob();
      })
      .then((b) => createImageBitmap(b));
    p.catch(() => layers.delete(fileDataId));
    layers.set(fileDataId, p);
    // ~7,000 layers exist; keep the most recent few hundred (a 512x256 bitmap is 512 KB of GPU/CPU memory).
    if (layers.size > 400) layers.delete(layers.keys().next().value!);
  }
  return p;
}

// ---- Compositing ----------------------------------------------------------------------------------------------

/** One half of the tabard exactly as the character model uses it: background, border, emblem. */
export async function renderHalf(d: Design, half: Half, files = layerFiles(d, half)): Promise<Canvas> {
  const [w, h] = HALF_SIZE[half];
  const c = canvas(w, h);
  const ctx = context(c);
  for (const img of await Promise.all(files.map(loadLayer))) ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/**
 * The 2D front view: the front half of each texture (x = 0 is the center line) mirrored into a full panel, upper
 * over lower, at FLAT_W x FLAT_H times `scale`.
 */
async function renderFrontFrom(upper: Canvas, lower: Canvas, scale: number): Promise<Canvas> {
  const W = FLAT_W * scale;
  const H = FLAT_H * scale;
  const c = canvas(W, H);
  const ctx = context(c);
  for (const [src, y, h] of [
    [upper, 0, (H * 2) / 3],
    [lower, (H * 2) / 3, H / 3],
  ] as const) {
    const sw = src.width / 2;
    ctx.drawImage(src, 0, 0, sw, src.height, W / 2, y, W / 2, h); // right of the center line
    ctx.save();
    ctx.translate(W / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0, sw, src.height, 0, y, W / 2, h); // mirrored to the left
    ctx.restore();
  }
  return c;
}

export async function renderFront(d: Design, scale = 1): Promise<Canvas> {
  const [u, l] = await Promise.all([renderHalf(d, "upper"), renderHalf(d, "lower")]);
  return renderFrontFrom(u, l, scale);
}

/** The emblem on its own (front view at 2x, transparent), cropped to its bounds: for the forum badge. */
export async function renderEmblem(d: Pick<Design, "emblem" | "emblemColor">): Promise<Canvas> {
  const base = { emblem: d.emblem, emblemColor: d.emblemColor, border: 0, borderColor: 0, background: 0, tier: 0 };
  const [u, l] = await Promise.all([
    renderHalf(base, "upper", [emblemFile(d.emblem, d.emblemColor, "upper")]),
    renderHalf(base, "lower", [emblemFile(d.emblem, d.emblemColor, "lower")]),
  ]);
  return trim(await renderFrontFrom(u, l, 2));
}

/** Crops away fully transparent margins. */
function trim(c: Canvas): Canvas {
  const { data, width, height } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return canvas(1, 1);
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext("2d")!.drawImage(c, -x0, -y0);
  return out;
}

export function toBlob(c: Canvas): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

// ---- Cached image URLs for <img> ---------------------------------------------------------------------------

const urls = new Map<string, Promise<string>>();

function cachedUrl(key: string, make: () => Promise<Canvas>): Promise<string> {
  let p = urls.get(key);
  if (!p) {
    p = make()
      .then(toBlob)
      .then((b) => URL.createObjectURL(b));
    p.catch(() => urls.delete(key));
    urls.set(key, p);
    if (urls.size > 300) {
      const [oldKey, old] = urls.entries().next().value!;
      urls.delete(oldKey);
      old.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    }
  }
  return p;
}

/** Blob URL of the flat front view of a design. */
export const frontUrl = (d: Design) => cachedUrl(`front-${packDesign(d)}`, () => renderFront(d));
