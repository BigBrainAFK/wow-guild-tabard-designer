// Playable races, classes and per-class gear presets, following Wowhead's dressing room (Retail model data).

export type Faction = "alliance" | "horde";
export type Gender = 0 | 1;

export type Race = {
  id: number;
  /** Only playable in WoW Forever (e.g. the Skyborne). */
  foreverOnly?: boolean;
  name: string;
  faction: Faction;
  /** Icon base name on zamimg, e.g. "race_human" -> race_human_male / race_human_female. */
  icon: string;
  /** ChrModel IDs (Wowhead model viewer character models) for [male, female]. */
  models: [number, number];
  classes: number[];
};

const model = (race: number): [number, number] => [race * 2 - 1, race * 2];

// prettier-ignore
export const RACES: Race[] = [
  { id: 1, name: "Human", faction: "alliance", icon: "race_human", models: model(1), classes: [1, 2, 3, 4, 5, 6, 8, 9, 10] },
  { id: 3, name: "Dwarf", faction: "alliance", icon: "race_dwarf", models: model(3), classes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 4, name: "Night Elf", faction: "alliance", icon: "race_nightelf", models: model(4), classes: [1, 3, 4, 5, 6, 8, 9, 10, 11, 12] },
  { id: 7, name: "Gnome", faction: "alliance", icon: "race_gnome", models: model(7), classes: [1, 3, 4, 5, 6, 8, 9, 10] },
  { id: 11, name: "Draenei", faction: "alliance", icon: "race_draenei", models: model(11), classes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 22, name: "Worgen", faction: "alliance", icon: "race_worgen", models: model(22), classes: [1, 3, 4, 5, 6, 8, 9, 10, 11] },
  { id: 25, name: "Pandaren", faction: "alliance", icon: "race_pandaren", models: model(24), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 29, name: "Void Elf", faction: "alliance", icon: "race_voidelf", models: model(29), classes: [1, 3, 4, 5, 6, 8, 9, 10, 12] },
  { id: 30, name: "Lightforged Draenei", faction: "alliance", icon: "race_lightforgeddraenei", models: model(30), classes: [1, 2, 3, 4, 5, 6, 8, 9, 10] },
  { id: 34, name: "Dark Iron Dwarf", faction: "alliance", icon: "race_darkirondwarf", models: model(34), classes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 32, name: "Kul Tiran", faction: "alliance", icon: "race_kultiran", models: model(32), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 37, name: "Mechagnome", faction: "alliance", icon: "race_mechagnome", models: model(37), classes: [1, 3, 4, 5, 6, 8, 9, 10] },
  { id: 52, name: "Dracthyr", faction: "alliance", icon: "race_dracthyr", models: [127, 128], classes: [1, 3, 4, 5, 8, 9, 13] },
  { id: 85, name: "Earthen", faction: "alliance", icon: "race_earthendwarf", models: [195, 196], classes: [1, 2, 3, 4, 5, 7, 8, 9, 10] },
  { id: 86, name: "Haranir", faction: "alliance", icon: "race_harronir", models: [200, 201], classes: [1, 3, 4, 5, 7, 8, 9, 10, 11] },

  { id: 2, name: "Orc", faction: "horde", icon: "race_orc", models: model(2), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 5, name: "Undead", faction: "horde", icon: "race_scourge", models: model(5), classes: [1, 3, 4, 5, 6, 8, 9, 10] },
  { id: 6, name: "Tauren", faction: "horde", icon: "race_tauren", models: model(6), classes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 8, name: "Troll", faction: "horde", icon: "race_troll", models: model(8), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 9, name: "Goblin", faction: "horde", icon: "race_goblin", models: model(9), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 10, name: "Blood Elf", faction: "horde", icon: "race_bloodelf", models: model(10), classes: [1, 2, 3, 4, 5, 6, 8, 9, 10, 12] },
  { id: 26, name: "Pandaren", faction: "horde", icon: "race_pandaren", models: model(24), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 27, name: "Nightborne", faction: "horde", icon: "race_nightborne", models: model(27), classes: [1, 3, 4, 5, 6, 8, 9, 10] },
  { id: 28, name: "Highmountain Tauren", faction: "horde", icon: "race_highmountaintauren", models: model(28), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 36, name: "Mag'har Orc", faction: "horde", icon: "race_magharorc", models: model(36), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 31, name: "Zandalari Troll", faction: "horde", icon: "race_zandalaritroll", models: model(31), classes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 35, name: "Vulpera", faction: "horde", icon: "race_vulpera", models: model(35), classes: [1, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 70, name: "Dracthyr", faction: "horde", icon: "race_dracthyr", models: [127, 128], classes: [1, 3, 4, 5, 8, 9, 13] },
  { id: 84, name: "Earthen", faction: "horde", icon: "race_earthendwarf", models: [195, 196], classes: [1, 2, 3, 4, 5, 7, 8, 9, 10] },
  { id: 91, name: "Haranir", faction: "horde", icon: "race_harronir", models: [200, 201], classes: [1, 3, 4, 5, 7, 8, 9, 10, 11] },

  // WoW Forever races (Wowhead "classicplus" data: both use the race 95 models).
  { id: 95, name: "High Order Skyborne", faction: "alliance", icon: "race_skyborne", models: [218, 219], classes: [1, 3, 4, 8, 11], foreverOnly: true },
  { id: 96, name: "Windshaper Skyborne", faction: "horde", icon: "race_skyborne", models: [218, 219], classes: [1, 3, 4, 7, 11], foreverOnly: true },
];

export type PlayerClass = { id: number; name: string; color: string; icon: string };

export const CLASSES: PlayerClass[] = [
  { id: 1, name: "Warrior", color: "#c69b6d", icon: "class_warrior" },
  { id: 2, name: "Paladin", color: "#f48cba", icon: "class_paladin" },
  { id: 3, name: "Hunter", color: "#aad372", icon: "class_hunter" },
  { id: 4, name: "Rogue", color: "#fff468", icon: "class_rogue" },
  { id: 5, name: "Priest", color: "#ffffff", icon: "class_priest" },
  { id: 6, name: "Death Knight", color: "#c41e3a", icon: "class_deathknight" },
  { id: 7, name: "Shaman", color: "#0070dd", icon: "class_shaman" },
  { id: 8, name: "Mage", color: "#3fc7eb", icon: "class_mage" },
  { id: 9, name: "Warlock", color: "#8788ee", icon: "class_warlock" },
  { id: 10, name: "Monk", color: "#00ff98", icon: "class_monk" },
  { id: 11, name: "Druid", color: "#ff7c0a", icon: "class_druid" },
  { id: 12, name: "Demon Hunter", color: "#a330c9", icon: "class_demonhunter" },
  { id: 13, name: "Evoker", color: "#33937f", icon: "class_evoker" },
];

/** Viewer item slots (inventory types). */
export const SLOT = { head: 1, shoulders: 3, chest: 5, waist: 6, legs: 7, feet: 8, wrists: 9, hands: 10, back: 16, tabard: 19 };

// ---- Game versions ---------------------------------------------------------------------------------------

export type VersionId = "retail" | "forever" | "classic" | "tbc" | "wrath" | "cata" | "mop";

import { CATA_GEAR, CLASSIC_GEAR, FOREVER_GEAR, MOP_GEAR, TBC_GEAR, WRATH_GEAR, type EraGear } from "./gearData.ts";
import { GEAR_FILL } from "./gearFill.ts";

export type GameVersion = {
  id: VersionId;
  name: string;
  /** Wowhead model viewer data set (wow.zamimg.com/modelviewer/<env>/): models and item displays of that era. */
  env: string;
  /** Playable race -> classes. Retail uses each race's class list. */
  combos?: Record<number, number[]>;
  /** Era gear with this data set's display IDs (falls back to Retail presets per class). */
  gear?: EraGear;
  /** Illustrious and Renowned guild tabards (guild reputation, Cataclysm onwards). */
  guildTiers?: boolean;
  /** Used for classes the era gear lacks, labelled with fallbackNote. */
  fallbackGear?: EraGear;
  fallbackNote?: string;
};

// prettier-ignore
const VANILLA: Record<number, number[]> = {
  1: [1, 2, 4, 5, 8, 9], 3: [1, 2, 3, 4, 5], 4: [1, 3, 4, 5, 11], 7: [1, 4, 8, 9],
  2: [1, 3, 4, 7, 9], 5: [1, 4, 5, 8, 9], 6: [1, 3, 7, 11], 8: [1, 3, 4, 5, 7, 8],
};
const TBC: Record<number, number[]> = { ...VANILLA, 11: [1, 2, 3, 5, 7, 8], 10: [2, 3, 4, 5, 8, 9] };
const WRATH = Object.fromEntries(Object.entries(TBC).map(([r, c]) => [r, [...c, 6]]));
const add = (base: Record<number, number[]>, extra: Record<number, number[]>) =>
  Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(extra)])].map((r) => [
      r,
      [...new Set([...(base[+r] ?? []), ...(extra[+r] ?? [])])].sort((a, b) => a - b),
    ]),
  );
