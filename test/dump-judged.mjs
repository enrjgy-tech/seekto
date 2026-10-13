// Runs the engine over judged lectures (LECTURES=dir of <lecture>.txt) and prints precision per rule;
// writes feature rows (OUT) for engine/bench/fit-definitions.py. The transcripts are not in the repo (CC BY-NC-SA).
import { findDefinitions } from "../engine/src/index.js";
import { readFileSync } from "node:fs";
const J = readFileSync(new URL("../engine/bench/judgments/definitions.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse);
const key = (l, t) => l + "|" + t.toLowerCase();
const real = new Map(J.map((j) => [key(j.lecture, j.term), j.real]));
const dir = "" + (process.env.LECTURES || "lectures") + "/";
let off = 0,
  tp = 0,
  unk = 0;
const byRule = {};
for (const lec of new Set(J.map((j) => j.lecture))) {
  const text = readFileSync(dir + lec + ".txt", "utf8").replace(/\n/g, " ");
  for (const d of findDefinitions(text, { features: true })) {
    off++;
    const r = real.get(key(lec, d.term));
    if (r === undefined) {
      unk++;
      if (process.env.SHOW) console.log("NEW", lec, d.rule, "|", d.term, "::", d.definition.slice(0, 80));
      continue;
    }
    tp += r ? 1 : 0;
    (byRule[d.rule] ||= [0, 0])[0]++;
    byRule[d.rule][1] += r ? 1 : 0;
    if (process.env.SHOW && !r) console.log("FALSE", lec, d.rule, "|", d.term, "::", d.definition.slice(0, 80));
  }
}
const realTotal = J.filter((j) => j.real).length;
console.log(
  `offered ${off}, judged real ${tp}, judged false ${off - tp - unk}, not judged ${unk}; real found ${tp}/${realTotal}`,
);
for (const [k, [n, t]] of Object.entries(byRule).sort((a, b) => b[1][0] - a[1][0]))
  console.log(k.padEnd(14), n, "offered", t, "real");
// rows for fitting
{
  const out = [];
  for (const lec of new Set(J.map((j) => j.lecture))) {
    const text = readFileSync(dir + lec + ".txt", "utf8").replace(/\n/g, " ");
    for (const d of findDefinitions(text, { features: true })) {
      const r = real.get(key(lec, d.term));
      if (r === undefined) continue;
      out.push({ lec, term: d.term, def: d.definition, y: r ? 1 : 0, f: d.features, rule: d.rule });
    }
  }
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.OUT || "rows.json", JSON.stringify(out));
}
