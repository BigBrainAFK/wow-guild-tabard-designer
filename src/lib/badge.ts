// Forum badge in the style of guild-tabard-creator.netlify.app: faction ring, tinted banner, hooks, emblem, tinted
// border, stacked on a 250x250 canvas with the same offsets. Ring, banner, hooks and border images are theirs
// (public/badge); the emblem is the game's own artwork, rendered in the browser (renderEmblem).
import { BACKGROUND_COLOR_HEX, BORDER_COLOR_HEX, type Design } from "../../shared/tabard.ts";
import type { Faction } from "../data/characters.ts";
import { renderEmblem } from "./tabardRender.ts";

export const BADGE_SIZE = 250;

const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

/** Multiplies a (grey) image by a color, keeping its alpha - the same tint their site applies. */
function tint(img: HTMLImageElement, hex: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = `#${hex}`;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(img, 0, 0);
  return c;
}

/** Their emblem slot is 125x125 at (55, 75); the emblem art sits inside it with some margin. */
const EMBLEM_SLOT = { x: 55, y: 75, size: 125, art: 96 };

export async function renderBadge(canvas: HTMLCanvasElement, d: Design, faction: Faction): Promise<void> {
  // Tiered tabards use one ornate border in game; there's no badge art for it, so they show their border style.
  const border = Math.min(d.border, 5);
  const [ring, banner, hooks, trim, emblem] = await Promise.all([
    loadImage(`/badge/ring-${faction}.png`),
    loadImage("/badge/bg_00.png"),
    loadImage("/badge/hooks.png"),
    loadImage(`/badge/borders/border_0${border}.png`),
    renderEmblem(d),
  ]);
  canvas.width = BADGE_SIZE;
  canvas.height = BADGE_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, BADGE_SIZE, BADGE_SIZE);
  ctx.drawImage(ring, 17, 17);
  ctx.drawImage(tint(banner, BACKGROUND_COLOR_HEX[d.background]), 37, 47);
  ctx.drawImage(hooks, 37, 49);
  const s = EMBLEM_SLOT;
  const fit = Math.min(s.art / emblem.width, s.art / emblem.height);
  const w = emblem.width * fit;
  const h = emblem.height * fit;
  ctx.drawImage(emblem, s.x + (s.size - w) / 2, s.y + (s.size - h) / 2, w, h);
  ctx.drawImage(tint(trim, BORDER_COLOR_HEX[d.borderColor]), 50, 60);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileSlug(name: string | undefined, fallback: string) {
  const s = (name ?? "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return s || fallback;
}
