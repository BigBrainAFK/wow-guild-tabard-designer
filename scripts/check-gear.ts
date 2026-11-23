// Checks that every gear preset's item displays exist in its version's Wowhead data set (fetches only metadata).
// With --fix, chest pieces that Wowhead files as robes (slot 20) are rewritten in src/data/gearData.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZamMirror } from "../server/zam.ts";
import { VERSIONS, classesFor, gearFor, racesFor, CLASSES } from "../src/data/characters.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mirror = new ZamMirror(resolve(ROOT, process.env.MODEL_DIR ?? "data/zam"));
const fix = process.argv.includes("--fix");
const exists = async (env: string, slot: number, display: number) =>
  (await mirror.get(`modelviewer/${env}/meta/armor/${slot}/${display}.json`)).status === 200;

const robes = new Set<number>();
let bad = 0;
for (const v of VERSIONS) {
  const classes = new Set(racesFor(v).flatMap((r) => classesFor(v, r)));
  const problems: string[] = [];
  let total = 0;
  for (const cls of classes)
    for (const level of ["mid", "end"] as const) {
      const g = gearFor(v, cls, level);
      const name = CLASSES.find((c) => c.id === cls)?.name;
      if (!g) { problems.push(`${name} ${level}: no preset`); continue; }
      const missing: number[] = [];
      for (const [slot, display] of g.items) {
        total++;
        if (await exists(v.env, slot, display)) continue;
        if (slot === 5 && (await exists(v.env, 20, display))) { robes.add(display); problems.push(`${name} ${level}: robe ${display} listed as chest`); continue; }
        missing.push(slot);
      }
      if (missing.length) problems.push(`${name} ${level} (${g.name}): slots ${missing.join(",")} missing`);
    }
  bad += problems.length;
  console.log(`${v.name}: ${total} pieces, ${problems.length ? problems.length + " problems" : "all present"}`);
  for (const p of problems) console.log("   " + p);
}
console.log(`${robes.size} chest pieces are robes (slot 20)`);
if (fix && robes.size) {
  const file = resolve(ROOT, "src/data/gearData.ts");
  let src = readFileSync(file, "utf8");
  for (const d of robes) src = src.replaceAll(`[5,${d}]`, `[20,${d}]`);
  writeFileSync(file, src);
  console.log("Rewrote robes as slot 20 in src/data/gearData.ts");
}
process.exit(bad ? 1 : 0);
