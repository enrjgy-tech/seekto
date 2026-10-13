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
const NOT_NAMES = new Set("Back Next Up Due Go Turn Moving Time Need Remember Make Try Going Also Then So Now Today Tomorrow Monday Tuesday Wednesday Thursday Friday Saturday Sunday This That It There Here Everyone Someone Nobody Somebody Who What When Where Why How Please Thanks Thank Okay Ok Great Yes No Sure Right Well Legal Finance Marketing Sales Design Engineering Support Ops Product Let Lets".split(" "));

const EXPLICIT = /^(?:action items?|actions?|todo|to-do|to do|next steps?|follow[- ]ups?)\s*[:\-]\s*(.+)$/i;
const NAME = "([A-Z][a-z]+(?:\\s+(?:and|&)\\s+[A-Z][a-z]+)?)";
const WILL = new RegExp(`^${NAME}\\s+(?:will|'ll|is going to|are going to|needs? to|has to|have to|should|can)\\s+(.{4,})$`);
const NAME_TO = new RegExp(`^${NAME}\\s+to\\s+([a-z].{4,})$`);
const OWNS = new RegExp(`^${NAME}(?:'s|\\s+is|\\s+will)?\\s+(owns?|on point for|point on|taking|takes|handling|handles|driving|drives|leading|leads|responsible for|has the action (?:to|on))\\s+(.{4,})$`);
const VOCATIVE = new RegExp(`^${NAME},\\s*(?:can|could|would|will) you(?: please)?\\s+(.{4,}?)\\??$`);
const YOURS = new RegExp(`^${NAME},\\s*(?:it's|that's|this is) (?:yours|on you|all yours|your)\\b`);
const I_WILL = /^(I|we)(?:\s+(?:will|need to|have to|should|are going to|am going to)|'ll|'re going to|'m going to)\s+(?!need (?:someone|somebody))(.{4,})$/i;
const ASK = /^(?:can|could|would) you(?: please)?\s+(.{4,}?)\??$/i;
const SOMEONE = /^(?:(?:can|could|would) (?:someone|somebody|anyone|anybody)(?: please)?|(?:someone|somebody) (?:needs to|has to|should|must)|(?:we|we'll|we will|we're going to) need (?:someone|somebody) to)\s+(.{4,}?)\??$/i;
const PLEASE = /^please\s+(.{4,})$/i;
const LETS = /^let's\s+(?!go with\b)(.{4,})$/i;
const FOLLOW_ON = /^(?:he|she|they|it|this|that)(?:'ll| will| needs to| has to| should| must)\s+(.{4,})$/i;
// Things people say to run a meeting, not tasks.
const FILLER = /^let's\s+(?:get (?:started|going)|begin|start|kick (?:it|things) off|wrap (?:it |this )?up|move on|dive in|jump in|take a (?:look|break|step back)|see|recap|go around|circle back|pause|keep going|talk about)\b/i;
const LEAD = /^(?:so|okay|ok|and|then|great|alright|right|also|um|uh|like|well|cool|perfect|good)\b,?\s*/i;
const INLINE = /,\s*(?:uh|um|like|you know|I guess|basically)\s*,/gi;
const VERB_FOR = { own: "Own", owns: "Own", "on point for": "Lead", "point on": "Lead", taking: "Take", takes: "Take", handling: "Handle", handles: "Handle", driving: "Drive", drives: "Drive", leading: "Lead", leads: "Lead", "responsible for": "Own" };

function ownerName(raw) {
  if (/^i$/i.test(raw)) return "Me";
  if (/^we$/i.test(raw)) return "Team";
  return raw.replace(/\s*&\s*/, " and ");
}

function leadless(s) {
  let c = s.replace(INLINE, " ");
  for (let i = 0; i < 4 && LEAD.test(c); i++) c = c.replace(LEAD, "");
  return c.trim();
}

const isName = (n) => !NOT_NAMES.has(n.split(/\s/)[0]);

/** One clause -> { owner, task } or null. */
function readClause(clean) {
  let m;
  if ((m = clean.match(EXPLICIT))) {
    const inner = leadless(m[1]);
    return readClause(inner) || { owner: null, task: inner };
  }
  if ((m = clean.match(OWNS)) && isName(m[1])) return { owner: ownerName(m[1]), task: `${VERB_FOR[m[2].toLowerCase()] || "Own"} ${m[3]}` };
  if ((m = clean.match(VOCATIVE)) && isName(m[1])) return { owner: ownerName(m[1]), task: m[2] };
  if ((m = clean.match(WILL) || clean.match(NAME_TO)) && isName(m[1])) return { owner: ownerName(m[1]), task: m[2] };
  if ((m = clean.match(SOMEONE))) return { owner: null, task: m[1] };
  if ((m = clean.match(I_WILL))) return /\?$/.test(clean) ? null : { owner: ownerName(m[1]), task: m[2] };
  if ((m = clean.match(ASK) || clean.match(PLEASE))) return { owner: null, task: m[1] };
  if ((m = clean.match(LETS))) return { owner: "Team", task: m[1] };
  return null;
}

/**
 * Action items in a meeting: [{ task, owner, due, sentence }].
 * owner is a name, "Me", "Team", or null when nobody was named; due is "YYYY-MM-DD" or null.
 */
export function findActionItems(text, { ref = new Date(), locale } = {}) {
  const out = [];
  const seen = new Set();
  const list = sentences(tidy(text));
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const clean = leadless(s);
    if ((DECISION.some((re) => re.test(clean)) && !EXPLICIT.test(clean)) || FILLER.test(clean)) continue;
    // "Who's going to own the year-end report? Okay, Rosa, it's yours."
    const yours = clean.match(YOURS);
    if (yours && isName(yours[1])) {
      const asked = (list[i - 1] || "").match(/who(?:'s| is) going to\s+(.+?)\?/i) || (list[i - 1] || "").match(/who (?:wants|can) (?:to )?(.+?)\?/i);
      add(ownerName(yours[1]), asked ? asked[1] : "Follow up", s);
      continue;
    }
    // "He'll have a first draft in two weeks" gives the last item its date.
    const follow = clean.match(FOLLOW_ON);
    if (follow && out.length) {
      const last = out[out.length - 1];
      if (!last.due) last.due = findDates(s, ref, { locale })[0]?.date || null;
      continue;
    }
    // "Carlos will follow up with the agency, and Mei to circulate the minutes tomorrow."
    const clauses = clean.split(/,?\s+and\s+(?:,\s*)?(?=(?:[A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)?\s+(?:will|'ll|to|is going to|needs? to|owns?|can|should)\b|I(?:'ll|\s+will)\b|we'll\b))/);
    // "Ana and Joe will draft it" is one clause with two owners
    for (let k = clauses.length - 1; k > 0; k--) if (/(?:^|[:\s])[A-Z][a-z]+$/.test(clauses[k - 1].trim())) clauses.splice(k - 1, 2, `${clauses[k - 1]} and ${clauses[k]}`);
    for (const clause of clauses) {
      const item = readClause(leadless(clause));
      if (item) add(item.owner, item.task, s, clause);
    }
  }
  return out;

  function add(owner, rawTask, sentence, clause = sentence) {
    if (!rawTask || /\?$/.test(rawTask.trim()) && !/\?$/.test(sentence)) return;
    const task = cap(end(rawTask.replace(INLINE, " ").replace(/\s+/g, " ")));
    if (task.length < 4) return;
    const key = `${owner}|${task.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ task, owner, due: findDates(clause, ref, { locale })[0]?.date || null, sentence });
  }
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
    for (const a of actions) lines.push(`- ${a.owner || "Unassigned"}: ${a.task}${a.due ? ` (by ${formatDate(a.due)})` : ""}`);
    lines.push("");
  }
  if (!decisions.length && !actions.length) lines.push("I didn't catch any decisions or action items. Reply if I missed something.", "");
  else lines.push("Let me know if I missed or got anything wrong.", "");
  lines.push("Thanks!");
  return { subject: `Follow-up: ${title}`, body: lines.join("\n") };
}