// prettier-ignore
const CATA = add(WRATH, {
  1: [3], 3: [7, 8], 4: [8], 7: [5], 2: [8], 5: [3], 6: [2, 5], 8: [9, 11], 10: [1],
  22: [1, 3, 4, 5, 6, 8, 9, 11], 9: [1, 3, 4, 5, 6, 7, 8, 9],
});
// prettier-ignore
const MOP = add(CATA, {
  1: [10], 3: [10], 4: [10], 7: [10], 11: [10], 2: [10], 5: [10], 6: [10], 8: [10], 10: [10],
  25: [1, 3, 4, 5, 7, 8, 10], 26: [1, 3, 4, 5, 7, 8, 10],
});

/** WoW Forever's races and classes, as Wowhead's Forever dressing room reports them. */
// prettier-ignore
const FOREVER: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 8, 9], 3: [1, 2, 3, 4, 5, 7], 4: [1, 3, 4, 5, 11], 7: [1, 4, 5, 8, 9], 95: [1, 3, 4, 8, 11],
  2: [1, 3, 4, 7, 8, 9], 5: [1, 2, 4, 5, 8, 9], 6: [1, 3, 7, 11], 8: [1, 3, 4, 5, 7, 8, 9], 96: [1, 3, 4, 7, 11],
};


