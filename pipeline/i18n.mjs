// Check translations: every string wrapped in t("...") in the app (and tr("...") in the engine's
// assistant), and every data-i18n text in index.html, must have a Spanish and a Portuguese version.
//   node pipeline/i18n.mjs            # report; exits 1 if anything is missing
//   node pipeline/i18n.mjs --keys     # print every key as JSON (for translators)
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = [
  ...(await readdir(new URL("app/js/", root))).filter((f) => f.endsWith(".js")).map((f) => `app/js/${f}`),
  "engine/src/assistant.js",
];
const keys = new Set();
// t("..."), t('...'), t(`...`) with no ${} inside
const CALL = /\b(?:t|tr)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\$]|\\.)*)`)\s*[,)]/g;
const unescape = (s) => JSON.parse(`"${s.replace(/\\'/g, "'").replace(/\\`/g, "`").replace(/"/g, '\\"').replace(/\\\\"/g, '\\"')}"`);
for (const f of files) {
  const src = await readFile(new URL(f, root), "utf8");
  for (const m of src.matchAll(CALL)) keys.add(m[1] !== undefined ? unescape(m[1]) : m[2] !== undefined ? unescape(m[2]) : m[3]);
}
const page = await readFile(new URL("app/index.html", root), "utf8");
for (const m of page.matchAll(/data-i18n(?:="")?[^>]*>(?:<[^>]+>)*([^<]+)</g)) keys.add(m[1].trim().replace(/&amp;/g, "&"));
for (const m of page.matchAll(/data-i18n-label="([^"]+)"/g)) keys.add(m[1]);

keys.delete("");
if (process.argv.includes("--keys")) { console.log(JSON.stringify([...keys].sort(), null, 1)); process.exit(0); }

let missingTotal = 0;
for (const lang of ["es", "pt"]) {
  const dict = (await import(new URL(`app/i18n/${lang}.js`, root))).default;
  const missing = [...keys].filter((k) => !dict[k]);
  const unused = Object.keys(dict).filter((k) => !keys.has(k));
  const badVars = [...keys].filter((k) => dict[k] && [...k.matchAll(/\{(\w+)\}/g)].some(([v]) => !dict[k].includes(v)));
  missingTotal += missing.length + badVars.length;
  console.log(`${lang}: ${keys.size - missing.length}/${keys.size} translated${unused.length ? `, ${unused.length} unused` : ""}${badVars.length ? `, ${badVars.length} with missing {placeholders}` : ""}`);
  for (const k of missing.slice(0, 20)) console.log(`  missing: ${k}`);
  for (const k of badVars.slice(0, 20)) console.log(`  placeholder: ${k}`);
}
process.exit(missingTotal ? 1 : 0);
