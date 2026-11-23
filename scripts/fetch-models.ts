// Downloads Wowhead's model viewer data into the local mirror (MODEL_DIR, default data/zam), so model loads never wait
// on the CDN: every playable race and gender (default look) and every gear preset, for every game version.
// Usage: npm run fetch-models [-- <version ids...>]   e.g. npm run fetch-models -- forever classic
// Files already in the mirror are skipped, so it can be re-run any time. Doesn't need a WoW install.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZamMirror } from "../server/zam.ts";
import { ModelCrawler } from "../server/modelCrawler.ts";
import { VERSIONS, classesFor, gearFor, racesFor } from "../src/data/characters.ts";
import { VIEWER_SCRIPT_PATH } from "../shared/viewer.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mirror = new ZamMirror(resolve(ROOT, process.env.MODEL_DIR ?? "data/zam"));
const wanted = process.argv.slice(2);
const versions = wanted.length ? VERSIONS.filter((v) => wanted.includes(v.id)) : VERSIONS;
if (!versions.length) {
  console.error(`Unknown version. Use any of: ${VERSIONS.map((v) => v.id).join(", ")}`);
  process.exit(1);
}

const crawler = new ModelCrawler(mirror, 6);
crawler.file(VIEWER_SCRIPT_PATH);
for (const v of versions) {
  const races = racesFor(v);
  const classes = new Set(races.flatMap((r) => classesFor(v, r)));
  for (const r of races) for (const id of new Set(r.models)) crawler.character(v.env, id);
  for (const cls of classes)
    for (const level of ["mid", "end"] as const)
      for (const [slot, display] of gearFor(v, cls, level)?.items ?? []) crawler.item(v.env, slot, display);
  console.log(`${v.name} (${v.env}): ${races.length} races, ${classes.size} classes`);
}

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
const stats = await crawler.run((s, queued) =>
  console.log(`  ${s.files} files checked, ${s.downloaded} downloaded (${mb(s.bytes)}), ${queued} queued`),
);
console.log(`Done: ${stats.files} files, ${stats.downloaded} downloaded (${mb(stats.bytes)}), ${stats.missing} not on the CDN`);
