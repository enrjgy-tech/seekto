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
const NAME = "(\\p{Lu}\\p{Ll}+(?:\\s+(?:and|&)\\s+\\p{Lu}\\p{Ll}+)?)";
// One or more people spoken to: "Luis,", "Kofi and Mei,", "Hannah, Ben,"
const PEOPLE = "(\\p{Lu}\\p{Ll}+(?:(?:,\\s*|\\s+(?:and|&)\\s+)\\p{Lu}\\p{Ll}+)*)";
// What follows a name when someone is given a task: "Priya, you're pulling her drain tomorrow",
// "Pete, have the punch list printed", "Luis, I need that inspection signed off", "Margaret, the board is asking you to ..."
const IMPERATIVE = "make sure|have|call|take|get|send|pull|keep|bring|check|book|draft|write|confirm|set up|reach out to|reach out|follow up|update|schedule|email|print|finish|fix|grab|loop in|ping|order|review|prepare|put together|start|handle|cover|run|share|post|file|submit|look into|find|figure out|talk to|let|tell|ask|text|coordinate|organize|clean up|move|cancel|order";
const DIRECTED = new RegExp(`^${PEOPLE},\\s*(?:(you(?:'re| are)(?: in charge of| on| responsible for)?|you(?:'ll| will)|you(?: two| both| guys| all)?(?: own| take| handle| lead)|(?:please\\s+)?(?:${IMPERATIVE})(?![\\p{L}])|please|I need|I want|we need|the .{2,40}? is (?:asking|going to need) you to|(?:the |this |that )?.{0,40}?(?:is|'s) (?:yours|on you|all yours))(.*))$`, "u");
const WILL = new RegExp(`^${NAME}\\s+(?:will|'ll|is going to|are going to|needs? to|has to|have to|should|can)\\s+(.{4,})$`, "u");
const NAME_TO = new RegExp(`^${NAME}\\s+to\\s+([a-z].{4,})$`, "u");
const OWNS = new RegExp(`^${NAME}(?:'s|\\s+is|\\s+will)?\\s+(owns?|on point for|point on|taking|takes|handling|handles|driving|drives|leading|leads|responsible for|has the action (?:to|on))\\s+(.{4,})$`, "u");
const VOCATIVE = new RegExp(`^${NAME},\\s*(?:can|could|would|will) you(?: please)?\\s+(.{4,}?)\\??$`, "u");
const YOURS = new RegExp(`^${NAME},\\s*(?:it's|that's|this is) (?:yours|on you|all yours|your)\\b`, "u");
const I_WILL = /^(I|we)(?:\s+(?:will|need to|have to|should|are going to|am going to)|'ll|'re going to|'m going to)\s+(?!need (?:someone|somebody))(.{4,})$/i;
const ASK = /^(?:can|could|would) you(?: please)?\s+(.{4,}?)\??$/i;
const SOMEONE = /^(?:(?:can|could|would) (?:someone|somebody|anyone|anybody)(?: please)?(?: volunteer to)?|(?:someone|somebody)(?:'s| has) (?:gotta|got to)|(?:someone|somebody) (?:needs to|has to|should|must|gotta)|(?:we|we'll|we will|we're going to) need (?:someone|somebody) to)\s+(.{4,}?)\??$/i;
const PLEASE = /^please\s+(.{4,})$/i;
const LETS = /^let's\s+(?!go with\b)(.{4,})$/i;
const FOLLOW_ON = /^(?:he|she|they|it|this|that)(?:'ll| will| needs to| has to| should| must)\s+(.{4,})$/i;
// Things people say to run a meeting, not tasks.
const FILLER = /^(?:let's\s+(?:be (?:real|honest)|face it|get (?:started|going)|begin|start|kick (?:it|things) off|wrap (?:it |this )?up|move on|dive in|jump in|take a (?:look|break|step back)|see|recap|go around|circle back|pause|keep going|talk about)|we'll see\b)\b/i;
const LEAD = /^(?:so|okay|ok|and|then|great|alright|right|also|um|uh|like|well|cool|perfect|good|last thing|one more thing|one last thing|quick reassignment|before we adjourn|from now on|moving on|first|second|finally)\b,?\s*/i;
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

const isName = (n) => !NOT_NAMES.has(n.split(/[\s,]/)[0]);
const people = (raw) => raw.split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean).join(" and ");

// "pulling her drain" -> "pull her drain", "splitting" -> "split", "making" -> "make"
function baseVerb(task) {
  return task.replace(/^(\p{L}+?)ing\b/iu, (all, stem) => {
    if (/([^lsz])\1$/i.test(stem)) return stem.slice(0, -1);
    if (stem.length <= 4 && /[^aeiou][aeiou][^aeiouwxy]$/i.test(stem)) return `${stem}e`;
    return stem;
  });
}

/** "Name, <a task for them>" -> { owner, task } or null. */
function directed(clean) {
  const m = clean.match(DIRECTED);
  if (!m || !m[1].split(/\s*(?:,|\band\b|&)\s*/).every((n) => n && isName(n))) return null;
  const how = m[2].toLowerCase();
  let task = m[3].trim().replace(/^[,:]\s*/, "");
  if (/^you(?:'re| are)/.test(how)) task = baseVerb(task.replace(/^(?:in charge of|responsible for)\s+/i, ""));
  else if (/is (?:asking|going to need) you to$/.test(how)) task = task;
  else if (/(?:yours|on you)$/.test(how)) task = `Own ${how.replace(/\s*(?:is|'s) (?:yours|on you|all yours)$/, "").replace(/^(?:the|this|that)\s+/, "the ")}`;
  else if (/^(?:i|we) (?:need|want)$/.test(how)) task = task.replace(/\s+from (?:both of you|you two|you both|you guys|you all|you)\b/i, "");
  else if (/^you/.test(how)) task = `${how.replace(/^you(?:'ll| will| two| both| guys| all)?\s*/, "")} ${task}`.trim();
  else if (how !== "please") task = `${how.replace(/^please\s+/, "")} ${task}`;
  // The task, not what the speaker adds after it: "..., and we need it locked by 10/30"
  task = task.replace(/^please\s+/i, "").replace(/\?$/, "").replace(/,\s+(?:and\s+)?(?:I|we)\s+(?:want|need)\b.*$/i, "");
  return task.length >= 4 ? { owner: people(m[1]), task } : null;
}

/** One clause -> { owner, task } or null. */
function readClause(clean) {
  let m;
  if ((m = clean.match(EXPLICIT))) {
    const inner = leadless(m[1]);
    return readClause(inner) || { owner: null, task: inner };
  }
  if ((m = clean.match(OWNS)) && isName(m[1])) return { owner: ownerName(m[1]), task: `${VERB_FOR[m[2].toLowerCase()] || "Own"} ${m[3]}` };
  if ((m = clean.match(VOCATIVE)) && isName(m[1])) return { owner: ownerName(m[1]), task: m[2] };
  const told = directed(clean);
  if (told) return told;
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
    // A task given to someone mid-sentence starts a new part: "..., so Sam, make sure ...",
    // "..., and David, please have ...", "From now on, Marco, you're doing lockup."
    const parts = clean.split(new RegExp(`(?<!(?:^|[,\\s])\\p{Lu}\\p{Ll}+)(?:[,;]\\s+(?:and\\s+|so\\s+)?|\\s+(?:and|so)\\s+)(?=${PEOPLE},\\s*(?:you(?:'re|'ll| are| will| two| both| guys)?\\b|can you|could you|would you|will you|please|I need|I want|we need|the .{2,40}? is asking you|(?:${IMPERATIVE})(?![\\p{L}])))|,\\s+(?:and\\s+)?(?=let's\\b|(?:can|could) (?:someone|somebody|anyone)\\b|(?:someone|somebody)(?:'s)? (?:needs|has|gotta|got)\\b)`, "u")).filter((x) => x && x.trim());
    for (const part of parts) readPart(leadless(part), s);
  }
  return out;

  function readPart(clean, s) {
    // "Carlos will follow up with the agency, and Mei to circulate the minutes tomorrow."
    const clauses = clean.split(/,?\s+and\s+(?:,\s*)?(?=(?:[A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)?\s+(?:will|'ll|to|is going to|needs? to|owns?|can|should)\b|I(?:'ll|\s+will)\b|we'll\b|let's\b))/);
    // "Ana and Joe will draft it" is one clause with two owners
    for (let k = clauses.length - 1; k > 0; k--) if (/(?:^|[:\s])[A-Z][a-z]+$/.test(clauses[k - 1].trim())) clauses.splice(k - 1, 2, `${clauses[k - 1]} and ${clauses[k]}`);
    for (const clause of clauses) {
      const item = readClause(leadless(clause));
      if (item) add(item.owner, item.task, s, clause);
    }
  }

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
