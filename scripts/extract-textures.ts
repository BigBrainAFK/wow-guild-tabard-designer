// Builds the portable texture pack from a local WoW install: every guild tabard texture (all emblems, borders and
// backgrounds in every color and tier) plus the guild UI emblem sheet, as WebP files in TEXTURE_DIR (default
// data/textures, about 80 MB). Copy that folder to a server without a WoW install. Re-running skips existing files.
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SEAM_PATCH_FILES, TabardService } from "../server/tabardService.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const textureDir = resolve(ROOT, process.env.TEXTURE_DIR ?? "data/textures");
const service = new TabardService({
  wowPath: process.env.WOW_PATH ?? "",
  product: process.env.WOW_PRODUCT ?? "wowf",
  cacheDir: resolve(ROOT, process.env.CACHE_DIR ?? ".cache"),
  textureDir,
});

const status = await service.status();
if (!status.ok || status.source !== "install") {
  console.error("No WoW install found. Set WOW_PATH (and WOW_PRODUCT) in .env");
  process.exit(1);
}
console.log(`Reading ${status.product} ${status.version} -> ${textureDir}`);

await service.exportUiSheet();
// The emblems with seam patches are always rewritten, so packs built before that cleanup get fixed.
const seam = new Set(SEAM_PATCH_FILES);
const ids = service.packFiles().filter((id) => seam.has(id) || !existsSync(join(textureDir, `${id}.webp`)));
console.log(`${ids.length} textures to write (${service.packFiles().length - ids.length} already in the pack)`);

let done = 0;
let failed = 0;
const started = Date.now();
const queue = [...ids];
await Promise.all(
  Array.from({ length: 12 }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await service.exportTexture(id);
      } catch (e) {
        failed++;
        console.warn(`  ${id}: ${(e as Error).message}`);
      }
      if (++done % 250 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  ${done}/${ids.length} (${Math.round((ids.length - done) / rate)} s left)`);
      }
    }
  }),
);

const bytes = readdirSync(textureDir).reduce((n, f) => n + statSync(join(textureDir, f)).size, 0);
console.log(`Done: ${done - failed} written, ${failed} failed. Pack size ${(bytes / 1048576).toFixed(1)} MB`);
