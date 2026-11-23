// Guild tabard data shared by the server (texture compositing) and the UI.
// File IDs come from the game's GuildTabardEmblem / GuildTabardBorder / GuildTabardBackground tables, which are
// identical in Retail, Classic and WoW Forever. Every texture comes in pairs per color:
//   lower half (TL, torso lower) = base + 2 * color, upper half (TU, torso upper) = base + 2 * color + 1.
// Design codes are compatible with the Tabard Studio addon: TS1:<emblem>.<emblemColor>.<border>.<borderColor>.<background>[:<name>]
// (1-based in codes, 0-based everywhere else).

export const EMBLEMS = 196;
export const EMBLEM_COLORS = 17;
export const BORDERS = 6;
export const BORDER_COLORS = 17;
export const BACKGROUNDS = 51;
export const TIERS = 3;

/** Bump when generated tabard images (halves, flat previews, emblem sheet) change, so caches are rebuilt. */
export const FRONT_VIEW_VERSION = 10;

// Tier 1 uses the "rare" textures: the Illustrious Guild Tabard (item 69209, rare quality). Tier 2 uses the "epic"
// textures: the Renowned Guild Tabard (item 69210, epic quality).
export const TIER_NAMES = ["Standard", "Illustrious", "Renowned"] as const;

// prettier-ignore
export const EMBLEM_BASE = [
  180398, 180432, 180466, 180500, 180534, 180568, 180602, 180636, 180670, 180704,
  181078, 181452, 181826, 182200, 182574, 182948, 183322, 183356, 183390, 183424,
  183458, 183492, 183526, 183560, 183594, 183628, 183662, 183696, 183730, 183764,
  183798, 183832, 183866, 183900, 183934, 183968, 184002, 184036, 184070, 184104,
  184138, 184172, 184206, 184240, 184274, 184308, 184342, 184376, 184410, 184444,
  184478, 184512, 184546, 184580, 184614, 184648, 184682, 184716, 184750, 184784,
  184818, 184852, 184886, 184920, 184954, 184988, 185022, 185056, 185090, 185124,
  185158, 185192, 185226, 185260, 185294, 185328, 185362, 185396, 185430, 185464,
  185498, 185532, 185566, 185600, 185634, 185668, 185702, 185736, 185770, 185804,
  185838, 185872, 185906, 185940, 185974, 186008, 186042, 186076, 186110, 186144,
  180738, 180772, 180806, 180840, 180874, 180908, 180942, 180976, 181010, 181044,
  181112, 181146, 181180, 181214, 181248, 181282, 181316, 181350, 181384, 181418,
  181486, 181520, 181554, 181588, 181622, 181656, 181690, 181724, 181758, 181792,
  181860, 181894, 181928, 181962, 181996, 182030, 182064, 182098, 182132, 182166,
  182234, 182268, 182302, 182336, 182370, 182404, 182438, 182472, 182506, 182540,
  182608, 182642, 182676, 182710, 182744, 182778, 182812, 182846, 182880, 182914,
  182982, 183016, 183050, 183084, 183118, 183152, 183186, 183220, 183254, 183288,
  465224, 465258, 465292, 465326, 465360, 465394, 465428, 465462, 465496, 465530,
  465564, 465598, 465632, 465666, 465700, 465734, 465768, 465802, 467279, 467313,
  467347, 467381, 467415, 467449, 467483, 467517,
];

/** Standard tabard (tier 0) border styles 0-5. */
export const BORDER_BASE = [180162, 180196, 180230, 180264, 180298, 180332];
/** Illustrious (1) and Renowned (2) tabards draw one ornate border for every style. */
export const TIER_BORDER_BASE = [0, 513861, 513725];
export const BACKGROUND_BASE = [180060, 513759, 513623];

/** Average on-fabric color of each palette entry (for swatches). */
// prettier-ignore
export const EMBLEM_COLOR_HEX = [
  "7e072f", "7d2403", "7b4e04", "7b6203", "7a7905", "697d04", "487d04", "097e1d", "0b7d60",
  "095e7c", "093970", "610d71", "700c64", "653f0a", "c5ccbf", "232b28", "dac764",
];
// prettier-ignore
export const BORDER_COLOR_HEX = [
  "8b0937", "8c2c05", "8f5a05", "907204", "8e8d06", "7a9105", "559106", "0d9120", "0f9170",
  "0c6e8f", "0e4382", "710d82", "810e74", "764a0c", "d6ded1", "333d39", "d8c06c",
];
// prettier-ignore
export const BACKGROUND_COLOR_HEX = [
  "b6245b", "930637", "640514", "be641a", "9b3a05", "6c0c02", "ca8a16", "ac6207", "7f3104",
  "d2b514", "b58b05", "865b04", "c6bf14", "a19907", "706805", "abbd15", "849008", "546005",
  "7fb818", "578907", "2d5903", "1dbc61", "0d8c3e", "0a5b0c", "1bb99e", "0c8871", "0a5841",
  "1e97bc", "0b6182", "08395a", "4370b0", "204980", "071b51", "b14bb7", "84298c", "580865",
  "b91ba8", "930682", "630452", "bb2387", "8a0653", "62052f", "8b6628", "5b3e0c", "2e1704",
  "3a4341", "5b635e", "758179", "919d95", "c0c6bb", "dd6f8e",
];

