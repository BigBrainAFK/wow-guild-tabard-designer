import { createEffect, createMemo, createSignal, onSettled } from "solid-js";
import $ from "jquery";
import { contentPath, MODEL_TYPE_CHARACTER, loadViewer, type ZamViewer } from "../lib/viewer.ts";
import { SLOT } from "../data/characters.ts";

export type ModelViewerProps = {
  /** Wowhead model data set, e.g. "live" or "classic". */
  env: string;
  chrModelId: number;
  /** [slot, displayId] pairs worn besides the tabard. */
  items: [number, number][];
  /** Display ID of the tabard (null = no tabard). */
  tabard: number | null;
  /** optionId -> choiceId */
  customization: Record<number, number>;
  animation: string;
  paused: boolean;
  onAnimations?: (names: string[]) => void;
  onLoading?: (loading: boolean) => void;
};

export function ModelViewer(props: ModelViewerProps) {
  let host!: HTMLDivElement;
  let viewer: ZamViewer | null = null;
  let tabard: number | null = null;
  const [ready, setReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  onSettled(() => {
    loadViewer().then(
      () => setReady(true),
      (e: Error) => setError(e.message),
    );
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!viewer?.renderer || !w || !h) return;
      // onResize (not resize) so the projection follows the new aspect ratio and the model isn't stretched.
      viewer.aspect = w / h;
      viewer.renderer.onResize(w, h, w / h);
    });
    ro.observe(host);
    return () => {
      ro.disconnect();
      viewer?.destroy();
    };
  });

  // Everything that needs a fresh model (race, gender, gear, customization).
  const model = createMemo(
    () => ({
      env: props.env,
      id: props.chrModelId,
      items: props.items,
      customization: props.customization,
      key: JSON.stringify([props.env, props.chrModelId, props.items, props.customization]),
    }),
    { equals: (a, b) => a.key === b.key },
  );

  const [attempt, setAttempt] = createSignal(0);
  const [stalled, setStalled] = createSignal(false);

  createEffect(
    () => (ready() ? { m: model(), attempt: attempt() } : null),
    (state) => {
      if (!state) return;
      // Debounce: quick successive changes (race, then gender, then gear…) build one model, not several.
      let poll: ReturnType<typeof setInterval> | undefined;
      const timer = setTimeout(() => (poll = build(state.m)), 120);
      return () => {
        clearTimeout(timer);
        clearInterval(poll);
      };
    },
  );

  // One automatic rebuild per model (reset whenever a different model is requested).
  let autoRetried = false;
  let lastKey = "";

  function build(m: ReturnType<typeof model>) {
    if (m.key !== lastKey) {
      lastKey = m.key;
      autoRetried = false;
    }
    {
      setStalled(false);
      const camera = viewer?.renderer
        ? { azimuth: viewer.renderer.azimuth, zenith: viewer.renderer.zenith, zoom: viewer.renderer.zoom.target }
        : null;
      viewer?.destroy();
      host.replaceChildren();
      const items: [number, number][] = [...m.items];
      if (tabard) items.push([SLOT.tabard, tabard]);
      const options = Object.entries(m.customization).map(([optionId, choiceId]) => ({
        optionId: Number(optionId),
        choiceId,
      }));
      const v = new window.ZamModelViewer({
        type: 2,
        contentPath: contentPath(m.env),
        container: $(host),
        aspect: host.clientWidth / Math.max(1, host.clientHeight),
        hd: true,
        items,
        models: { id: m.id, type: MODEL_TYPE_CHARACTER },
        ...(options.length ? { charCustomization: { options } } : {}),
      });
      viewer = v;
      if (camera && v.renderer) {
        v.renderer.azimuth = camera.azimuth;
        v.renderer.zenith = camera.zenith;
        v.renderer.zoom.target = camera.zoom;
      }
      props.onLoading?.(true);
      // Wait for the model so we can list its animations and apply the selected one.
      let tries = 0;
      const poll = setInterval(() => {
        const actor = v.renderer?.actors?.[0];
        if (viewer !== v) return clearInterval(poll);
        tries++;
        // 8 s without a model: rebuild it once automatically; if that stalls too, offer a retry button.
        if (tries === 80 && !autoRetried) {
          autoRetried = true;
          clearInterval(poll);
          setAttempt((a) => a + 1);
          return;
        }
        if (tries === 150) setStalled(true);
        if (!actor?.isLoaded?.()) return;
        setStalled(false);
        clearInterval(poll);
        const names = new Set<string>();
        for (let i = 0; i < actor.getNumAnimations(); i++) {
          const n = actor.getAnimation(i);
          if (n) names.add(n);
        }
        props.onAnimations?.([...names].sort());
        props.onLoading?.(false);
        v.method("setAnimation", [currentAnimation]);
        v.method("setAnimPaused", [currentPaused]);
      }, 100);
      return poll;
    }
  }

  // Swap only the tabard (no model reload) when the design changes.
  createEffect(
    () => props.tabard,
    (id) => {
      if (id === tabard) return;
      tabard = id;
      if (!viewer) return;
      viewer.method("clearSlots", [String(SLOT.tabard)]);
      if (id) viewer.method("setItems", [[{ slot: SLOT.tabard, display: id, visual: 0 }]]);
    },
  );

  let currentAnimation = "Stand";
  let currentPaused = false;
  createEffect(
    () => props.animation,
    (name) => {
      currentAnimation = name;
      viewer?.method("setAnimation", [name]);
    },
  );
  createEffect(
    () => props.paused,
    (paused) => {
      currentPaused = paused;
      viewer?.method("setAnimPaused", [paused]);
    },
  );

  return (
    <div class="viewer">
      <div class="viewer-canvas" ref={host} />
      <p class="viewer-disclaimer">3D preview - may look slightly different in game</p>
      {error() && <div class="viewer-error">{error()}</div>}
      {stalled() && (
        <button type="button" class="btn viewer-retry" onClick={() => setAttempt((a) => a + 1)}>
          Model is taking long – retry
        </button>
      )}
    </div>
  );
}
