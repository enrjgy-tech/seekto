// Measure the engine on a labelled set of sentences (engine/bench/data/*.jsonl).
// The sentences were written by people who never saw the rules, so the engine can't be
// tuned to them by accident. Half of the set is held out: items with an even number are
// "test" and their mistakes are never printed, only counted. Fix rules using "dev" only.
//
//   node engine/bench/run.mjs            # scores for dev, test and all
//   node engine/bench/run.mjs --show     # also print every dev mistake
//   node engine/bench/run.mjs --json     # machine-readable results
//   node engine/bench/run.mjs --check    # fail if the held-out scores drop below floor.json (CI)
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { findEvents, findDefinitions, findActionItems } from "../src/index.js";

const dir = fileURLToPath(new URL("./data/", import.meta.url));
const args = new Set(process.argv.slice(2));

const items = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().flatMap((file) =>
  readFileSync(dir + file, "utf8").split("\n").filter(Boolean).map((line) => ({ file, ...JSON.parse(line) })));

const split = (item) => (Number(item.id.match(/(\d+)$/)[1]) % 2 === 0 ? "test" : "dev");
const refDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const normTerm = (t) => String(t).toLowerCase().replace(/^(the|a|an|el|la|los|las|un|una|o|os|as)\s+/, "").replace(/[^\p{L}\d ]/gu, "").trim();
const sameTerm = (a, b) => { a = normTerm(a); b = normTerm(b); return a === b || (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))); };
const normOwner = (o) => (o == null ? null : String(o).toLowerCase());

function blank() { return { tp: 0, fp: 0, fn: 0 }; }
function prf({ tp, fp, fn }) {
  const p = tp + fp ? tp / (tp + fp) : 1;
  const r = tp + fn ? tp / (tp + fn) : 1;
  return { precision: p, recall: r, f1: p + r ? (2 * p * r) / (p + r) : 0, tp, fp, fn };
}

const totals = {};
const mistakes = [];
for (const item of items) {
  const s = split(item);
  for (const key of [s, "all"]) totals[key] ??= { events: blank(), definitions: blank(), actions: blank(), owners: { right: 0, total: 0 }, dues: { right: 0, total: 0 }, items: 0, perfect: 0 };
  const ref = refDate(item.ref);
  const wrong = [];

  // Deadlines and tests: compare the set of dates.
  // Meeting files label calendar events only loosely (writers were told to leave them empty),
  // so meetings are scored on action items and their due dates instead.
  const ev = { tp: 0, fp: 0, fn: 0 };
  if (!/^meetings/.test(item.file)) {
    const gotDates = [...new Set(findEvents(item.text, { ref, locale: item.locale }).map((e) => e.date))];
    const wantDates = [...new Set(item.events.map((e) => e.date))];
    ev.tp = gotDates.filter((d) => wantDates.includes(d)).length;
    ev.fp = gotDates.length - ev.tp;
    ev.fn = wantDates.length - ev.tp;
    if (ev.fp || ev.fn) wrong.push(`dates: got [${gotDates}] want [${wantDates}]`);
  }

  // Definitions: only scored in files that label them.
  let df = { tp: 0, fp: 0, fn: 0 };
  const scoresDefs = /^(defs|es-pt)/.test(item.file);
  if (scoresDefs) {
    const got = findDefinitions(item.text, { lang: item.lang }).map((d) => d.term);
    const want = item.definitions.map((d) => d.term);
    const used = new Set();
    for (const w of want) {
      const i = got.findIndex((g, j) => !used.has(j) && sameTerm(g, w));
      if (i >= 0) { used.add(i); df.tp++; } else df.fn++;
    }
    df.fp = got.length - used.size;
    if (df.fp || df.fn) wrong.push(`definitions: got [${got}] want [${want}]`);
  }

  // Action items: only scored in meeting files. A found item counts if one is expected;
  // owners are checked in order.
  let ac = { tp: 0, fp: 0, fn: 0 };
  const owners = { right: 0, total: 0 };
  const dues = { right: 0, total: 0 };
  if (/^meetings/.test(item.file)) {
    const got = findActionItems(item.text, { ref });
    const want = item.actions;
    ac.tp = Math.min(got.length, want.length);
    ac.fp = Math.max(0, got.length - want.length);
    ac.fn = Math.max(0, want.length - got.length);
    const remaining = got.map((g) => ({ owner: normOwner(g.owner), due: g.due }));
    for (const w of want) {
      if (!got.length) break;
      owners.total++;
      const i = remaining.findIndex((g) => g.owner === normOwner(w.owner));
      if (i >= 0) {
        owners.right++;
        dues.total++;
        if ((remaining[i].due || null) === (w.due || null)) dues.right++;
        remaining.splice(i, 1);
      }
    }
    if (ac.fp || ac.fn || owners.right < owners.total || dues.right < dues.total) wrong.push(`actions: got [${got.map((g) => `${g.owner ?? "nobody"}: ${g.task}${g.due ? ` (by ${g.due})` : ""}`).join(" | ")}] want [${want.map((w) => `${w.owner ?? "nobody"}${w.due ? ` by ${w.due}` : ""}`).join(", ")}]`);
  }

  for (const key of [s, "all"]) {
    const t = totals[key];
    for (const [name, part] of [["events", ev], ["definitions", df], ["actions", ac]]) for (const k of ["tp", "fp", "fn"]) t[name][k] += part[k];
    t.owners.right += owners.right;
    t.owners.total += owners.total;
    t.dues.right += dues.right;
    t.dues.total += dues.total;
    t.items++;
    if (!wrong.length) t.perfect++;
  }
  if (wrong.length && s === "dev") mistakes.push({ id: item.id, locale: item.locale, ref: item.ref, text: item.text, wrong, note: item.note });
}

