import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";
import {
  DEFAULT_DESIGN,
  decodeCode,
  encodeCode,
  fakeDisplayId,
  isValid,
  randomDesign,
  type Design,
} from "../shared/tabard.ts";
import {
  VERSIONS,
  classesFor,
  gearFor,
  racesFor,
  raceById,
  versionById,
  type Gender,
  type GearLevel,
  type VersionId,
} from "./data/characters.ts";
import { ModelViewer } from "./components/ModelViewer.tsx";
import { TabardEditor } from "./components/TabardEditor.tsx";
import { CharacterPanel } from "./components/CharacterPanel.tsx";
import { SharePanel, type SavedDesign } from "./components/SharePanel.tsx";
import { ExportPanel } from "./components/ExportPanel.tsx";
import { TabardImage } from "./components/TabardImage.tsx";
import type { CustomizationOption } from "./lib/viewer.ts";

const STORAGE_KEY = "tabard-designer:v1";

type Character = { version: VersionId; race: number; gender: Gender; classId: number; gear: GearLevel };

const GEAR_LEVELS: GearLevel[] = ["none", "mid", "end"];

/** Keeps race and class valid for the version (older saves stored gear as a boolean). */
function normalize(c: Character): Character {
  const v = versionById(c.version);
  const races = racesFor(v);
  const race = races.find((r) => r.id === c.race) ?? races[0];
  const classes = classesFor(v, race);
  const gear = (c.gear as unknown) === true ? "mid" : (c.gear as unknown) === false ? "none" : c.gear;
  return {
    version: v.id,
    race: race.id,
    gender: c.gender === 1 ? 1 : 0,
    classId: classes.includes(c.classId) ? c.classId : classes[0],
    gear: GEAR_LEVELS.includes(gear) ? gear : "mid",
  };
}

function readStorage(): { saved: SavedDesign[]; last?: { design: Design; character: Character } } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable */
  }
  return { saved: [] };
}

function writeStorage(data: ReturnType<typeof readStorage>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}

/** #code=TS1:…&tier=0&ver=retail&race=1&gender=0&class=1&gear=mid */
function readHash(): { design?: Design; character?: Partial<Character> } {
  const q = new URLSearchParams(location.hash.slice(1));
  const out: { design?: Design; character?: Partial<Character> } = {};
  const code = q.get("code");
  if (code) {
    const r = decodeCode(code);
    if (!("error" in r)) {
      const d = { ...r.design, tier: Number(q.get("tier") ?? 0) };
      if (isValid(d)) out.design = d;
    }
  }
  const c: Partial<Character> = {};
  if (q.has("race")) c.race = Number(q.get("race"));
  if (q.has("gender")) c.gender = q.get("gender") === "1" ? 1 : 0;
  if (q.has("class")) c.classId = Number(q.get("class"));
  if (q.has("ver")) c.version = versionById(q.get("ver")!).id;
  const gear = q.get("gear");
  if (gear) c.gear = gear === "1" ? "mid" : gear === "0" ? "none" : (gear as GearLevel);
  out.character = c;
  return out;
}

