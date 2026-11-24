# Tabard Designer

A visual editor for World of Warcraft guild tabards with a live, animated 3D character preview, in the style of
Wowhead's dressing room. Built with **Node 26**, **Solid 2.0** and Vite 8.

- Pick the game version (Retail, Forever, Classic, TBC, Wrath, Cataclysm, MoP Classic), then race, gender and class
  like on Wowhead. Only the races, classes and combinations of that version are offered, and the character renders
  with that version's models.
- Gear: **none**, **mid-game** or **end-game** raid sets of the version's era (see below).
- All 196 emblems, 17 emblem colors, 6 borders, 17 border colors and 51 backgrounds, plus the Illustrious and
  Renowned guild tabard tiers. Hover anything to try it on the character, click to pick it.
- Flat front view of the tabard, undo/redo, random, saved designs (kept in the browser) and a shareable URL.
- Design codes are compatible with the [Tabard Studio](https://www.curseforge.com/wow/addons/tabard-studio) addon:
  `TS1:<emblem>.<emblem color>.<border>.<border color>.<background>` (1-based). Pasting a whole chat line works.
- Exports: the tabard front as PNG, and a forum badge PNG.

## Running

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. For production: `npm run build`, then `npm start`.

## Game data

Nothing from the game is in git. Two scripts fill the gitignored `data/` folder; copy it to the server:

| Script                 | Needs              | Writes                                    | Size        |
| ---------------------- | ------------------ | ----------------------------------------- | ----------- |
| `npm run extract`      | a WoW install      | `data/textures`: every tabard texture (WebP) and the UI emblem sheet | ~80 MB      |
| `npm run fetch-models` | internet           | `data/zam`: Wowhead model data for every race, gender and gear preset | ~0.4 GB per version |

- `npm run extract` reads the install via `WOW_PATH`. Files the install streams on demand are downloaded from
  Blizzard's CDN. The pack is lossy WebP (quality 90, lossless alpha), within 2-3 levels of the game's own textures.
- `npm run fetch-models -- forever classic` limits the download to some versions. Both scripts skip files they
  already have, so they can be re-run.
- With `WOW_PATH` set the server reads textures straight from the install; without it, from `data/textures`.
  Model data not in `data/zam` is downloaded from Wowhead's CDN on first use and kept there.
- `node scripts/check-gear.ts` verifies that every gear preset exists in its version's Wowhead data.

Configuration lives in `.env` (see `.env.example`):

| Variable      | Default         | Meaning                                                                  |
| ------------- | --------------- | ------------------------------------------------------------------------ |
| `WOW_PATH`    | (none)          | WoW install root (the folder containing `.build.info`); optional on servers |
| `WOW_PRODUCT` | `wowf`          | Product in `.build.info`: `wowf` (Forever), `wow`, `wow_classic_era` …    |
| `TEXTURE_DIR` | `data/textures` | Texture pack                                                             |
| `MODEL_DIR`   | `data/zam`      | Local mirror of Wowhead's model data                                     |
| `PORT`        | `5173`          | HTTP port                                                                |
| `HOST`        | `127.0.0.1,::1` | Addresses to listen on, comma-separated (dev mode refuses non-local ones) |
| `TRUST_PROXY` | (off)           | `1` behind a reverse proxy: rate-limit by `X-Forwarded-For`              |
| `MODEL_FETCH` | (on)            | `off`: serve model data only from `data/zam`, never contact Wowhead      |
| `CACHE_DIR`   | `.cache`        | Blizzard CDN downloads while extracting (safe to delete afterwards)      |

## Running on a server

1. On a machine with WoW: `npm run extract` and `npm run fetch-models`, then copy `data/` to the server.
2. On the server: `npm ci`, `npm run build`, then `npm start` (never `npm run dev`: dev mode serves source files,
   and refuses to listen on anything but localhost unless `DEV_ALLOW_REMOTE=1`).
3. Keep the default `HOST` (localhost over IPv4 and IPv6) and put a reverse proxy in front (Caddy, nginx) for TLS; set `TRUST_PROXY=1` there.
   HTTPS is required in public: the 3D tabard comes from a service worker, which browsers only allow on HTTPS
   (or on localhost).
4. Optional: `MODEL_FETCH=off` so the server never downloads from Wowhead (non-default customization textures
   that aren't in the mirror then don't load). Run it as an unprivileged user that can only write `data/`.

What the server does to stay safe in public:

- The Wowhead proxy only passes the file kinds the viewer uses (an allowlist), for the known data sets; misses are
  remembered for an hour, downloads run with a timeout and at most 8 at once, and per client.
- Background prefetching only accepts the races and gear the app itself shows.
- The server never draws images: tabards are composited in the browser. It only serves the fixed set of game
  tabard textures (about 7,000 file IDs, anything else is a 404) and keeps at most 64 MB of them in memory.
- Requests and headers time out.
- The pinned Wowhead viewer script is only served if its SHA-256 matches (`shared/viewer.ts`).
- Security headers on every response (`nosniff`, no framing, no referrer) and a Content Security Policy in
  production. The CSP allows `unsafe-eval`/`wasm-unsafe-eval` because the Wowhead viewer needs them.
- Only GET/HEAD; errors only say "internal error" (details go to the server log); no server paths are exposed.

Not a technical risk but worth knowing: a public instance redistributes Blizzard game assets (texture pack, model
mirror, badge art) and data from Wowhead's CDN. Keep it non-commercial, or limit access to your guild.

## Game versions and gear

| Version   | Wowhead data | Mid-game                  | End-game                  |
| --------- | ------------ | ------------------------- | ------------------------- |
| Retail    | `live`       | Dungeon Set 1 / first-expansion sets | Tier 3 / last raid tier of the class's first expansion |
| Forever   | `classicplus`| Tier 1 (Molten Core)      | Tier 3 (Naxxramas)        |
| Classic   | `classic`    | Tier 1                    | Tier 3                    |
| TBC       | `tbc`        | Tier 4                    | Tier 6                    |
| Wrath     | `wrath`      | Tier 7                    | Tier 10                   |
| Cataclysm | `cata`       | Tier 11                   | Tier 13                   |
| MoP       | `mists`      | Tier 14                   | Tier 16                   |

Forever's races (including the Skyborne) and race/class combinations come from Wowhead's Forever dressing room.
Known gaps: Wrath's Tier 10 gloves for six classes and MoP's Monk sets have display IDs missing from Wowhead's
data, and MoP Druids use their Cataclysm sets.

## How it works

- **3D preview**: Wowhead's `ZamModelViewer` (pinned build, see `shared/viewer.ts`) renders the character. The
  Node server serves Wowhead's model data under `/zam/` from the local mirror, fetching missing files from
  `wow.zamimg.com` (which sends no CORS headers).
- **Guild tabard on the model**: Wowhead's data has no guild emblems, so every design gets a synthetic item display
  ID (`800000000 + packed design`). The page's service worker (`public/tabard-sw.js`) catches the viewer's requests
  for that item and its textures and hands them to the page, which answers with Blizzard's own "Guild Tabard" item
  layout and the tabard halves (torso upper and lower) composited on a canvas from the game's background, border
  and emblem textures (`src/lib/tabardRender.ts`, layers from `/api/layer/<file id>.webp`). Previews, picker
  thumbnails and exports use the same renderer. Changing the design swaps only the tabard slot.
- **Game textures**: `server/casc.ts` is a small read-only CASC reader for a local install (build info, local
  indices, encoding and root tables, name hashes, BLTE, CDN fallback). `server/image.ts` decodes BLP.
- **Data**: `shared/tabard.ts` holds the tabard texture tables and design codes. `src/data/characters.ts` and
  `src/data/gearData.ts` hold versions, races, classes and gear (item display IDs resolved from Wowhead).

## Exports

- **Tabard PNG**: front of the tabard at 888x768, transparent.
- **Forum badge PNG**: 250x250 in the style of
  [guild-tabard-creator.netlify.app](https://guild-tabard-creator.netlify.app/) (original site by Avenirer, recreated
  by Daragyon). The ring, banner, hooks and border images in `public/badge` are from that site; the emblem is the
  game's own artwork. Both images are made in the browser.

The emblem picker shows the game's guild UI emblem sheet (`Interface/GuildFrame/GuildEmblemsLG_01`); the model,
previews and exports use the tabard emblem textures. The flat front view is scaled by 1/1.15 horizontally, measured
against that sheet over all 196 emblems.

---

<sub>This project was scaffolded with the help of [Claude Code](https://claude.com/claude-code).</sub>