export const VERSIONS: GameVersion[] = [
  { id: "retail", name: "Retail", env: "live", guildTiers: true },
  { id: "forever", name: "Forever", env: "classicplus", combos: FOREVER, gear: FOREVER_GEAR },
  { id: "classic", name: "Classic", env: "classic", combos: VANILLA, gear: CLASSIC_GEAR },
  { id: "tbc", name: "TBC Classic", env: "tbc", combos: TBC, gear: TBC_GEAR },
  { id: "wrath", name: "Wrath Classic", env: "wrath", combos: WRATH, gear: WRATH_GEAR },
  { id: "cata", name: "Cataclysm Classic", env: "cata", combos: CATA, gear: CATA_GEAR, guildTiers: true },
  // Monk uses its MoP raid sets from the Retail presets; MoP druid sets are still to be resolved.
  { id: "mop", name: "MoP Classic", env: "mists", combos: MOP, gear: MOP_GEAR, guildTiers: true, fallbackGear: { mid: { 11: CATA_GEAR.mid[11] }, end: { 11: CATA_GEAR.end[11] } }, fallbackNote: "Cataclysm set" },
];

export const versionById = (id: string) => VERSIONS.find((v) => v.id === id) ?? VERSIONS[0];

export function racesFor(v: GameVersion): Race[] {
  return v.combos ? RACES.filter((r) => v.combos![r.id]) : RACES.filter((r) => !r.foreverOnly);
}

export function classesFor(v: GameVersion, race: Race): number[] {
  return v.combos ? (v.combos[race.id] ?? []) : race.classes;
}

// ---- Gear ----------------------------------------------------------------------------------------------

export type GearPreset = { name: string; items: [slot: number, displayId: number][] };
export type GearLevel = "none" | "mid" | "end";

/**
 * "Mid-game" gear per class: the iconic Dungeon Set 1 (Tier 0) for the original classes, and a comparable
 * early/mid-expansion set for the others. [slot, item display id] pairs resolved from Wowhead (Retail data).
 */
// prettier-ignore
export const MID_GEAR: Record<number, GearPreset> = {
  1: { name: "Battlegear of Valor", items: [[1, 42241], [3, 29964], [5, 29958], [6, 29959], [7, 29963], [8, 29960], [9, 29961], [10, 29962]] },
  2: { name: "Lightforge Armor", items: [[1, 687833], [3, 29971], [5, 29969], [6, 29966], [7, 29972], [8, 29967], [9, 687841], [10, 29970]] },
  3: { name: "Beaststalker Armor", items: [[1, 31410], [3, 31409], [5, 31402], [6, 31404], [7, 31403], [8, 687791], [9, 31405], [10, 31406]] },
  4: { name: "Shadowcraft Armor", items: [[1, 16056], [3, 24727], [5, 15607], [6, 14853], [7, 9807], [8, 687774], [9, 15609], [10, 687777]] },
  5: { name: "Vestments of the Devout", items: [[1, 31104], [3, 31103], [5, 30422], [6, 30425], [7, 30424], [8, 30430], [9, 30426], [10, 30427]] },
  6: { name: "Scourgeborne Battlegear", items: [[1, 97409], [3, 45759], [5, 45311], [7, 42839], [10, 691545]] },
  7: { name: "The Elements", items: [[1, 687800], [3, 30925], [5, 31416], [6, 31413], [7, 186799], [8, 687792], [9, 31411], [10, 31414]] },
  8: { name: "Magister's Regalia", items: [[1, 31087], [3, 30211], [5, 29591], [6, 29596], [7, 7939], [8, 29594], [9, 29597], [10, 29593]] },
  9: { name: "Dreadmist Raiment", items: [[1, 31263], [3, 29798], [5, 29792], [6, 29793], [7, 29797], [8, 29799], [9, 29795], [10, 29800]] },
  10: { name: "Vestments of the Red Crane", items: [[1, 111367], [3, 111372], [5, 111369], [7, 111371], [10, 111370]] },
  11: { name: "Wildheart Raiment", items: [[1, 178255], [3, 30412], [5, 29974], [6, 29976], [7, 29975], [8, 29981], [9, 29977], [10, 29979]] },
  12: { name: "Vestment of Second Sight", items: [[1, 684994], [3, 157583], [5, 155934], [7, 155937], [10, 171621], [16, 156243]] },
  13: { name: "Scales of the Awakened", items: [[1, 664295], [3, 660991], [5, 661035], [7, 660994], [10, 661034]] },
};

