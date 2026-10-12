// Meetings: decisions, action items (who, what, by when) and a follow-up email, found in what
// was said or typed. Works without AI; an AI model can do better, but this is the baseline.
import { sentences, findDates } from "./dates.js";

const tidy = (s) => String(s).replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const strip = (s) => s.replace(/^(?:so|okay|ok|and|then|great|alright|right|also|um|uh),?\s+/i, "");
const end = (s) => s.replace(/[\s.!?;,]+$/, "");

const DECISION = [
  /\b(?:we|we've|we have|the team|everyone|they)\s+(?:decided|agreed|chose|settled on|signed off)\b/i,
  /^decision\s*[:\-]/i,
  /\b(?:let's|we'll|we will|we're going to|we are going to)\s+go with\b/i,
  /\bfinal (?:call|decision) is\b/i,
  /\b(?:it's|it is) decided\b/i,
  /\bagreed (?:to|that|on)\b/i,
];

/** Sentences that record a decision. */
export function findDecisions(text) {
  const out = [];
  for (const s of sentences(tidy(text))) {
    const clean = strip(s);
    if (/\?$/.test(clean)) continue;
    if (DECISION.some((re) => re.test(clean))) out.push({ text: cap(end(clean.replace(/^decision\s*[:\-]\s*/i, ""))), sentence: s });
  }
  return out;
}

// Capitalized words that start sentences but aren't people.
const NOT_NAMES = new Set("Back Next Up Due Go Turn Moving Time Need Remember Make Try Going Also Then So Now Today Tomorrow Monday Tuesday Wednesday Thursday Friday Saturday Sunday This That It There Here Everyone Someone Nobody Somebody Who What When Where Why How Please Thanks Thank Okay Ok Great Yes No Sure Right Well".split(" "));

const EXPLICIT = /^(?:action items?|actions?|todo|to-do|to do|next steps?|follow[- ]ups?)\s*[:\-]\s*(.+)$/i;
const NAME = "([A-Z][a-z]+(?:\\s+(?:and|&)\\s+[A-Z][a-z]+)?)";
const WILL = new RegExp(`^${NAME}\\s+(?:will|'ll|is going to|are going to|needs? to|has to|have to|should|can)\\s+(.{6,})$`);
const NAME_TO = new RegExp(`^${NAME}\\s+to\\s+([a-z].{5,})$`);
const I_WILL = /^(I|we)(?:\s+(?:will|need to|have to|should|are going to|am going to)|'ll|'re going to|'m going to)\s+(.{6,})$/i;
const ASK = /^(?:can|could|would) you(?: please)?\s+(.{6,}?)\??$/i;
const PLEASE = /^please\s+(.{6,})$/i;
const LETS = /^let's\s+(?!go with\b)(.{6,})$/i;
// Things people say to run a meeting, not tasks.
const FILLER = /^let's\s+(?:get (?:started|going)|begin|start|kick (?:it|things) off|wrap (?:it |this )?up|move on|dive in|jump in|take a (?:look|break|step back)|see|recap|go around|circle back|pause|keep going|talk about)\b/i;

function ownerName(raw) {
  if (/^i$/i.test(raw)) return "Me";
  if (/^we$/i.test(raw)) return "Team";
  return raw.replace(/\s*&\s*/, " and ");
}

/**
 * Action items in a meeting: [{ task, owner, due, sentence }].
 * owner is a name, "Me", "Team", or null when nobody was named; due is "YYYY-MM-DD" or null.
 */
export function findActionItems(text, { ref = new Date() } = {}) {
  const out = [];
  const seen = new Set();
  for (const s of sentences(tidy(text))) {
    const clean = strip(s);
    if ((DECISION.some((re) => re.test(clean)) && !EXPLICIT.test(clean)) || FILLER.test(clean)) continue;
    let owner = null;
    let task = null;
    let m;
    if ((m = clean.match(EXPLICIT))) {
      const inner = strip(m[1]);
      const who = inner.match(WILL) || inner.match(NAME_TO);
      if (who && !NOT_NAMES.has(who[1])) { owner = ownerName(who[1]); task = who[2]; } else task = inner;
    } else if ((m = clean.match(WILL) || clean.match(NAME_TO)) && !NOT_NAMES.has(m[1].split(/\s/)[0])) {
      owner = ownerName(m[1]);
      task = m[2];
    } else if ((m = clean.match(I_WILL))) {
      if (/\?$/.test(clean)) continue;
      owner = ownerName(m[1]);
      task = m[2];
    } else if ((m = clean.match(ASK) || clean.match(PLEASE))) {
      task = m[1];
    } else if ((m = clean.match(LETS))) {
      owner = "Team";
      task = m[1];
    }
    if (!task || /\?$/.test(task)) continue;
    task = cap(end(task));
    const key = `${owner}|${task.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ task, owner, due: findDates(s, ref)[0]?.date || null, sentence: s });
  }
  return out;
}

/** A plain follow-up email. `formatDate` turns "YYYY-MM-DD" into words. */
export function followUpEmail({ title = "our meeting", decisions = [], actions = [], formatDate = (d) => d } = {}) {
  const lines = ["Hi all,", "", `Thanks for joining ${title === "our meeting" ? "the meeting" : title}. Here's a quick recap so we're all on the same page.`, ""];
  if (decisions.length) {
    lines.push("Decisions:");
    for (const d of decisions) lines.push(`- ${d.text}`);
    lines.push("");
  }
  if (actions.length) {
    lines.push("Action items:");
    for (const a of actions) lines.push(`- ${a.owner && a.owner !== "Team" ? `${a.owner === "Me" ? "Me" : a.owner}: ` : ""}${a.task}${a.due ? ` (by ${formatDate(a.due)})` : ""}`);
    lines.push("");
  }
  if (!decisions.length && !actions.length) lines.push("I didn't catch any decisions or action items. Reply if I missed something.", "");
  else lines.push("Let me know if I missed or got anything wrong.", "");
  lines.push("Thanks!");
  return { subject: `Follow-up: ${title}`, body: lines.join("\n") };
}
