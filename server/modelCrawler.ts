// Finds every model viewer file a character (default look) or an item display needs, by following the references in
// Wowhead's metadata JSON and in the chunked M2 / skel files, and downloads them into the local mirror.
import type { ZamMirror } from "./zam.ts";

type Kind = "m2" | "skin" | "skel" | "bone" | "textures";
const EXT: Record<Kind, string> = { m2: ".m2", skin: ".skin", skel: ".skel", bone: ".bone", textures: ".webp" };

/** Reads the chunks of a chunked file (MD21 models, .skel files): 4-byte id + 4-byte size + payload. */
function* chunks(buf: Buffer): Generator<[string, Buffer]> {
  for (let pos = 0; pos + 8 <= buf.length; ) {
    const id = buf.toString("latin1", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    yield [id, buf.subarray(pos + 8, pos + 8 + size)];
    pos += 8 + size;
  }
}

const u32s = (b: Buffer) => Array.from({ length: b.length >> 2 }, (_, i) => b.readUInt32LE(i * 4)).filter((x) => x > 0);

/** Files referenced by a model (skins, skeleton, bones, built-in textures). */
function m2Refs(buf: Buffer): [Kind, number][] {
  const out: [Kind, number][] = [];
  if (buf.toString("latin1", 0, 4) !== "MD21") return out;
  for (const [id, data] of chunks(buf)) {
    if (id === "SFID") for (const f of u32s(data)) out.push(["skin", f]);
    else if (id === "TXID") for (const f of u32s(data)) out.push(["textures", f]);
    else if (id === "SKID") for (const f of u32s(data)) out.push(["skel", f]);
    else if (id === "BFID") for (const f of u32s(data)) out.push(["bone", f]);
  }
  return out;
}

/** Files referenced by a skeleton (its parent skeleton and bone files). */
function skelRefs(buf: Buffer): [Kind, number][] {
  const out: [Kind, number][] = [];
  for (const [id, data] of chunks(buf)) {
    if (id === "SKPD" && data.length >= 8) {
      const parent = data.readUInt32LE(4);
      if (parent) out.push(["skel", parent]);
    } else if (id === "BFID") for (const f of u32s(data)) out.push(["bone", f]);
  }
  return out;
}

type FileEntry = { FileDataId: number };
type Meta = {
  Model?: number;
  Textures?: Record<string, number> | null;
  Textures2?: Record<string, number> | null;
  TextureFiles?: Record<string, FileEntry[]> | null;
  ModelFiles?: Record<string, FileEntry[]> | null;
};

/** Files referenced by item / character metadata: every model and texture variant it lists. */
function metaRefs(meta: Meta): [Kind, number][] {
  const out: [Kind, number][] = [];
  if (meta.Model) out.push(["m2", meta.Model]);
  for (const t of [meta.Textures, meta.Textures2]) for (const f of Object.values(t ?? {})) if (f) out.push(["textures", f]);
  for (const list of Object.values(meta.TextureFiles ?? {})) for (const e of list) if (e.FileDataId) out.push(["textures", e.FileDataId]);
  for (const list of Object.values(meta.ModelFiles ?? {})) for (const e of list) if (e.FileDataId) out.push(["m2", e.FileDataId]);
  return out;
}

type Customization = {
  Options: { Choices: { Elements: { Material: { MaterialResourcesID: number } | null; SkinnedModel: { CollectionsFileDataID?: number } | null }[] }[] }[];
  TextureFiles: Record<string, FileEntry[]>;
};

/** Files for a character's default look: the first choice of every customization option. */
function customizationRefs(c: Customization): [Kind, number][] {
  const out: [Kind, number][] = [];
  for (const option of c.Options ?? []) {
    const choice = option.Choices?.[0];
    for (const el of choice?.Elements ?? []) {
      const res = el.Material?.MaterialResourcesID;
      if (res) for (const e of c.TextureFiles?.[res] ?? []) if (e.FileDataId) out.push(["textures", e.FileDataId]);
      const model = el.SkinnedModel?.CollectionsFileDataID;
      if (model) out.push(["m2", model]);
    }
  }
  return out;
}

export type CrawlStats = { files: number; downloaded: number; bytes: number; missing: number };

export class ModelCrawler {
  private seen = new Set<string>();
  private queue: string[] = [];
  readonly stats: CrawlStats = { files: 0, downloaded: 0, bytes: 0, missing: 0 };
  private mirror: ZamMirror;
  private concurrency: number;
  private background: boolean;

  /** background: pause whenever the server is answering live requests (for prefetching inside the server). */
  constructor(mirror: ZamMirror, concurrency = 6, background = false) {
    this.mirror = mirror;
    this.concurrency = concurrency;
    this.background = background;
  }

  private add(path: string) {
    if (this.seen.has(path)) return;
    this.seen.add(path);
    this.queue.push(path);
  }

  private addRef(env: string, [kind, id]: [Kind, number]) {
    this.add(`modelviewer/${env}/${kind}/${id}${EXT[kind]}`);
  }

  /** A character model with its default look. */
  character(env: string, chrModelId: number) {
    this.add(`modelviewer/${env}/meta/character/${chrModelId}.json`);
    this.add(`modelviewer/${env}/meta/charactercustomization/${chrModelId}.json`);
  }

  /** An item display (all race/gender variants of its models and textures). */
  item(env: string, slot: number, displayId: number) {
    this.add(`modelviewer/${env}/meta/armor/${slot}/${displayId}.json`);
  }

  /** Any other file, e.g. the viewer script. */
  file(path: string) {
    this.add(path);
  }

  private async visit(path: string) {
    const r = await this.mirror.get(path);
    this.stats.files++;
    if (r.status !== 200) {
      this.stats.missing++;
      return;
    }
    if (!r.local) {
      this.stats.downloaded++;
      this.stats.bytes += r.body.length;
    }
    const env = path.split("/")[1];
    let refs: [Kind, number][] = [];
    try {
      if (path.includes("/meta/charactercustomization/")) refs = customizationRefs(JSON.parse(r.body.toString("utf8")));
      else if (path.endsWith(".json")) refs = metaRefs(JSON.parse(r.body.toString("utf8")));
      else if (path.endsWith(".m2")) refs = m2Refs(r.body);
      else if (path.endsWith(".skel")) refs = skelRefs(r.body);
    } catch {
      /* not a format we follow */
    }
    for (const ref of refs) this.addRef(env, ref);
  }

  private running: Promise<CrawlStats> | null = null;

  /** Starts downloading what's queued unless already running (used for background prefetching). */
  kick() {
    this.running ??= this.run().finally(() => {
      this.running = null;
      if (this.queue.length) this.kick();
    });
    return this.running;
  }

  /** Downloads everything queued (and everything it references). */
  async run(onProgress?: (s: CrawlStats, queued: number) => void) {
    let last = 0;
    const worker = async () => {
      for (let path = this.queue.shift(); path !== undefined; path = this.queue.shift()) {
        if (this.background) await this.mirror.whenIdle();
        await this.visit(path).catch(() => this.stats.missing++);
        // Give other work (live requests in the server) a turn between files.
        await new Promise((r) => setImmediate(r));
        if (onProgress && Date.now() - last > 2000) {
          last = Date.now();
          onProgress(this.stats, this.queue.length);
        }
      }
    };
    // Workers exit when the queue is momentarily empty, so loop until nothing new was queued.
    while (this.queue.length) await Promise.all(Array.from({ length: this.concurrency }, worker));
    return this.stats;
  }
}
