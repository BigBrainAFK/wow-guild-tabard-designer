// Loads Wowhead's ZamModelViewer (the dressing room renderer) through our proxy.
import $ from "jquery";

import { VIEWER_SCRIPT_PATH } from "../../shared/viewer.ts";
import { ensureTabardWorker } from "./tabardAssets.ts";

export const VIEWER_SCRIPT = `/zam/${VIEWER_SCRIPT_PATH}`;
/** Model data for one Wowhead data set ("live", "classic", "tbc", "wrath", "cata", "mists"). */
export const contentPath = (env: string) => `/zam/modelviewer/${env}/`;
export const MODEL_TYPE_CHARACTER = 16;

export type ViewerItem = { slot: number; display: number; visual?: number };

export type Actor = {
  isLoaded(): boolean;
  getNumAnimations(): number;
  getAnimation(i: number): string;
};

export type ZamViewer = {
  renderer: {
    actors: Actor[];
    azimuth: number;
    zenith: number;
    distance: number;
    zoom: { target: number; current: number };
    resize(w: number, h: number): void;
    /** Resizes the canvas and rebuilds the projection for the new aspect ratio. */
    onResize(w: number, h: number, aspect: number): void;
  } | null;
  aspect: number;
  method(name: string, args?: unknown[]): unknown;
  destroy(): void;
};

export type ViewerOptions = {
  type: 2;
  contentPath: string;
  container: JQuery;
  aspect: number;
  hd: boolean;
  items: [number, number][];
  models: { id: number; type: number };
  charCustomization?: { options: { optionId: number; choiceId: number }[] };
  background?: string;
  transparent?: boolean;
};

declare global {
  interface Window {
    WH: unknown;
    jQuery: typeof $;
    $: typeof $;
    ZamModelViewer: new (opts: ViewerOptions) => ZamViewer;
  }
}

let loading: Promise<void> | null = null;

export function loadViewer(): Promise<void> {
  if (loading) return loading;
  // The tabard on the model is rendered in the browser and handed to the viewer by a service worker.
  const worker = ensureTabardWorker();
  window.jQuery = window.$ = $;
  // The viewer expects a few of Wowhead's page globals.
  window.WH ??= {
    debug: () => {},
    defaultAnimation: "Stand",
    WebP: { getImageExtension: () => ".webp" },
  };
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = VIEWER_SCRIPT;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load the Wowhead model viewer"));
    };
    document.head.append(s);
  }).then(() => worker);
  loading.catch(() => (loading = null));
  return loading;
}

export type CustomizationChoice = { Id: number; Name: string; OrderIndex: number };
export type CustomizationOption = { Id: number; Name: string; OrderIndex: number; Choices: CustomizationChoice[] };

const custCache = new Map<string, Promise<CustomizationOption[]>>();

export function loadCustomization(env: string, chrModelId: number): Promise<CustomizationOption[]> {
  const key = `${env}/${chrModelId}`;
  let p = custCache.get(key);
  if (!p) {
    p = fetch(`${contentPath(env)}meta/charactercustomization/${chrModelId}.json`)
      .then((r) => (r.ok ? r.json() : { Options: [] }))
      .then((j) =>
        ((j.Options ?? []) as CustomizationOption[])
          .filter((o) => o.Choices?.length > 1)
          .sort((a, b) => a.OrderIndex - b.OrderIndex),
      );
    custCache.set(key, p);
  }
  return p;
}