/**
 * "End-game" gear per class: Tier 3 (Naxxramas) for the original classes, and the last raid tier of the class's
 * first expansion for the others (Retail data).
 */
// prettier-ignore
export const END_GEAR: Record<number, GearPreset> = {
  1: { name: "Dreadnaught's Battlegear", items: [[1, 96811], [3, 35189], [5, 35049], [6, 35191], [7, 35192], [8, 35193], [9, 54492], [10, 35194]] },
  2: { name: "Redemption Armor", items: [[1, 96819], [3, 35605], [5, 35606], [6, 35607], [7, 35608], [8, 35609], [9, 35663], [10, 35610]] },
  3: { name: "Cryptstalker Armor", items: [[1, 35601], [3, 35611], [5, 35415], [6, 35410], [7, 35413], [8, 35409], [9, 35416], [10, 35411]] },
  4: { name: "Bonescythe Armor", items: [[1, 96835], [3, 37175], [5, 35054], [6, 37177], [7, 37178], [8, 37356], [9, 112988], [10, 37357]] },
  5: { name: "Vestments of Faith", items: [[1, 175124], [3, 36964], [5, 36353], [6, 35707], [7, 96858], [8, 36966], [9, 57441], [10, 96862]] },
  6: { name: "Scourgelord's Battlegear", items: [[1, 685355], [3, 63609], [5, 63611], [7, 63613], [10, 63616]] },
  7: { name: "The Earthshatterer", items: [[1, 178497], [3, 40475], [5, 35752], [6, 35747], [7, 36621], [8, 96831], [9, 36623], [10, 40477]] },
  8: { name: "Frostfire Regalia", items: [[1, 96847], [3, 38582], [5, 35523], [6, 38584], [7, 50792], [8, 50793], [9, 12046], [10, 50794]] },
  9: { name: "Plagueheart Raiment", items: [[1, 49217], [3, 35739], [5, 35185], [6, 38147], [7, 96852], [8, 42028], [9, 96857], [10, 35743]] },
  10: { name: "Battlegear of Seven Sacred Seals", items: [[1, 182585], [3, 126807], [20, 126512], [7, 126511], [10, 126491]] },
  11: { name: "Dreamwalker Raiment", items: [[1, 178218], [3, 44613], [5, 35159], [6, 35164], [7, 42472], [8, 132825], [9, 96845], [10, 44615]] },
  12: { name: "Felreaper Vestments", items: [[1, 178607], [3, 163497], [5, 163493], [7, 163496], [10, 163494], [16, 163668]] },
  13: { name: "Weyrnkeeper's Timeless Vigil", items: [[1, 674275], [3, 672373], [20, 672374], [7, 672376], [10, 672379]] },
};

/** The set itself for a version/class/level: the version's own era sets, else the Retail presets. */
export function presetFor(v: GameVersion, classId: number, level: GearLevel): (GearPreset & { note?: string }) | null {
  if (level === "none") return null;
  const era = v.gear?.[level][classId];
  if (era) return era;
  const fallback = v.fallbackGear?.[level][classId];
  if (fallback) return { ...fallback, note: v.fallbackNote };
  return (level === "mid" ? MID_GEAR : END_GEAR)[classId] ?? null;
}

/** What the character wears: the set, completed with belt/boots/bracers/gloves where the set has none that render. */
export function gearFor(v: GameVersion, classId: number, level: GearLevel): (GearPreset & { note?: string }) | null {
  const preset = presetFor(v, classId, level);
  if (!preset || level === "none") return preset;
  const extra = GEAR_FILL[v.id]?.[classId]?.[level];
  if (!extra?.length) return preset;
  const replaced = new Set(extra.map(([slot]) => slot));
  return { ...preset, items: [...preset.items.filter(([slot]) => !replaced.has(slot)), ...extra] };
}

export const raceById = (id: number) => RACES.find((r) => r.id === id) ?? RACES[0];
export const classById = (id: number) => CLASSES.find((c) => c.id === id) ?? CLASSES[0];

export const iconUrl = (name: string, size: "medium" | "large" = "medium") => `/zam/images/wow/icons/${size}/${name}.jpg`;
export const raceIcon = (r: Race, g: Gender) => iconUrl(`${r.icon}_${g ? "female" : "male"}`);
