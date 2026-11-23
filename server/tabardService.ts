// The game's guild tabard layer textures, prepared for the browser (which composites the tabard itself). Source: a
// local WoW install (read via CASC, with Blizzard's CDN for files the install streams on demand) or, on servers
// without one, the WebP texture pack.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Casc, openCasc } from "./casc.ts";
import { UI_SHEET_NAME, encodeWebp, hasPackTexture, readPackTexture, writePackTexture } from "./texturePack.ts";
import { createImage, decodeBLP, type Rgba } from "./image.ts";
import { BACKGROUND_BASE, BACKGROUNDS, EMBLEM_BASE, EMBLEM_COLORS, allTabardFiles } from "../shared/tabard.ts";

/**
 * A few emblem textures carry a flat, outline-less grey block on the front center line above the emblem (in every
 * color), which the game's own UI artwork for those emblems doesn't have. Rect is in upper-texture pixels of the
 * 512x256 texture; sample is a pixel inside the block whose color identifies it (without one, the whole rect is cleared).
 */
const SEAM_PATCHES: { emblem: number; rect: [number, number, number, number]; sample?: [number, number] }[] = [
  { emblem: 7, rect: [0, 168, 30, 202], sample: [4, 178] }, // #8 diamond
  { emblem: 11, rect: [0, 168, 26, 190], sample: [3, 176] }, // #12 crown
  { emblem: 125, rect: [0, 174, 18, 197] }, // #126 rook: the block sits apart from the art, so all of it goes
];

/** File IDs of the emblem textures the seam cleanup changes (upper halves, every color). */
export const SEAM_PATCH_FILES = SEAM_PATCHES.flatMap((p) =>
  Array.from({ length: EMBLEM_COLORS }, (_, c) => EMBLEM_BASE[p.emblem] + 2 * c + 1),
);

/** Clears the patch pixels (those close to the sampled patch color) inside the rect; the emblem art stays. */
function cleanSeamPatch(fileDataId: number, img: Rgba): Rgba {
  const patch = SEAM_PATCHES.find((p) => {
    const offset = fileDataId - EMBLEM_BASE[p.emblem];
    return offset >= 0 && offset < 2 * EMBLEM_COLORS && offset % 2 === 1;
  });
  if (!patch) return img;
  const sx = img.width / 512;
  const sy = img.height / 256;
  const at = (x: number, y: number) => (Math.round(y * sy) * img.width + Math.round(x * sx)) * 4;
  const s = patch.sample ? at(...patch.sample) : -1;
  const ref = s >= 0 ? [img.data[s], img.data[s + 1], img.data[s + 2]] : null;
  const out = { ...img, data: img.data.slice() };
  const [x0, y0, x1, y1] = patch.rect;
  for (let y = Math.round(y0 * sy); y < Math.round(y1 * sy); y++)
    for (let x = Math.round(x0 * sx); x < Math.round(x1 * sx); x++) {
      const o = (y * img.width + x) * 4;
      const close = !ref || [0, 1, 2].every((c) => Math.abs(out.data[o + c] - ref[c]) <= 24);
      if (close) out.data[o + 3] = 0;
    }
  return out;
}

/** Least-recently-used memory cache limited by total bytes, with one shared in-flight promise per key. */
class ByteCache<V> {
  private map = new Map<string, { value: V; bytes: number }>();
  private inflight = new Map<string, Promise<V>>();
  private bytes = 0;
  private maxBytes: number;
  private size: (v: V) => number;

  constructor(maxBytes: number, size: (v: V) => number) {
    this.maxBytes = maxBytes;
    this.size = size;
  }

  get(key: string, make: () => Promise<V>): Promise<V> {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return Promise.resolve(hit.value);
    }
    let p = this.inflight.get(key);
    if (!p) {
      p = make()
        .then((value) => {
          this.set(key, value);
          return value;
        })
        .finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  private set(key: string, value: V) {
    const bytes = this.size(value);
    if (bytes > this.maxBytes / 4) return; // never let one entry push out most of the cache
    this.map.set(key, { value, bytes });
    this.bytes += bytes;
    for (const [k, v] of this.map) {
      if (this.bytes <= this.maxBytes) break;
      this.map.delete(k);
      this.bytes -= v.bytes;
    }
  }
}

const UI_EMBLEM_SHEET_PATH = "Interface/GuildFrame/GuildEmblemsLG_01.blp";
const UI_EMBLEM_SHEET_FDID = 459023;

/** Only these file IDs are ever read (all guild tabard textures), whatever a request asks for. */
const TABARD_FILES = new Set(allTabardFiles());

export class TabardService {
  private casc: Promise<Casc | null>;
  /** WebP files served to browsers when they come from the install (pack files are served as they are). */
  private webp = new ByteCache<Buffer>(64 * 1024 * 1024, (b) => b.length);
  readonly textureDir: string;

