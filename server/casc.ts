// Minimal read-only CASC reader for a local World of Warcraft install.
// Only what this app needs: look up files by FileDataID and return their decoded (BLTE) bytes.
// Format notes: https://wowdev.wiki/CASC and https://wowdev.wiki/TACT
import { readFileSync, readdirSync, existsSync, openSync, readSync, closeSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { inflateSync } from "node:zlib";

type IndexEntry = { archive: number; offset: number; size: number };

export type CascOptions = {
  /** World of Warcraft install root, e.g. "E:/Games/World of Warcraft". */
  wowPath: string;
  /** Product code from .build.info, e.g. "wowf" (WoW Forever), "wow", "wow_classic_era". */
  product?: string;
  /** Where files downloaded from Blizzard's CDN are cached (files the local install streams on demand). */
  cacheDir?: string;
};

const MFST = 0x4d465354; // "TSFM" read little-endian
const LOCALE_ENUS = 0x2;
const CONTENT_LOW_VIOLENCE = 0x80;
const CONTENT_NO_NAME_HASH = 0x10000000;

function hex(buf: Uint8Array, start = 0, len = buf.length - start): string {
  return Buffer.from(buf.buffer, buf.byteOffset + start, len).toString("hex");
}

function readBuildInfo(wowPath: string, product?: string) {
  const text = readFileSync(join(wowPath, ".build.info"), "utf8").trim().split(/\r?\n/);
  const cols = text[0].split("|").map((c) => c.split("!")[0]);
  const rows = text.slice(1).map((line) => {
    const cells = line.split("|");
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
  });
  const row =
    rows.find((r) => r.Product === product) ??
    rows.find((r) => r.Active === "1") ??
    rows[0];
  if (!row) throw new Error(`No build in ${wowPath}/.build.info`);
  const servers = (row["CDN Servers"] || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => new URL(s).origin);
  const hosts = (row["CDN Hosts"] || "").split(/\s+/).filter(Boolean).map((h) => `http://${h}`);
  return {
    buildKey: row["Build Key"],
    cdnKey: row["CDN Key"],
    cdnPath: row["CDN Path"] || "tpr/wow",
    cdnServers: [...new Set([...servers, ...hosts])],
    product: row.Product,
    version: row.Version,
  };
}

function readConfig(dataDir: string, key: string): Record<string, string[]> {
  const path = join(dataDir, "config", key.slice(0, 2), key.slice(2, 4), key);
  const out: Record<string, string[]> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([\w-]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().split(/\s+/);
  }
  return out;
}

/**
 * Root name hash of a file path: Bob Jenkins' lookup3 hashlittle2 over the upper-cased path with backslashes,
 * stored as (c << 32) | b.
 */
export function nameHash(path: string): bigint {
  const k = Buffer.from(path.toUpperCase().replace(/\//g, "\\"), "latin1");
  const rot = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;
  let a = (0xdeadbeef + k.length) >>> 0;
  let b = a;
  let c = a;
  let len = k.length;
  let o = 0;
  while (len > 12) {
    a = (a + k.readUInt32LE(o)) >>> 0;
    b = (b + k.readUInt32LE(o + 4)) >>> 0;
    c = (c + k.readUInt32LE(o + 8)) >>> 0;
    a = (a - c) >>> 0; a = (a ^ rot(c, 4)) >>> 0; c = (c + b) >>> 0;
    b = (b - a) >>> 0; b = (b ^ rot(a, 6)) >>> 0; a = (a + c) >>> 0;
    c = (c - b) >>> 0; c = (c ^ rot(b, 8)) >>> 0; b = (b + a) >>> 0;
    a = (a - c) >>> 0; a = (a ^ rot(c, 16)) >>> 0; c = (c + b) >>> 0;
    b = (b - a) >>> 0; b = (b ^ rot(a, 19)) >>> 0; a = (a + c) >>> 0;
    c = (c - b) >>> 0; c = (c ^ rot(b, 4)) >>> 0; b = (b + a) >>> 0;
    len -= 12;
    o += 12;
  }
  if (len > 0) {
    const tail = Buffer.alloc(12);
    k.copy(tail, 0, o, o + len);
    a = (a + tail.readUInt32LE(0)) >>> 0;
    b = (b + tail.readUInt32LE(4)) >>> 0;
    c = (c + tail.readUInt32LE(8)) >>> 0;
    c = (c ^ b) >>> 0; c = (c - rot(b, 14)) >>> 0;
    a = (a ^ c) >>> 0; a = (a - rot(c, 11)) >>> 0;
    b = (b ^ a) >>> 0; b = (b - rot(a, 25)) >>> 0;
    c = (c ^ b) >>> 0; c = (c - rot(b, 16)) >>> 0;
    a = (a ^ c) >>> 0; a = (a - rot(c, 4)) >>> 0;
    b = (b ^ a) >>> 0; b = (b - rot(a, 14)) >>> 0;
    c = (c ^ b) >>> 0; c = (c - rot(b, 24)) >>> 0;
  }
  return (BigInt(c) << 32n) | BigInt(b);
}

/** Decodes a BLTE-encoded blob. */
export function decodeBLTE(data: Buffer): Buffer {
  if (data.readUInt32BE(0) !== 0x424c5445) throw new Error("Not BLTE data");
  const headerSize = data.readUInt32BE(4);
  const chunks: { comp: number; decomp: number }[] = [];
  let pos = 8;
  if (headerSize > 0) {
    const count = data.readUIntBE(9, 3);
    pos = 12;
    for (let i = 0; i < count; i++) {
      chunks.push({ comp: data.readUInt32BE(pos), decomp: data.readUInt32BE(pos + 4) });
      pos += 24;
    }
    pos = headerSize;
  } else {
    chunks.push({ comp: data.length - 8, decomp: -1 });
  }
  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    const block = data.subarray(pos, pos + chunk.comp);
    pos += chunk.comp;
    const mode = String.fromCharCode(block[0]);
    const body = block.subarray(1);
    if (mode === "N") parts.push(body);
    else if (mode === "Z") parts.push(inflateSync(body));
    else if (mode === "F") parts.push(decodeBLTE(body));
    else if (mode === "E") throw new Error("Encrypted BLTE block (no key available)");
    else throw new Error(`Unsupported BLTE mode '${mode}'`);
  }
  return Buffer.concat(parts);
}

/**
 * A CDN archive index (.index in Data/indices). Sorted entries in 4 KB blocks plus a table of each block's last key,
 * so a lookup reads the small key table once and then a single block from disk.
 */
class CdnIndex {
  private fd: number;
  private blockSize: number;
  private keySize: number;
  private sizeBytes: number;
  private offsetBytes: number;
  private entrySize: number;
  private lastKeys: Buffer;
  private numBlocks: number;

  constructor(path: string) {
    this.fd = openSync(path, "r");
    const size = statSync(path).size;
    const footer = Buffer.alloc(28);
    readSync(this.fd, footer, 0, 28, size - 28);
    this.blockSize = footer[11] * 1024;
    this.offsetBytes = footer[12];
    this.sizeBytes = footer[13];
    this.keySize = footer[14];
    const checksumSize = footer[15];
    this.entrySize = this.keySize + this.sizeBytes + this.offsetBytes;
    this.numBlocks = Math.floor((size - 28) / (this.blockSize + this.keySize + checksumSize));
    this.lastKeys = Buffer.alloc(this.numBlocks * this.keySize);
    readSync(this.fd, this.lastKeys, 0, this.lastKeys.length, this.numBlocks * this.blockSize);
  }

  /** Returns { size, archiveIndex, offset } (archive fields are -1/0 for loose-file indices). */
  lookup(ekey: Buffer): { size: number; archiveIndex: number; offset: number } | undefined {
    const ks = this.keySize;
    let lo = 0;
    let hi = this.numBlocks - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (Buffer.compare(this.lastKeys.subarray(mid * ks, mid * ks + ks), ekey) < 0) lo = mid + 1;
      else hi = mid;
    }
    const block = Buffer.alloc(this.blockSize);
    readSync(this.fd, block, 0, this.blockSize, lo * this.blockSize);
    for (let p = 0; p + this.entrySize <= this.blockSize; p += this.entrySize) {
      const cmp = Buffer.compare(block.subarray(p, p + ks), ekey);
      if (cmp === 0) {
        const size = block.readUIntBE(p + ks, this.sizeBytes);
        if (this.offsetBytes === 6)
          return { size, archiveIndex: block.readUInt16BE(p + ks + 4), offset: block.readUInt32BE(p + ks + 6) };
        if (this.offsetBytes === 4) return { size, archiveIndex: -2, offset: block.readUInt32BE(p + ks + 4) };
        return { size, archiveIndex: -1, offset: 0 };
      }
      if (cmp > 0) break;
    }
    return undefined;
  }
}

export class Casc {
  readonly wowPath: string;
  readonly dataDir: string;
  readonly product: string;
  readonly version: string;
  private cacheDir?: string;
  private cdnHosts: string[] = [];
  private cdnPath = "";
  private archives: string[] = [];
  private groupIndex?: CdnIndex;
  private fileIndex?: CdnIndex;
  private index = new Map<string, IndexEntry>();
  private encoding!: Buffer;
  private encPages!: { firstKeys: string[]; pageSize: number; pagesStart: number };
  /** FileDataID -> content key (hex), only for IDs that were requested via resolve(). */
  private fdidToCKey = new Map<number, string>();
  private rootData!: Buffer;

  private constructor(opts: CascOptions, info: ReturnType<typeof readBuildInfo>) {
    this.wowPath = opts.wowPath;
    this.dataDir = join(opts.wowPath, "Data");
    this.cacheDir = opts.cacheDir;
    this.product = info.product;
    this.version = info.version;
    this.cdnPath = info.cdnPath;
    this.cdnHosts = info.cdnServers;
    this.loadIndices();
    this.loadCdnIndices(info.cdnKey);
  }

  static async open(opts: CascOptions): Promise<Casc> {
    const info = readBuildInfo(opts.wowPath, opts.product);
    const casc = new Casc(opts, info);
    const build = readConfig(casc.dataDir, info.buildKey);
    casc.loadEncoding(await casc.readEKey(build.encoding[1]));
    const rootEKey = casc.ckeyToEKey(build.root[0]);
    if (!rootEKey) throw new Error("Root file not found in encoding table");
    casc.rootData = await casc.readEKey(rootEKey);
    return casc;
  }

  private loadCdnIndices(cdnKey: string) {
    try {
      const cdn = readConfig(this.dataDir, cdnKey);
      this.archives = cdn.archives ?? [];
      const dir = join(this.dataDir, "indices");
      const group = cdn["archive-group"]?.[0];
      if (group && existsSync(join(dir, `${group}.index`))) this.groupIndex = new CdnIndex(join(dir, `${group}.index`));
      const files = cdn["file-index"]?.[0];
      if (files && existsSync(join(dir, `${files}.index`))) this.fileIndex = new CdnIndex(join(dir, `${files}.index`));
    } catch (e) {
      console.warn("[casc] CDN indices unavailable, only locally stored files can be read:", (e as Error).message);
    }
  }

  private loadIndices() {
    const dir = join(this.dataDir, "data");
    const latest = new Map<string, string>();
    for (const f of readdirSync(dir)) {
      const m = f.match(/^([0-9a-f]{2})([0-9a-f]{8})\.idx$/i);
      if (!m) continue;
      const prev = latest.get(m[1]);
      if (!prev || prev < f) latest.set(m[1], f);
    }
    for (const f of latest.values()) {
      const buf = readFileSync(join(dir, f));
      const headerHashSize = buf.readUInt32LE(0);
      let pos = (8 + headerHashSize + 0x0f) & ~0x0f;
      const dataLength = buf.readUInt32LE(pos);
      pos += 8;
      const end = pos + dataLength;
      for (; pos + 18 <= end; pos += 18) {
        const key = hex(buf, pos, 9);
        if (this.index.has(key)) continue;
        const high = buf[pos + 9];
        const low = buf.readUInt32BE(pos + 10);
        this.index.set(key, {
          archive: (high << 2) | (low >>> 30),
          offset: low & 0x3fffffff,
          size: buf.readUInt32LE(pos + 14),
        });
      }
    }
    if (this.index.size === 0) throw new Error(`No CASC index entries found in ${dir}`);
  }

  /** Reads a file by encoding key: local storage first, then Blizzard's CDN (cached on disk). */
  private async readEKey(ekey: string): Promise<Buffer> {
    const entry = this.index.get(ekey.slice(0, 18));
    if (entry) {
      const path = join(this.dataDir, "data", `data.${String(entry.archive).padStart(3, "0")}`);
      const fd = openSync(path, "r");
      try {
        const buf = Buffer.alloc(entry.size - 30);
        readSync(fd, buf, 0, buf.length, entry.offset + 30);
        return decodeBLTE(buf);
      } finally {
        closeSync(fd);
      }
    }
    return decodeBLTE(await this.fetchFromCdn(ekey));
  }

  private async fetchFromCdn(ekey: string): Promise<Buffer> {
    const cached = this.cacheDir && join(this.cacheDir, "cdn", ekey);
    if (cached && existsSync(cached)) return readFileSync(cached);
    const key = Buffer.from(ekey, "hex");
    let url: string;
    let range: string | undefined;
    const archived = this.groupIndex?.lookup(key);
    if (archived && this.archives[archived.archiveIndex]) {
      const a = this.archives[archived.archiveIndex];
      url = `data/${a.slice(0, 2)}/${a.slice(2, 4)}/${a}`;
      range = `bytes=${archived.offset}-${archived.offset + archived.size - 1}`;
    } else if (this.fileIndex?.lookup(key)) {
      url = `data/${ekey.slice(0, 2)}/${ekey.slice(2, 4)}/${ekey}`;
    } else {
      throw new Error(`EKey ${ekey} is neither stored locally nor listed in the CDN indices`);
    }
    let lastError: unknown;
    for (const host of this.cdnHosts) {
      try {
        const res = await fetch(`${host}/${this.cdnPath}/${url}`, {
          headers: range ? { Range: range } : {},
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (cached) {
          mkdirSync(dirname(cached), { recursive: true });
          writeFileSync(cached, buf);
        }
        return buf;
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(`CDN download of ${ekey} failed: ${(lastError as Error)?.message}`);
  }

  private loadEncoding(enc: Buffer) {
    if (enc.toString("latin1", 0, 2) !== "EN") throw new Error("Bad encoding file");
    const ckeySize = enc[3];
    const pageSizeKB = enc.readUInt16BE(5);
    const pageCount = enc.readUInt32BE(9);
    const especBlockSize = enc.readUInt32BE(18);
    let pos = 22 + especBlockSize;
    const firstKeys: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      firstKeys.push(hex(enc, pos, ckeySize));
      pos += ckeySize + 16;
    }
    this.encoding = enc;
    this.encPages = { firstKeys, pageSize: pageSizeKB * 1024, pagesStart: pos };
  }

  /** Content key -> encoding key, using the page table to scan only one page. */
  private ckeyToEKey(ckey: string): string | undefined {
    const { firstKeys, pageSize, pagesStart } = this.encPages;
    let lo = 0;
    let hi = firstKeys.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (firstKeys[mid] <= ckey) lo = mid;
      else hi = mid - 1;
    }
    const enc = this.encoding;
    let pos = pagesStart + lo * pageSize;
    const end = pos + pageSize;
    while (pos + 22 <= end) {
      const keyCount = enc[pos];
      if (keyCount === 0) break;
      const ck = hex(enc, pos + 6, 16);
      if (ck === ckey) return hex(enc, pos + 22, 16);
      pos += 22 + keyCount * 16;
    }
    return undefined;
  }

  /** Finds a file's FileDataID by its path (e.g. "Interface\\GuildFrame\\GuildEmblemsLG_01.blp") via root name hashes. */
  findFileDataId(path: string): number | undefined {
    const want = nameHash(path);
    const root = this.rootData;
    if (root.readUInt32LE(0) !== MFST) return undefined;
    let headerSize = root.readUInt32LE(4);
    let version = 0;
    let total: number;
    let named: number;
    if (headerSize === 0x18) {
      version = root.readUInt32LE(8);
      total = root.readUInt32LE(12);
      named = root.readUInt32LE(16);
    } else {
      total = headerSize;
      named = root.readUInt32LE(8);
      headerSize = 12;
    }
    const allowNameless = total !== named;
    let pos = headerSize;
    while (pos < root.length) {
      const count = root.readUInt32LE(pos);
      let contentFlags: number;
      if (version >= 2) {
        contentFlags = root.readUInt32LE(pos + 8) | root.readUInt32LE(pos + 12) | (root[pos + 16] << 17);
        pos += 17;
      } else {
        contentFlags = root.readUInt32LE(pos + 4);
        pos += 12;
      }
      const idsAt = pos;
      pos += count * 4 + count * 16;
      if (allowNameless && contentFlags & CONTENT_NO_NAME_HASH) continue;
      for (let i = 0; i < count; i++) {
        if (root.readBigUInt64LE(pos + i * 8) !== want) continue;
        let fdid = -1;
        for (let j = 0; j <= i; j++) fdid = fdid + 1 + root.readInt32LE(idsAt + j * 4);
        return fdid;
      }
      pos += count * 8;
    }
    return undefined;
  }

  /** Scans the root file once and remembers the content keys of the requested FileDataIDs. */
  resolve(fileDataIds: Iterable<number>) {
    const wanted = new Set<number>();
    for (const id of fileDataIds) if (!this.fdidToCKey.has(id)) wanted.add(id);
    if (wanted.size === 0) return;
    const root = this.rootData;
    let pos = 0;
    let version = 0;
    let separated = false;
    let allowNameless = false;
    if (root.readUInt32LE(0) === MFST) {
      separated = true;
      let headerSize = root.readUInt32LE(4);
      let total: number;
      let named: number;
      if (headerSize === 0x18) {
        version = root.readUInt32LE(8);
        total = root.readUInt32LE(12);
        named = root.readUInt32LE(16);
      } else {
        total = headerSize;
        named = root.readUInt32LE(8);
        headerSize = 12;
      }
      allowNameless = total !== named;
      pos = headerSize;
    }
    const best = new Map<number, { ckey: string; score: number }>();
    while (pos < root.length) {
      let count: number;
      let contentFlags: number;
      let localeFlags: number;
      if (version >= 2) {
        count = root.readUInt32LE(pos);
        localeFlags = root.readUInt32LE(pos + 4);
        const a = root.readUInt32LE(pos + 8);
        const b = root.readUInt32LE(pos + 12);
        const c = root[pos + 16];
        contentFlags = a | b | (c << 17);
        pos += 17;
      } else {
        count = root.readUInt32LE(pos);
        contentFlags = root.readUInt32LE(pos + 4);
        localeFlags = root.readUInt32LE(pos + 8);
        pos += 12;
      }
      const ids = new Array<number>(count);
      let fdid = 0;
      for (let i = 0; i < count; i++) {
        const next = fdid + root.readInt32LE(pos + i * 4);
        ids[i] = next;
        fdid = next + 1;
      }
      pos += count * 4;
      const score =
        (localeFlags & LOCALE_ENUS ? 2 : 0) + (contentFlags & CONTENT_LOW_VIOLENCE ? 0 : 1);
      if (separated) {
        const ckeysAt = pos;
        for (let i = 0; i < count; i++) {
          if (!wanted.has(ids[i])) continue;
          const prev = best.get(ids[i]);
          if (!prev || prev.score < score)
            best.set(ids[i], { ckey: hex(root, ckeysAt + i * 16, 16), score });
        }
        pos += count * 16;
        if (!(allowNameless && contentFlags & CONTENT_NO_NAME_HASH)) pos += count * 8;
      } else {
        for (let i = 0; i < count; i++) {
          if (wanted.has(ids[i])) {
            const prev = best.get(ids[i]);
            if (!prev || prev.score < score)
              best.set(ids[i], { ckey: hex(root, pos + i * 24, 16), score });
          }
        }
        pos += count * 24;
      }
    }
    for (const [id, { ckey }] of best) this.fdidToCKey.set(id, ckey);
  }

  /** True when the FileDataID exists in this build (call resolve() first for batches). */
  has(fileDataId: number): boolean {
    this.resolve([fileDataId]);
    return this.fdidToCKey.has(fileDataId);
  }

  /** Returns the decoded file contents for a FileDataID. */
  async read(fileDataId: number): Promise<Buffer> {
    this.resolve([fileDataId]);
    const ckey = this.fdidToCKey.get(fileDataId);
    if (!ckey) throw new Error(`FileDataID ${fileDataId} not in root`);
    const ekey = this.ckeyToEKey(ckey);
    if (!ekey) throw new Error(`FileDataID ${fileDataId}: content key not in encoding table`);
    return this.readEKey(ekey);
  }
}

export async function openCasc(opts: CascOptions): Promise<Casc | null> {
  if (!opts.wowPath || !existsSync(join(opts.wowPath, ".build.info"))) return null;
  return Casc.open(opts);
}
