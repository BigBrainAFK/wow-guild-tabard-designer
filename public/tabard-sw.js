// Service worker for the 3D preview: the Wowhead viewer requests the guild tabard as a synthetic item
// (meta/armor/19/<800000000+>.json) with synthetic textures (textures/<1100000000+>.webp). Those requests are
// answered by the page itself, which composites the tabard in the browser. Everything else passes through untouched.
const SYNTHETIC = /^\/zam\/modelviewer\/[\w-]+\/(?:meta\/armor\/19\/\d{9}\.json|textures\/\d{10}\.webp)$/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !SYNTHETIC.test(url.pathname)) return;
  event.respondWith(answerFromPage(event.clientId, url.pathname));
});

async function answerFromPage(clientId, path) {
  const client = clientId ? await self.clients.get(clientId) : null;
  if (!client) return new Response("no page to render the tabard", { status: 503 });
  const channel = new MessageChannel();
  const reply = new Promise((resolve) => {
    channel.port1.onmessage = (event) => resolve(event.data);
    setTimeout(() => resolve({ status: 504, type: "text/plain", body: "render timeout" }), 20000);
  });
  client.postMessage({ type: "tabard-asset", path }, [channel.port2]);
  const { status, type, body } = await reply;
  return new Response(body, { status, headers: { "Content-Type": type, "Cache-Control": "no-store" } });
}
