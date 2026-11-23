/**
 * Pinned Wowhead model viewer build (path on wow.zamimg.com): the minified API differs between deployments, so the
 * app sticks to one it was built against.
 */
export const VIEWER_SCRIPT_PATH = "modelviewer/live/deployment/viewer/1bf640d/viewer.min.js";

/**
 * SHA-256 of that build. The viewer runs with full rights on this site, so the server refuses to serve a copy with
 * different contents (e.g. if the file on the CDN were ever changed).
 */
export const VIEWER_SCRIPT_SHA256 = "cbec7f1a47835a6262ebd3bb5924927ef760f7adf2d85c68442cea3f0607c34d";

/** Wowhead model viewer data sets the app uses (one per game version). */
export const ZAM_ENVS = ["live", "classicplus", "classic", "tbc", "wrath", "cata", "mists"] as const;