export type Design = {
  emblem: number;
  emblemColor: number;
  border: number;
  borderColor: number;
  background: number;
  /** 0 standard, 1 Illustrious, 2 Renowned. Not part of TS1 codes. */
  tier: number;
};

export const FIELDS = ["emblem", "emblemColor", "border", "borderColor", "background"] as const;
export type Field = (typeof FIELDS)[number];

export const COUNT: Record<Field | "tier", number> = {
  emblem: EMBLEMS,
  emblemColor: EMBLEM_COLORS,
  border: BORDERS,
  borderColor: BORDER_COLORS,
  background: BACKGROUNDS,
  tier: TIERS,
};

export const LABEL: Record<Field, string> = {
  emblem: "Emblem",
  emblemColor: "Emblem color",
  border: "Border",
  borderColor: "Border color",
  background: "Background",
};

export const DEFAULT_DESIGN: Design = {
  emblem: 0,
  emblemColor: 14,
  border: 0,
  borderColor: 16,
  background: 30,
  tier: 0,
};

export function isValid(d: Partial<Design>): d is Design {
  return (["tier", ...FIELDS] as const).every((f) => {
    const v = d[f];
    return Number.isInteger(v) && (v as number) >= 0 && (v as number) < COUNT[f];
  });
}

export function randomDesign(tier = 0): Design {
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    emblem: r(EMBLEMS),
    emblemColor: r(EMBLEM_COLORS),
    border: r(BORDERS),
    borderColor: r(BORDER_COLORS),
    background: r(BACKGROUNDS),
    tier,
  };
}

// ---- Design codes (Tabard Studio compatible) ------------------------------------------------------------

export const CODE_PREFIX = "TS1";
const MAX_NAME = 40;

export function cleanName(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  let n = name
    .replace(/\|c[0-9a-fA-F]{8}/g, "")
    .replace(/\|r/g, "")
    .replace(/\|T.*?\|t/g, "")
    .replace(/\|H.*?\|h/g, "")
    .replace(/\|h/g, "")
    .replace(/\|n/g, " ")
    .replace(/\|/g, "")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/:/g, " ")
    .trim();
  if (n.length > MAX_NAME) n = n.slice(0, MAX_NAME).trimEnd();
  return /[\p{L}\p{N}]/u.test(n) ? n : undefined;
}

export function encodeCode(d: Design, name?: string): string {
  let code = `${CODE_PREFIX}:${d.emblem + 1}.${d.emblemColor + 1}.${d.border + 1}.${d.borderColor + 1}.${d.background + 1}`;
  const n = cleanName(name);
  if (n) code += `:${n}`;
  return code;
}

const CODE_RE = /[Tt][Ss]1\s*:\s*(\d+)\s*[.,/-]\s*(\d+)\s*[.,/-]\s*(\d+)\s*[.,/-]\s*(\d+)\s*[.,/-]\s*(\d+)(?::([^\r\n]*))?/;

export type DecodeResult = { design: Omit<Design, "tier">; name?: string } | { error: string };

/** Finds a TS1 code anywhere in the text (a pasted chat line works too). */
export function decodeCode(text: string): DecodeResult {
  if (!text || !text.trim()) return { error: "Paste a design code first." };
  const m = text.match(CODE_RE);
  if (!m) return { error: "That is not a Tabard Studio code. Codes look like TS1:43.6.4.13.28" };
  const values = m.slice(1, 6).map((v) => Number(v) - 1);
  const design = Object.fromEntries(FIELDS.map((f, i) => [f, values[i]])) as Omit<Design, "tier">;
  for (const f of FIELDS) {
    const v = design[f];
    if (!(v >= 0 && v < COUNT[f])) return { error: `${LABEL[f]} must be a number from 1 to ${COUNT[f]} in this code.` };
  }
  return { design, name: cleanName(m[6]) };
}

// ---- Texture file IDs -------------------------------------------------------------------------------------

export type Half = "upper" | "lower";

const pick = (base: number, color: number, half: Half) => base + 2 * color + (half === "upper" ? 1 : 0);

export function emblemFile(emblem: number, color: number, half: Half) {
  return pick(EMBLEM_BASE[emblem], color, half);
}

export function borderFile(d: Pick<Design, "border" | "borderColor" | "tier">, half: Half) {
  const base = d.tier > 0 ? TIER_BORDER_BASE[d.tier] : BORDER_BASE[d.border];
  return pick(base, d.borderColor, half);
}

