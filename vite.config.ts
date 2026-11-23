import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
// Top-level game data folders only (not src/data): they hold tens of thousands of files that the data scripts keep
// writing, and watching them would keep the dev server's thread busy and stall every request.
const unwatched = ["data", ".cache", "dist"].map((d) => resolve(root, d) + sep);

export default defineConfig({
  plugins: [solid()],
  build: { target: "es2024" },
  server: {
    watch: { ignored: (path: string) => unwatched.some((dir) => resolve(path).startsWith(dir) || resolve(path) + sep === dir) },
  },
});
