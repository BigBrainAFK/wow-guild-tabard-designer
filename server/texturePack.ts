// Portable texture pack: the game's tabard textures as WebP files, so a server without a WoW install can run.
// Built by `npm run extract` on a machine that has the game installed; copy the folder to the server.
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { Rgba } from "./image.ts";

/** The guild UI emblem sheet inside the pack. */
export const UI_SHEET_NAME = "ui-emblems";

const file = (dir: string, name: string | number) => join(dir, `${name}.webp`);

export function hasPackTexture(dir: string, name: string | number) {
  return existsSync(file(dir, name));
}

export async function readPackTexture(dir: string, name: string | number): Promise<Rgba> {
  const { data, info } = await sharp(file(dir, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

/**
 * Lossy RGB (quality 90) with lossless alpha: about 11 KB per tabard texture and within 2-3 levels of the game's
 * own (DXT-compressed) textures. `lossless` is for artwork where exact edges matter, like the UI emblem sheet.
 */
export function encodeWebp(img: Rgba, lossless = false): Promise<Buffer> {
  const raw = { raw: { width: img.width, height: img.height, channels: 4 as const } };
  const webp = lossless ? { lossless: true, effort: 6 } : { quality: 90, alphaQuality: 100, effort: 6 };
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), raw).webp(webp).toBuffer();
}

export async function writePackTexture(dir: string, name: string | number, img: Rgba, lossless = false) {
  mkdirSync(dir, { recursive: true });
  await writeFile(file(dir, name), await encodeWebp(img, lossless));
}
