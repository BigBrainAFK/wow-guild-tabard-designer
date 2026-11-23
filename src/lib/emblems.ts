// Client-side helpers for tabard images: server URLs and tinted emblem sprite sheets.
import { EMBLEM_COLOR_HEX, FRONT_VIEW_VERSION, type Design } from "../../shared/tabard.ts";

/** The game's guild UI emblem sheet: 16x16 cells of 64 px. */
export const EMBLEM_SHEET_COLS = 16;
export const EMBLEM_CELL = 64;

/** Background position for one emblem cell in a sheet rendered at `scale`. */
export function emblemSpritePos(emblem: number, scale: number) {
  const x = (emblem % EMBLEM_SHEET_COLS) * EMBLEM_CELL * scale;
  const y = Math.floor(emblem / EMBLEM_SHEET_COLS) * EMBLEM_CELL * scale;
  return `-${x}px -${y}px`;
}

export function emblemSheetSize(scale: number) {
  const rows = EMBLEM_SHEET_COLS;
  return `${EMBLEM_SHEET_COLS * EMBLEM_CELL * scale}px ${rows * EMBLEM_CELL * scale}px`;
}

let whiteSheet: Promise<HTMLImageElement> | null = null;
const tinted = new Map<number, Promise<string>>();

function loadWhite() {
  whiteSheet ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      whiteSheet = null;
      reject(new Error("Emblem sheet unavailable"));
    };
    img.src = `/api/emblems/ui.webp?v=${FRONT_VIEW_VERSION}`;
  });
  return whiteSheet;
}

/**
 * The UI emblem sheet in one of the 17 emblem colors. Like the game, the white artwork is tinted; the tint is the
 * color's on-fabric average, brightened so that the white emblem color (14) maps to white.
 */
export function tintedEmblemSheet(color: number): Promise<string> {
  let p = tinted.get(color);
  if (!p) {
    p = loadWhite().then((img) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      {
        const hex = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
        const base = EMBLEM_COLOR_HEX[14];
        const target = EMBLEM_COLOR_HEX[color];
        const ch = [0, 2, 4].map((i) => Math.min(255, Math.round((hex(target, i) * 255) / hex(base, i))));
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = `rgb(${ch.join(",")})`;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(img, 0, 0);
      }
      return new Promise<string>((resolve) =>
        c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : img.src), "image/png"),
      );
    });
    tinted.set(color, p);
  }
  return p;
}