export function App() {
  const stored = readStorage();
  const fromHash = readHash();
  const initialChar = normalize({
    version: "retail",
    race: 1,
    gender: 0,
    classId: 1,
    gear: "mid",
    ...stored.last?.character,
    ...fromHash.character,
  });
  const storedDesign: Design = fromHash.design ?? (stored.last && isValid(stored.last.design) ? stored.last.design : DEFAULT_DESIGN);
  const initialDesign: Design = versionById(initialChar.version).guildTiers ? storedDesign : { ...storedDesign, tier: 0 };

  // ---- Tabard design with undo/redo ----
  const [designs, setDesigns] = createSignal<Design[]>([initialDesign]);
  const [cursor, setCursor] = createSignal(0);
  const design = createMemo(() => designs()[cursor()]);
  const [hover, setHover] = createSignal<Partial<Design> | null>(null);
  const shown = createMemo<Design>(() => ({ ...design(), ...hover() }));

  const commit = (patch: Partial<Design>) => {
    const next = { ...design(), ...patch };
    if (JSON.stringify(next) === JSON.stringify(design())) return;
    setDesigns((h) => [...h.slice(0, cursor() + 1), next].slice(-100));
    setCursor((c) => Math.min(c + 1, 99));
    setHover(null);
  };
  const undo = () => setCursor((c) => Math.max(0, c - 1));
  const redo = () => setCursor((c) => Math.min(designs().length - 1, c + 1));

  // The 3D model follows hovers too, but only after the pointer rests briefly.
  const [modelDesign, setModelDesign] = createSignal<Design>(initialDesign);
  createEffect(
    () => ({ d: shown(), hovering: hover() !== null }),
    ({ d, hovering }) => {
      const t = setTimeout(() => setModelDesign(d), hovering ? 180 : 0);
      return () => clearTimeout(t);
    },
  );

  // ---- Character ----
  const [character, setCharacter] = createSignal<Character>(initialChar);
  const version = createMemo(() => versionById(character().version));
  const race = createMemo(() => raceById(character().race));
  const chrModelId = createMemo(() => race().models[character().gender]);
  const [customization, setCustomization] = createSignal<Record<number, number>>({});
  const gear = createMemo(() => gearFor(version(), character().classId, character().gear));
  const items = createMemo<[number, number][]>(() => gear()?.items ?? []);

  // Ask the server to download every race of this version (and this class's gear) in the background, so switching
  // race later doesn't wait on Wowhead's CDN.
  const prefetchQuery = createMemo(() => {
    const v = version();
    const chr = [...new Set(racesFor(v).flatMap((r) => r.models))].join(",");
    const pieces = (["mid", "end"] as const).flatMap((l) => gearFor(v, character().classId, l)?.items ?? []);
    return `env=${v.env}&chr=${chr}&items=${pieces.map(([s, d]) => `${s}:${d}`).join(",")}`;
  });
  createEffect(
    () => prefetchQuery(),
    (query) => {
      // Let the current model load first.
      const t = setTimeout(() => fetch(`/api/prefetch?${query}`).catch(() => {}), 1500);
      return () => clearTimeout(t);
    },
  );

  const updateCharacter = (patch: Partial<Character>) => setCharacter((c) => normalize({ ...c, ...patch }));
  const changeModel = (patch: Partial<Character>) => {
    setCustomization({});
    updateCharacter(patch);
  };

  const [animations, setAnimations] = createSignal<string[]>([]);
  const [animation, setAnimation] = createSignal("Stand");
  const [paused, setPaused] = createSignal(false);
  const [loadingModel, setLoadingModel] = createSignal(true);

  // ---- Saved designs & persistence ----
  const [saved, setSaved] = createSignal<SavedDesign[]>(stored.saved ?? []);
  createEffect(
    () => ({ saved: saved(), last: { design: design(), character: character() } }),
    (data) => writeStorage(data),
  );
  createEffect(
    () => {
      const c = character();
      const d = design();
      return `code=${encodeCode(d)}&tier=${d.tier}&ver=${c.version}&race=${c.race}&gender=${c.gender}&class=${c.classId}&gear=${c.gear}`;
    },
    (hash) => history.replaceState(null, "", `#${hash}`),
  );

  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const randomizeLook = (options: CustomizationOption[]) => {
    const next: Record<number, number> = {};
    for (const o of options) next[o.Id] = o.Choices[Math.floor(Math.random() * o.Choices.length)].Id;
    setCustomization(next);
  };

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <img src="/zam/images/wow/icons/medium/inv_shirt_guildtabard_01.jpg" alt="" />
          <div>
            <h1>Tabard Designer</h1>
            <p>Guild tabards on a live 3D character</p>
          </div>
        </div>
        <div class="toolbar">
          <button type="button" class="btn ghost" onClick={undo} disabled={cursor() === 0} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button
            type="button"
            class="btn ghost"
            onClick={redo}
            disabled={cursor() >= designs().length - 1}
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
          <button type="button" class="btn ghost" onClick={() => commit(randomDesign(version().guildTiers ? design().tier : 0))}>
            ⚄ Random
          </button>
          <button type="button" class="btn ghost" onClick={() => commit(DEFAULT_DESIGN)}>
            Reset
          </button>
        </div>
      </header>

      <main class="layout">
        <aside class="sidebar left">
          <CharacterPanel
            versions={VERSIONS}
            version={version()}
            onVersion={(id) => {
              changeModel({ version: id });
              // Illustrious/Renowned only exist from Cataclysm on.
              if (!versionById(id).guildTiers && design().tier > 0) commit({ tier: 0 });
            }}
            races={racesFor(version())}
            classes={classesFor(version(), race())}
            gearName={gear() ? (gear()!.note ? `${gear()!.name} (${gear()!.note})` : gear()!.name) : undefined}
            race={race()}
            gender={character().gender}
            classId={character().classId}
            gear={character().gear}
            chrModelId={chrModelId()}
            customization={customization()}
            onRace={(id) => changeModel({ race: id })}
            onGender={(g) => changeModel({ gender: g })}
            onClass={(id) => updateCharacter({ classId: id })}
            onGear={(level) => updateCharacter({ gear: level })}
            onCustomize={(optionId, choiceId) =>
              setCustomization((c) => {
                const next = { ...c };
                if (choiceId === null) delete next[optionId];
                else next[optionId] = choiceId;
                return next;
              })
            }
            onRandomizeLook={randomizeLook}
          />
        </aside>

        <section class="stage">
          <ModelViewer
            env={version().env}
            chrModelId={chrModelId()}
            items={items()}
            tabard={fakeDisplayId(modelDesign())}
            customization={customization()}
            animation={animation()}
            paused={paused()}
            onAnimations={(names) => {
              setAnimations(names);
              if (!names.includes(animation())) setAnimation("Stand");
            }}
            onLoading={setLoadingModel}
          />
          <Show when={loadingModel()}>
            <div class="stage-loading">Loading model…</div>
          </Show>
          <div class="flat-preview" title="Front of the tabard">
            <TabardImage design={shown()} alt="Flat tabard preview" />
            <span class="flat-code">{encodeCode(shown())}</span>
          </div>
          <div class="stage-controls">
            <label class="select">
              <span>Animation</span>
              <select onChange={(e) => setAnimation(e.currentTarget.value)}>
                <Show when={animations().length} fallback={<option value="Stand">Stand</option>}>
                  <For each={animations()}>
                    {(n) => (
                      <option value={n} selected={n === animation()}>
                        {n}
                      </option>
                    )}
                  </For>
                </Show>
              </select>
            </label>
            <button type="button" class="btn ghost" onClick={() => setPaused((p) => !p)}>
              {paused() ? "▶ Play" : "❚❚ Pause"}
            </button>
            <span class="hint">Drag to rotate · scroll to zoom</span>
          </div>
        </section>

        <aside class="sidebar right">
          <TabardEditor design={design()} tiers={!!version().guildTiers} onPick={commit} onHover={setHover} />
          <SharePanel
            design={design()}
            saved={saved()}
            onLoad={(d) => commit({ ...d })}
            onSave={(name) => setSaved((s) => [{ name, design: design(), savedAt: Date.now() }, ...s])}
            onDelete={(i) => setSaved((s) => s.filter((_, j) => j !== i))}
          />
          <ExportPanel design={design()} raceFaction={race().faction} />
        </aside>
      </main>
    </div>
  );
}