const result = {};
for (const [key, t] of Object.entries(totals)) {
  result[key] = {
    items: t.items,
    perfect: t.perfect,
    deadlines: prf(t.events),
    definitions: prf(t.definitions),
    actionItems: prf(t.actions),
    owners: t.owners.total ? t.owners.right / t.owners.total : 1,
    dueDates: t.dues.total ? t.dues.right / t.dues.total : 1,
  };
}

if (args.has("--check")) {
  const floor = JSON.parse(readFileSync(new URL("./floor.json", import.meta.url), "utf8"));
  const t = result.test;
  const now = { deadlinesRecall: t.deadlines.recall, deadlinesPrecision: t.deadlines.precision, definitionsRecall: t.definitions.recall, definitionsPrecision: t.definitions.precision, actionItemsRecall: t.actionItems.recall, actionItemsPrecision: t.actionItems.precision };
  const drops = Object.entries(floor).filter(([k, v]) => now[k] + 1e-9 < v);
  for (const [k, v] of Object.entries(floor)) console.log(`${now[k] + 1e-9 < v ? "DROP" : "ok  "} ${k}: ${(now[k] * 100).toFixed(1)}% (floor ${(v * 100).toFixed(1)}%)`);
  if (drops.length) { console.error("\nHeld-out accuracy dropped. A rule change made the engine worse on sentences it was never tuned on."); process.exit(1); }
} else if (args.has("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const pct = (x) => `${Math.round(x * 100)}%`;
  for (const key of ["dev", "test", "all"]) {
    const r = result[key];
    console.log(`\n${key.toUpperCase()} (${r.items} items, ${r.perfect} fully right)`);
    console.log(`  deadlines     found ${r.deadlines.tp} of ${r.deadlines.tp + r.deadlines.fn} (recall ${pct(r.deadlines.recall)}), ${r.deadlines.fp} false alarms (precision ${pct(r.deadlines.precision)})`);
    console.log(`  definitions   found ${r.definitions.tp} of ${r.definitions.tp + r.definitions.fn} (recall ${pct(r.definitions.recall)}), ${r.definitions.fp} false (precision ${pct(r.definitions.precision)})`);
    console.log(`  action items  found ${r.actionItems.tp} of ${r.actionItems.tp + r.actionItems.fn} (recall ${pct(r.actionItems.recall)}), ${r.actionItems.fp} extra (precision ${pct(r.actionItems.precision)}), owners right ${pct(r.owners)}, due dates right ${pct(r.dueDates)}`);
  }
  if (args.has("--show")) {
    console.log(`\nDev mistakes (${mistakes.length}):`);
    for (const m of mistakes) console.log(`\n${m.id} [${m.locale}, said ${m.ref}] ${m.text}\n  ${m.wrong.join("\n  ")}${m.note ? `\n  note: ${m.note}` : ""}`);
  }
}
