// Build the static site into ./site for GitHub Pages: the app, the engine modules and the packs,
// plus a service worker that keeps a copy of the app so it opens offline after the first visit.
import { cp, mkdir, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const out = new URL("site/", root);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL("app/", root), out, { recursive: true });
await cp(new URL("engine/src/", root), new URL("engine/", out), { recursive: true });
await cp(new URL("packs/", root), new URL("packs/", out), { recursive: true });

// Everything the app needs to start, with a version that changes whenever any of it changes.
const files = [];
async function walk(dir, prefix = "") {
  for (const e of await readdir(new URL(dir, out), { withFileTypes: true })) {
    const rel = prefix + e.name;
    if (e.isDirectory()) { if (rel !== "packs") await walk(`${dir}${e.name}/`, `${rel}/`); }
    else if (!/\.(md|txt|sql)$/.test(e.name) && e.name !== "sw.js") files.push(rel);
  }
}
await walk("");
files.sort();
const hash = createHash("sha256");
for (const f of files) hash.update(f).update(await readFile(new URL(f, out)));
const version = hash.digest("hex").slice(0, 12);
const sw = (await readFile(new URL("app/sw.js", root), "utf8"))
  .replace("__VERSION__", version)
  .replace("__FILES__", JSON.stringify(["./", ...files.filter((f) => f !== "index.html")]));
await writeFile(new URL("sw.js", out), sw);
console.log(`Built site/ (${files.length} files, version ${version})`);
