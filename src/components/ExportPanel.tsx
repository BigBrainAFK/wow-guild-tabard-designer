import { For, Show, createEffect, createSignal } from "solid-js";
import { encodeCode, type Design } from "../../shared/tabard.ts";
import type { Faction } from "../data/characters.ts";
import { download, fileSlug, renderBadge } from "../lib/badge.ts";
import { renderFront, toBlob } from "../lib/tabardRender.ts";
import { TabardImage } from "./TabardImage.tsx";

type Props = {
  design: Design;
  /** Faction of the selected race, used when the badge faction is "auto". */
  raceFaction: Faction;
};

type FactionChoice = "auto" | Faction;

export function ExportPanel(props: Props) {
  let canvas!: HTMLCanvasElement;
  const [factionChoice, setFactionChoice] = createSignal<FactionChoice>("auto");
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const faction = () => (factionChoice() === "auto" ? props.raceFaction : (factionChoice() as Faction));

  // Redraw the badge preview whenever anything on it changes.
  createEffect(
    () => ({ design: props.design, faction: faction() }),
    ({ design, faction }) => {
      let current = true;
      renderBadge(canvas, design, faction).then(
        () => current && setError(null),
        (e: Error) => current && setError(e.message),
      );
      return () => {
        current = false;
      };
    },
  );

  const saveBadge = () => {
    setBusy("badge");
    canvas.toBlob((blob) => {
      setBusy(null);
      if (blob) download(blob, `${fileSlug(encodeCode(props.design).replace(/[:.]/g, "-"), "tabard")}-badge.png`);
    }, "image/png");
  };

  const saveTabard = async () => {
    setBusy("tabard");
    try {
      // Rendered in the browser at 2x and saved from the page.
      const blob = await toBlob(await renderFront(props.design, 2));
      download(blob, `${fileSlug(encodeCode(props.design).replace(/[:.]/g, "-"), "tabard")}-tabard.png`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section class="panel-section export">
      <h3 class="section-title">
        Export images
        <span class="section-value">{encodeCode(props.design)}</span>
      </h3>

      <div class="export-row">
        <TabardImage class="export-tabard" design={props.design} alt="Tabard front" />
        <div class="export-text">
          <strong>Tabard</strong>
          <span class="hint">Front of the tabard, 888×768, transparent background.</span>
          <button type="button" class="btn" onClick={saveTabard} disabled={busy() !== null}>
            {busy() === "tabard" ? "Saving…" : "Download PNG"}
          </button>
        </div>
      </div>

      <div class="export-row">
        <canvas class="export-badge" ref={canvas} width={250} height={250} aria-label="Forum badge preview" />
        <div class="export-text">
          <strong>Forum badge</strong>
          <span class="hint">Guild banner in a faction ring, 250×250.</span>
          <div class="segmented small">
            <For each={["auto", "alliance", "horde"] as FactionChoice[]}>
              {(f) => (
                <button type="button" class={{ active: factionChoice() === f }} onClick={() => setFactionChoice(f)}>
                  {f === "auto" ? "Race" : f === "alliance" ? "Alliance" : "Horde"}
                </button>
              )}
            </For>
          </div>
          <button type="button" class="btn" onClick={saveBadge} disabled={busy() !== null || !!error()}>
            {busy() === "badge" ? "Saving…" : "Download PNG"}
          </button>
        </div>
      </div>
      <Show when={error()}>
        <p class="warning">{error()}</p>
      </Show>
    </section>
  );
}
