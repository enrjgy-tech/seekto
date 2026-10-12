// Build the static site into ./site for GitHub Pages: the app, the engine modules and the packs.
import { cp, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const out = new URL("site/", root);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL("app/", root), out, { recursive: true });
await cp(new URL("engine/src/", root), new URL("engine/", out), { recursive: true });
await cp(new URL("packs/", root), new URL("packs/", out), { recursive: true });
console.log("Built site/");
