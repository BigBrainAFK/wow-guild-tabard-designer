import { For, Repeat, Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  BACKGROUND_COLOR_HEX,
  BORDER_COLOR_HEX,
  BORDERS,
  EMBLEM_COLOR_HEX,
  EMBLEMS,
  TIER_NAMES,
  type Design,
} from "../../shared/tabard.ts";
import { emblemSheetSize, emblemSpritePos, tintedEmblemSheet } from "../lib/emblems.ts";
import { TabardImage } from "./TabardImage.tsx";

type Props = {
  design: Design;
  /** The game version has Illustrious and Renowned tabards. */
  tiers: boolean;
  onPick: (patch: Partial<Design>) => void;
  onHover: (patch: Partial<Design> | null) => void;
};

const EMBLEM_SCALE = 0.75;

function Swatches(props: {
  colors: string[];
  value: number;
  label: string;
  onPick: (i: number) => void;
  onHover: (i: number | null) => void;
}) {
  return (
    <div class="swatches" role="radiogroup" aria-label={props.label}>
      <For each={props.colors}>
        {(hex, i) => (
          <button
            type="button"
            class={["swatch", { selected: props.value === i() }]}
            style={{ "background-color": `#${hex}` }}
            title={`${props.label} ${i() + 1}`}
            aria-label={`${props.label} ${i() + 1}`}
            aria-checked={props.value === i() ? "true" : "false"}
            role="radio"
            onClick={() => props.onPick(i())}
            onMouseEnter={() => props.onHover(i())}
            onMouseLeave={() => props.onHover(null)}
          />
        )}
      </For>
    </div>
  );
}

function SectionHeader(props: { title: string; value: string }) {
  return (
    <h3 class="section-title">
      {props.title}
      <span class="section-value">{props.value}</span>
    </h3>
  );
}

