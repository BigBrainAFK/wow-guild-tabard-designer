// Wowhead model viewer data (wow.zamimg.com) with a local mirror: files are read from MODEL_DIR first and saved there
// when downloaded, so `npm run fetch-models` can fill the mirror ahead of time and the server rarely waits on the CDN.
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { VIEWER_SCRIPT_PATH, VIEWER_SCRIPT_SHA256 } from "../shared/viewer.ts";

export const ZAM_ORIGIN = "https://wow.zamimg.com/";

export type ZamResult = { status: number; body: Buffer; local: boolean };

export type ZamOptions = {
  /** false: serve only what's already in the mirror, never contact the CDN. */
  fetchUpstream?: boolean;
  /** Most simultaneous CDN downloads. */
  maxUpstream?: number;
  timeoutMs?: number;
};

export class ZamMirror {
  readonly dir: string;
  private inflight = new Map<string, Promise<ZamResult>>();
  /** Live (browser) requests in progress and when the last one finished, so background work can stay out of the way. */
  private live = 0;
  private lastLive = 0;
  /** Paths the CDN recently answered with an error (bounded), so repeats don't go upstream again. */
  private misses = new Map<string, number>();
  private upstream = 0;
  private waiting: (() => void)[] = [];
  private fetchUpstream: boolean;
  private maxUpstream: number;
  private timeoutMs: number;

  constructor(dir: string, opts: ZamOptions = {}) {
    this.dir = resolve(dir);
    this.fetchUpstream = opts.fetchUpstream ?? true;
    this.maxUpstream = opts.maxUpstream ?? 8;
    this.timeoutMs = opts.timeoutMs ?? 20000;
  }

  /** Local path for a zamimg path like "modelviewer/live/m2/123.m2", or null if it would escape the mirror. */
  private file(path: string): string | null {
    const file = resolve(this.dir, normalize(path).replace(/^([/\\])+/, ""));
    return file.startsWith(this.dir + sep) ? file : null;
  }

  has(path: string): boolean {
    const file = this.file(path);
    return !!file && existsSync(file) && statSync(file).isFile();
  }

  /** get() for a request the user is waiting on. */
  async getLive(path: string): Promise<ZamResult> {
    this.live++;
    try {
      return await this.get(path);
    } finally {
      this.live--;
      this.lastLive = Date.now();
    }
  }

  /** Resolves once no live request has been running for `quietMs`. */
  async whenIdle(quietMs = 500) {
    while (this.live > 0 || Date.now() - this.lastLive < quietMs) await new Promise((r) => setTimeout(r, 100));
  }

  async get(path: string): Promise<ZamResult> {
    const file = this.file(path);
    if (!file) return { status: 400, body: Buffer.from("bad path"), local: false };
    // Non-blocking reads: the server keeps answering other requests while large model files load.
    const local = await readFile(file).catch(() => null);
    if (local) return this.checked(path, { status: 200, body: local, local: true });
    if (!this.fetchUpstream) return { status: 404, body: Buffer.from("not in the model mirror"), local: false };
    const missedAt = this.misses.get(path);
    if (missedAt && Date.now() - missedAt < 3600000) return { status: 404, body: Buffer.from("not found"), local: false };
    let p = this.inflight.get(path);
    if (!p) {
      p = this.download(path, file).finally(() => this.inflight.delete(path));
      this.inflight.set(path, p);
    }
    return p;
  }

  private async download(path: string, file: string): Promise<ZamResult> {
    if (this.upstream >= this.maxUpstream) await new Promise<void>((r) => this.waiting.push(r));
    this.upstream++;
    try {
      const res = await fetch(ZAM_ORIGIN + path, { signal: AbortSignal.timeout(this.timeoutMs) });
      const body = Buffer.from(await res.arrayBuffer());
      if (!res.ok) {
        this.misses.set(path, Date.now());
        if (this.misses.size > 20000) this.misses.delete(this.misses.keys().next().value!);
        return { status: res.status === 404 ? 404 : 502, body: Buffer.from("not found"), local: false };
      }
      const result = this.checked(path, { status: 200, body, local: false });
      if (result.status === 200) {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, body);
      }
      return result;
    } catch {
      return { status: 504, body: Buffer.from("upstream timeout"), local: false };
    } finally {
      this.upstream--;
      this.waiting.shift()?.();
    }
  }

  /** The viewer script runs with full rights on this site: only the exact pinned build is served. */
  private checked(path: string, r: ZamResult): ZamResult {
    if (path !== VIEWER_SCRIPT_PATH) return r;
    const hash = createHash("sha256").update(r.body).digest("hex");
    if (hash === VIEWER_SCRIPT_SHA256) return r;
    console.error(`[zam] viewer script hash mismatch (${hash}); refusing to serve it`);
    return { status: 502, body: Buffer.from("viewer script failed its integrity check"), local: r.local };
  }
}
