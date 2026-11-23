import { For, Show, createEffect, createSignal } from "solid-js";
import {
  CLASSES,
  iconUrl,
  raceIcon,
  type GameVersion,
  type Gender,
  type GearLevel,
  type Race,
  type VersionId,
} from "../data/characters.ts";
import { loadCustomization, type CustomizationOption } from "../lib/viewer.ts";

type Props = {
  versions: GameVersion[];
  version: GameVersion;
  onVersion: (id: VersionId) => void;
  /** Races playable in the selected version. */
  races: Race[];
  /** Classes the selected race can be in the selected version. */
  classes: number[];
  gearName?: string;
  race: Race;
  gender: Gender;
  classId: number;
  gear: GearLevel;
  chrModelId: number;
  customization: Record<number, number>;
  onRace: (id: number) => void;
  onGender: (g: Gender) => void;
  onClass: (id: number) => void;
  onGear: (level: GearLevel) => void;
  onCustomize: (optionId: number, choiceId: number | null) => void;
  onRandomizeLook: (options: CustomizationOption[]) => void;
};

function RaceColumn(props: {
  faction: "alliance" | "horde";
  races: Race[];
  race: Race;
  gender: Gender;
  onRace: (id: number) => void;
}) {
  return (
    <div class={["race-column", props.faction]}>
      <div class="faction-head">
        <img src={iconUrl(props.faction === "alliance" ? "ui_allianceicon" : "ui_hordeicon")} alt="" />
        {props.faction === "alliance" ? "Alliance" : "Horde"}
      </div>
      <div class="race-grid">
        <For each={props.races.filter((r) => r.faction === props.faction)}>
          {(r) => (
            <button
              type="button"
              class={["icon-btn", { selected: props.race.id === r.id }]}
              title={r.name}
              aria-label={r.name}
              onClick={() => props.onRace(r.id)}
            >
              <img src={raceIcon(r, props.gender)} alt="" />
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

export function CharacterPanel(props: Props) {
  const [options, setOptions] = createSignal<CustomizationOption[]>([]);
  const [showCustomize, setShowCustomize] = createSignal(false);

  createEffect(
    () => ({ env: props.version.env, id: props.chrModelId }),
    ({ env, id }) => {
      let current = true;
      setOptions([]);
      loadCustomization(env, id).then((o) => current && setOptions(o));
      return () => {
        current = false;
      };
    },
  );

  const choiceIndex = (o: CustomizationOption) => {
    const id = props.customization[o.Id];
    const i = o.Choices.findIndex((c) => c.Id === id);
    return i < 0 ? 0 : i;
  };

  /** Classes that exist in the selected version at all (e.g. no Death Knights in Classic Era). */
  const versionClasses = () => {
    const combos = props.version.combos;
    if (!combos) return CLASSES;
    const ids = new Set(Object.values(combos).flat());
    return CLASSES.filter((c) => ids.has(c.id));
  };

  const step = (o: CustomizationOption, delta: number) => {
    const n = o.Choices.length;
    const i = (choiceIndex(o) + delta + n) % n;
    props.onCustomize(o.Id, o.Choices[i].Id);
  };

  return (
    <div class="character">
      <section class="panel-section">
        <h3 class="section-title">Game version</h3>
        <select
          class="version-select"
          aria-label="Game version"
          onChange={(e) => props.onVersion(e.currentTarget.value as VersionId)}
        >
          <For each={props.versions}>
            {(v) => (
              <option value={v.id} selected={v.id === props.version.id}>
                {v.name}
              </option>
            )}
          </For>
        </select>
      </section>

      <section class="panel-section">
        <h3 class="section-title">Race</h3>
        <div class="race-columns">
          <RaceColumn faction="alliance" races={props.races} race={props.race} gender={props.gender} onRace={props.onRace} />
          <RaceColumn faction="horde" races={props.races} race={props.race} gender={props.gender} onRace={props.onRace} />
        </div>
        <p class="race-name">{props.race.name}</p>
      </section>

      <section class="panel-section">
        <h3 class="section-title">Gender</h3>
        <div class="segmented">
          <button type="button" class={{ active: props.gender === 0 }} onClick={() => props.onGender(0)}>
            <img src={raceIcon(props.race, 0)} alt="" /> Male
          </button>
          <button type="button" class={{ active: props.gender === 1 }} onClick={() => props.onGender(1)}>
            <img src={raceIcon(props.race, 1)} alt="" /> Female
          </button>
        </div>
      </section>

      <section class="panel-section">
        <h3 class="section-title">
          Class
          <span class="section-value" style={{ color: CLASSES.find((c) => c.id === props.classId)?.color }}>
            {CLASSES.find((c) => c.id === props.classId)?.name}
          </span>
        </h3>
        <div class="class-grid">
          <For each={versionClasses()}>
            {(c) => (
              <button
                type="button"
                class={["icon-btn", { selected: props.classId === c.id }]}
                disabled={!props.classes.includes(c.id)}
                title={props.classes.includes(c.id) ? c.name : `${c.name} (not available for ${props.race.name})`}
                aria-label={c.name}
                style={{ "--class-color": c.color }}
                onClick={() => props.onClass(c.id)}
              >
                <img src={iconUrl(c.icon)} alt="" />
              </button>
            )}
          </For>
        </div>
      </section>

      <section class="panel-section">
        <h3 class="section-title">Gear</h3>
        <div class="segmented">
          <For each={[["none", "None"], ["mid", "Mid-game"], ["end", "End-game"]] as [GearLevel, string][]}>
            {([level, label]) => (
              <button type="button" class={{ active: props.gear === level }} onClick={() => props.onGear(level)}>
                {label}
              </button>
            )}
          </For>
        </div>
        <Show when={props.gearName}>
          <p class="hint">{props.gearName}</p>
        </Show>
      </section>

      <section class="panel-section">
        <h3 class="section-title">
          <button type="button" class="link-btn" onClick={() => setShowCustomize((v) => !v)}>
            {showCustomize() ? "▾" : "▸"} Appearance
          </button>
          <Show when={showCustomize() && options().length}>
            <button type="button" class="link-btn small" onClick={() => props.onRandomizeLook(options())}>
              Randomize
            </button>
          </Show>
        </h3>
        <Show when={showCustomize()}>
          <Show when={options().length} fallback={<p class="hint">Loading options…</p>}>
            <div class="customize">
              <For each={options()}>
                {(o) => (
                  <div class="customize-row">
                    <span class="customize-label">{o.Name}</span>
                    <button type="button" class="step" aria-label={`Previous ${o.Name}`} onClick={() => step(o, -1)}>
                      ‹
                    </button>
                    <span class="customize-value">
                      {choiceIndex(o) + 1}/{o.Choices.length}
                    </span>
                    <button type="button" class="step" aria-label={`Next ${o.Name}`} onClick={() => step(o, 1)}>
                      ›
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </section>
    </div>
  );
}