export function TabardEditor(props: Props) {
  const [sheet, setSheet] = createSignal<string | null>(null);
  const [sheetError, setSheetError] = createSignal<string | null>(null);
  const [filter, setFilter] = createSignal("");

  // Re-tint the emblem sheet whenever the emblem color changes.
  createEffect(
    () => props.design.emblemColor,
    (color) => {
      let current = true;
      tintedEmblemSheet(color).then(
        (url) => current && setSheet(url),
        (e: Error) => setSheetError(e.message),
      );
      return () => {
        current = false;
      };
    },
  );

  const emblemList = createMemo(() => {
    const f = filter().trim();
    const all = [...Array(EMBLEMS).keys()];
    if (!f) return all;
    return all.filter((e) => String(e + 1).startsWith(f));
  });

  const hues = [...Array(15).keys()];

  return (
    <div class="editor">
      <section class="editor-section">
        <SectionHeader title="Emblem" value={`${props.design.emblem + 1} / ${EMBLEMS}`} />
        <Swatches
          label="Emblem color"
          colors={EMBLEM_COLOR_HEX}
          value={props.design.emblemColor}
          onPick={(i) => props.onPick({ emblemColor: i })}
          onHover={(i) => props.onHover(i === null ? null : { emblemColor: i })}
        />
        <div class="emblem-tools">
          <input
            class="emblem-filter"
            type="search"
            inputmode="numeric"
            placeholder="Jump to # …"
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value.replace(/\D/g, ""))}
          />
          <span class="hint">Hover to try on, click to pick</span>
        </div>
        <Show when={!sheetError()} fallback={<p class="warning">{sheetError()} – is the WoW install configured?</p>}>
          <div
            class="emblem-grid"
            style={{ "--tabard-bg": `#${BACKGROUND_COLOR_HEX[props.design.background]}` }}
            onMouseLeave={() => props.onHover(null)}
          >
            <For each={emblemList()}>
              {(e) => (
                <button
                  type="button"
                  class={["emblem", { selected: props.design.emblem === e }]}
                  title={`Emblem ${e + 1}`}
                  aria-label={`Emblem ${e + 1}`}
                  onClick={() => props.onPick({ emblem: e })}
                  onMouseEnter={() => props.onHover({ emblem: e })}
                >
                  <span
                    class="emblem-art"
                    style={{
                      "background-image": sheet() ? `url(${sheet()})` : "none",
                      "background-size": emblemSheetSize(EMBLEM_SCALE),
                      "background-position": emblemSpritePos(e, EMBLEM_SCALE),
                    }}
                  />
                  <span class="emblem-num">{e + 1}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </section>

      <section class="editor-section">
        <SectionHeader
          title="Border"
          value={props.design.tier > 0 ? `${TIER_NAMES[props.design.tier]} border` : `${props.design.border + 1} / ${BORDERS}`}
        />
        <div class="border-styles" onMouseLeave={() => props.onHover(null)}>
          <Repeat count={BORDERS}>
            {(b) => (
              <button
                type="button"
                class={["border-style", { selected: props.design.border === b }]}
                disabled={props.design.tier > 0}
                title={props.design.tier > 0 ? "Illustrious and Renowned tabards use one ornate border" : `Border ${b + 1}`}
                onClick={() => props.onPick({ border: b })}
                onMouseEnter={() => props.onHover({ border: b })}
              >
                <TabardImage design={{ ...props.design, border: b }} alt={`Border ${b + 1}`} />
                <span>{b + 1}</span>
              </button>
            )}
          </Repeat>
        </div>
        <Swatches
          label="Border color"
          colors={BORDER_COLOR_HEX}
          value={props.design.borderColor}
          onPick={(i) => props.onPick({ borderColor: i })}
          onHover={(i) => props.onHover(i === null ? null : { borderColor: i })}
        />
      </section>

      <section class="editor-section">
        <SectionHeader title="Background" value={`${props.design.background + 1} / ${BACKGROUND_COLOR_HEX.length}`} />
        <div class="background-grid" onMouseLeave={() => props.onHover(null)}>
          <For each={[0, 1, 2]}>
            {(shade) => (
              <For each={hues}>
                {(h) => {
                  const i = h * 3 + shade;
                  return (
                    <button
                      type="button"
                      class={["swatch", "bg-swatch", { selected: props.design.background === i }]}
                      style={{ "background-color": `#${BACKGROUND_COLOR_HEX[i]}` }}
                      title={`Background ${i + 1}`}
                      aria-label={`Background ${i + 1}`}
                      onClick={() => props.onPick({ background: i })}
                      onMouseEnter={() => props.onHover({ background: i })}
                    />
                  );
                }}
              </For>
            )}
          </For>
          <For each={[45, 46, 47, 48, 49, 50]}>
            {(i) => (
              <button
                type="button"
                class={["swatch", "bg-swatch", { selected: props.design.background === i }]}
                style={{ "background-color": `#${BACKGROUND_COLOR_HEX[i]}` }}
                title={`Background ${i + 1}`}
                aria-label={`Background ${i + 1}`}
                onClick={() => props.onPick({ background: i })}
                onMouseEnter={() => props.onHover({ background: i })}
              />
            )}
          </For>
        </div>
      </section>

      <Show when={props.tiers}>
      <section class="editor-section">
        <SectionHeader title="Tabard" value={TIER_NAMES[props.design.tier]} />
        <div class="segmented">
          <For each={[...TIER_NAMES]}>
            {(name, i) => (
              <button
                type="button"
                class={{ active: props.design.tier === i() }}
                onClick={() => props.onPick({ tier: i() })}
                onMouseEnter={() => props.onHover({ tier: i() })}
                onMouseLeave={() => props.onHover(null)}
              >
                {name}
              </button>
            )}
          </For>
        </div>
        <p class="hint">Illustrious and Renowned are the guild-reputation tabard upgrades with ornate trim.</p>
      </section>
      </Show>
    </div>
  );
}