export function backgroundFile(color: number, tier: number, half: Half) {
  return pick(BACKGROUND_BASE[tier], color, half);
}

/** The three layers (bottom to top) that make one half of the tabard. */
export function layerFiles(d: Design, half: Half): number[] {
  return [backgroundFile(d.background, d.tier, half), borderFile(d, half), emblemFile(d.emblem, d.emblemColor, half)];
}

/** Every guild tabard texture file ID (for batch extraction). */
export function allTabardFiles(): number[] {
  const ids = new Set<number>();
  for (const base of EMBLEM_BASE) for (let c = 0; c < EMBLEM_COLORS; c++) ids.add(base + 2 * c).add(base + 2 * c + 1);
  for (const base of BORDER_BASE) for (let c = 0; c < BORDER_COLORS; c++) ids.add(base + 2 * c).add(base + 2 * c + 1);
  for (const base of TIER_BORDER_BASE.slice(1))
    for (let c = 0; c < BORDER_COLORS; c++) ids.add(base + 2 * c).add(base + 2 * c + 1);
  for (const base of BACKGROUND_BASE) for (let c = 0; c < BACKGROUNDS; c++) ids.add(base + 2 * c).add(base + 2 * c + 1);
  return [...ids];
}

// ---- Packed design IDs (used as fake item display / texture IDs for the 3D viewer) ------------------------

export const FAKE_DISPLAY_BASE = 800_000_000;
export const FAKE_TEXTURE_BASE = 1_100_000_000;

export function packDesign(d: Design): number {
  return (((((d.tier * EMBLEMS + d.emblem) * EMBLEM_COLORS + d.emblemColor) * BORDERS + d.border) * BORDER_COLORS +
    d.borderColor) * BACKGROUNDS + d.background);
}

export function unpackDesign(n: number): Design | null {
  if (!Number.isInteger(n) || n < 0) return null;
  const background = n % BACKGROUNDS;
  n = Math.floor(n / BACKGROUNDS);
  const borderColor = n % BORDER_COLORS;
  n = Math.floor(n / BORDER_COLORS);
  const border = n % BORDERS;
  n = Math.floor(n / BORDERS);
  const emblemColor = n % EMBLEM_COLORS;
  n = Math.floor(n / EMBLEM_COLORS);
  const emblem = n % EMBLEMS;
  const tier = Math.floor(n / EMBLEMS);
  const d = { emblem, emblemColor, border, borderColor, background, tier };
  return isValid(d) ? d : null;
}

export const fakeDisplayId = (d: Design) => FAKE_DISPLAY_BASE + packDesign(d);
export const fakeTextureId = (d: Design, half: Half) => FAKE_TEXTURE_BASE + packDesign(d) * 2 + (half === "upper" ? 1 : 0);

// ---- Front view and the synthetic tabard item ---------------------------------------------------------------

/** Half textures as the character model uses them. */
export const HALF_SIZE: Record<Half, [number, number]> = { upper: [512, 256], lower: [512, 128] };

/**
 * The 2D front view: torso textures hold half of the body (front center at x = 0, mirrored by the model), and are
 * 1.15x wider than the game's UI emblem art (measured over all 196 emblems), so the 512-texel panel shows 444 wide.
 */
export const FLAT_W = 444;
export const FLAT_H = 384;

/** Item metadata (Wowhead viewer format) for the synthetic guild tabard item: Blizzard's own "Guild Tabard" layout
 * pointing at the synthetic textures of this design. */
export function tabardItemMeta(displayId: number) {
  const packed = displayId - FAKE_DISPLAY_BASE;
  const upper = FAKE_TEXTURE_BASE + packed * 2 + 1;
  const lower = FAKE_TEXTURE_BASE + packed * 2;
  const files = (id: number) => [0, 1].map((Gender) => ({ FileDataId: id, Gender, Class: 0, Race: 0, ExtraData: 0 }));
  return {
    Model: 0,
    Textures: null,
    Textures2: null,
    TextureFiles: { [upper]: files(upper), [lower]: files(lower) },
    ModelFiles: null,
    Item: {
      Flags: 1,
      InventoryType: 19,
      ItemClass: 4,
      ItemSubClass: 0,
      HideGeosetMale: null,
      HideGeosetFemale: null,
      GeosetGroup: [1, 0, 0, 0, 0, 0],
      AttachGeosetGroup: [0, 0, 0, 0, 0, 0],
      GeosetGroupOverride: 0,
      ItemVisual: 0,
      ParticleColor: null,
    },
    Creature: null,
    Character: null,
    ItemEffects: null,
    Equipment: null,
    ComponentTextures: { "3": upper, "4": lower },
    ComponentModels: null,
    StateKits: null,
    Decor: null,
    Scale: 1,
  };
}