  constructor(opts: { wowPath?: string; product?: string; cacheDir: string; textureDir: string }) {
    this.textureDir = opts.textureDir;
    const casc = opts.wowPath
      ? openCasc({ wowPath: opts.wowPath, product: opts.product, cacheDir: opts.cacheDir })
      : Promise.resolve(null);
    this.casc = casc.catch((e) => {
      console.error("[tabard] Could not open the WoW install:", e);
      return null;
    });
  }

  async status() {
    const casc = await this.casc;
    if (casc) return { ok: true, source: "install", product: casc.product, version: casc.version };
    if (hasPackTexture(this.textureDir, UI_SHEET_NAME)) return { ok: true, source: "pack", dir: this.textureDir };
    return { ok: false };
  }

  isTabardFile(fileDataId: number) {
    return TABARD_FILES.has(fileDataId);
  }

  /** A raw game texture from the install (BLP decoded). */
  private async fromInstall(fileDataId: number): Promise<Rgba | null> {
    const casc = await this.casc;
    return casc ? decodeBLP(await casc.read(fileDataId)) : null;
  }

  /**
   * A layer as the browser should draw it: backgrounds as they are; emblems and borders without Blizzard's
   * alpha-less placeholder layers (e.g. the lower half of emblem 49) and without the seam patches.
   */
  async prepared(fileDataId: number): Promise<Rgba> {
    const img = (await this.fromInstall(fileDataId)) ?? (await readPackTexture(this.textureDir, fileDataId));
    const isBackground = BACKGROUND_BASE.some((b) => fileDataId >= b && fileDataId < b + 2 * BACKGROUNDS);
    if (isBackground) return img;
    if (img.hasAlpha === false) return createImage(img.width, img.height);
    return cleanSeamPatch(fileDataId, img);
  }

  /** The WebP for /api/layer/: the pack file itself when there's no install, else encoded once from the install. */
  async layerWebp(fileDataId: number): Promise<Buffer> {
    if (!TABARD_FILES.has(fileDataId)) throw new Error(`Not a tabard texture: ${fileDataId}`);
    if (!(await this.casc)) return readFile(join(this.textureDir, `${fileDataId}.webp`));
    return this.webp.get(String(fileDataId), async () => encodeWebp(await this.prepared(fileDataId)));
  }

  /**
   * The game's guild UI emblem sheet (Interface/GuildFrame/GuildEmblemsLG_01): 196 white emblems in a 16x16 grid of
   * 64 px cells, which the game tints to the emblem color. Used for the emblem picker.
   */
  async uiEmblemSheetWebp(): Promise<Buffer> {
    const casc = await this.casc;
    if (!casc) return readFile(join(this.textureDir, `${UI_SHEET_NAME}.webp`));
    return this.webp.get(UI_SHEET_NAME, async () => {
      const id = casc.findFileDataId(UI_EMBLEM_SHEET_PATH) ?? UI_EMBLEM_SHEET_FDID;
      return encodeWebp(decodeBLP(await casc.read(id)), true);
    });
  }

  /** Writes one texture into the pack, prepared as the browser draws it. Needs the WoW install. */
  async exportTexture(fileDataId: number) {
    if (!(await this.casc)) throw new Error("A WoW install is needed to build the texture pack (set WOW_PATH)");
    await writePackTexture(this.textureDir, fileDataId, await this.prepared(fileDataId));
  }

  /** Writes the guild UI emblem sheet into the pack (lossless). Needs the WoW install. */
  async exportUiSheet() {
    const casc = await this.casc;
    if (!casc) throw new Error("A WoW install is needed to build the texture pack (set WOW_PATH)");
    const img = decodeBLP(await casc.read(casc.findFileDataId(UI_EMBLEM_SHEET_PATH) ?? UI_EMBLEM_SHEET_FDID));
    await writePackTexture(this.textureDir, UI_SHEET_NAME, img, true);
  }

  /** Every texture the pack holds: all emblems, borders and backgrounds in every color and tier. */
  packFiles(): number[] {
    return allTabardFiles();
  }
}
