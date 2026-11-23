// Serves the 3D viewer's synthetic guild tabard (item metadata and textures) from the browser, through the service
// worker in public/tabard-sw.js, so the server never has to generate tabard images.
import {
  FAKE_DISPLAY_BASE,
  FAKE_TEXTURE_BASE,
  tabardItemMeta,
  unpackDesign,
} from "../../shared/tabard.ts";
import { renderHalf, toBlob } from "./tabardRender.ts";

type Reply = { status: number; type: string; body: ArrayBuffer | string };

async function answer(path: string): Promise<Reply> {
  const meta = path.match(/\/meta\/armor\/19\/(\d+)\.json$/);
  if (meta) {
    const id = Number(meta[1]);
    if (id < FAKE_DISPLAY_BASE || !unpackDesign(id - FAKE_DISPLAY_BASE))
      return { status: 404, type: "text/plain", body: "unknown design" };
    return { status: 200, type: "application/json", body: JSON.stringify(tabardItemMeta(id)) };
  }
  const tex = path.match(/\/textures\/(\d+)\.webp$/);
  if (tex) {
    const n = Number(tex[1]) - FAKE_TEXTURE_BASE;
    const design = n >= 0 ? unpackDesign(Math.floor(n / 2)) : null;
    if (!design) return { status: 404, type: "text/plain", body: "unknown design" };
    const png = await toBlob(await renderHalf(design, n % 2 ? "upper" : "lower"));
    return { status: 200, type: "image/png", body: await png.arrayBuffer() };
  }
  return { status: 404, type: "text/plain", body: "not found" };
}

let ready: Promise<void> | null = null;

/** Registers the service worker and resolves once it controls this page (the 3D viewer must wait for that). */
export function ensureTabardWorker(): Promise<void> {
  ready ??= (async () => {
    if (!("serviceWorker" in navigator))
      throw new Error("The 3D tabard needs a service worker: open the site over HTTPS (or on localhost).");
    navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
      if (event.data?.type !== "tabard-asset" || !event.ports[0]) return;
      const port = event.ports[0];
      answer(String(event.data.path)).then(
        (reply) => port.postMessage(reply, typeof reply.body === "string" ? [] : [reply.body]),
        (e: Error) => port.postMessage({ status: 500, type: "text/plain", body: e.message }),
      );
    });
    await navigator.serviceWorker.register("/tabard-sw.js", { scope: "/" });
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      );
  })();
  return ready;
}
