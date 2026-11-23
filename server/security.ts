// Hardening helpers for running the server in public: request allowlists, rate limits, a job limit for image
// generation and security headers.
import type http from "node:http";
import { ZAM_ENVS, VIEWER_SCRIPT_PATH } from "../shared/viewer.ts";

// ---- Wowhead CDN allowlist ---------------------------------------------------------------------------------

const ENV = `(?:${ZAM_ENVS.join("|")})`;
const ZAM_ALLOWED = [
  // Metadata the viewer reads (characters, customization, items).
  new RegExp(`^modelviewer/${ENV}/meta/(?:character|charactercustomization|item|itemvisual|npc|object)/\\d+\\.json$`),
  new RegExp(`^modelviewer/${ENV}/meta/armor/\\d{1,2}/\\d+\\.json$`),
  // Model files.
  new RegExp(`^modelviewer/${ENV}/(?:m2/\\d+\\.m2|skin/\\d+\\.skin|skel/\\d+\\.skel|bone/\\d+\\.bone|anim/[\\d-]+\\.anim)$`),
  new RegExp(`^modelviewer/${ENV}/textures/\\d+\\.(?:webp|png)$`),
  new RegExp(`^modelviewer/${ENV}/background-[0-9a-f]{6}\\.png$`),
  // Race / class / UI icons.
  /^images\/wow\/icons\/(?:small|medium|large)\/[a-z0-9_]+\.jpg$/,
];

/** Only the files the model viewer and the UI actually use may be fetched through the proxy. */
export function isAllowedZamPath(path: string): boolean {
  return path === VIEWER_SCRIPT_PATH || ZAM_ALLOWED.some((re) => re.test(path));
}

export function isKnownEnv(env: string): boolean {
  return (ZAM_ENVS as readonly string[]).includes(env);
}

// ---- Client address ---------------------------------------------------------------------------------------

/** The client's IP; X-Forwarded-For is only trusted behind a reverse proxy (TRUST_PROXY=1). */
export function clientIp(req: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

// ---- Rate limiting ---------------------------------------------------------------------------------------

/** Token bucket per client: `perMinute` sustained, bursts up to `burst`. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  private perMs: number;
  private burst: number;

  constructor(perMinute: number, burst: number) {
    this.perMs = perMinute / 60000;
    this.burst = burst;
    // Forget idle clients so the map can't grow without bound.
    setInterval(() => {
      const cutoff = Date.now() - 10 * 60000;
      for (const [k, b] of this.buckets) if (b.at < cutoff) this.buckets.delete(k);
    }, 60000).unref();
  }

  take(key: string, cost = 1): boolean {
    const now = Date.now();
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: now };
    b.tokens = Math.min(this.burst, b.tokens + (now - b.at) * this.perMs);
    b.at = now;
    this.buckets.set(key, b);
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    return true;
  }
}

// ---- Headers ---------------------------------------------------------------------------------------------

/**
 * Sent with every response. The CSP (production only; Vite's dev client needs inline scripts) allows what the app
 * uses: Wowhead's viewer builds functions at runtime and runs embedded WebAssembly ('unsafe-eval',
 * 'wasm-unsafe-eval'), Solid sets inline styles, fonts come from Google Fonts, and exports use data:/blob: images.
 */
export function securityHeaders(prod: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
  if (prod)
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; ");
  return headers;
}
