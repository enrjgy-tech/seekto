// Validate every pack: manifest fields, license, transcript parses, and builds index.json.
// Usage: node pipeline/check-packs.mjs [--write-index]
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCaptions } from "../engine/src/captions.js";

const root = new URL("../packs/", import.meta.url).pathname;
const schema = JSON.parse(await readFile(join(root, "schema.json"), "utf8"));
const licenses = new Set(schema.properties.license.properties.spdx.enum);
const kinds = new Set(schema.properties.source.properties.kind.enum);

const errors = [];
const index = [];
const entries = await readdir(root, { withFileTypes: true });

for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const where = `packs/${entry.name}`;
  let pack;
  try {
    pack = JSON.parse(await readFile(join(root, entry.name, "pack.json"), "utf8"));
  } catch (err) {
    errors.push(`${where}: pack.json is missing or not valid JSON (${err.message})`);
    continue;
  }
  for (const field of schema.required) if (pack[field] === undefined) errors.push(`${where}: missing "${field}"`);
  if (pack.id !== entry.name) errors.push(`${where}: id "${pack.id}" must match the folder name`);
  if (!new RegExp(schema.properties.id.pattern).test(pack.id || "")) errors.push(`${where}: id has invalid characters`);
  if (!kinds.has(pack.source?.kind)) errors.push(`${where}: source.kind must be one of ${[...kinds].join(", ")}`);
  if (pack.source?.kind !== "original" && !pack.source?.url) errors.push(`${where}: source.url is required for ${pack.source?.kind}`);
  if (!licenses.has(pack.license?.spdx)) errors.push(`${where}: license.spdx must be one of ${[...licenses].join(", ")}`);
  if (!pack.license?.attribution) errors.push(`${where}: license.attribution is required`);
  if (pack.video && !/^[A-Za-z0-9_-]{11}$/.test(pack.video.id || "")) errors.push(`${where}: video.id must be an 11-character YouTube ID`);
  let cues = [];
  try {
    cues = parseCaptions(await readFile(join(root, entry.name, pack.transcript || ""), "utf8"));
  } catch (err) {
    errors.push(`${where}: transcript "${pack.transcript}" can't be read (${err.message})`);
  }
  if (!cues.length) errors.push(`${where}: transcript has no timed lines`);
  index.push({ id: pack.id, title: pack.title, subject: pack.subject || null, video: pack.video?.id || null, license: pack.license?.spdx, lines: cues.length });
}

if (errors.length) {
  console.error(`Pack check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
if (process.argv.includes("--write-index")) {
  await writeFile(join(root, "index.json"), JSON.stringify({ schema: 1, packs: index }, null, 2) + "\n");
}
console.log(`${index.length} pack(s) OK`);
