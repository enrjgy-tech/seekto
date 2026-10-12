// Find dates and deadlines in spoken or written text, such as
// "the essay is due October 20th" or "quiz on Friday".
// All dates are local calendar days returned as "YYYY-MM-DD".

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY_RE = "(\\d{1,2})(?:st|nd|rd|th)?";

// Event words, most specific first. The first match decides the type.
const EVENT_WORDS = [
  ["midterm", "test"], ["final exam", "test"], ["final", "test"], ["exam", "test"], ["test", "test"], ["quiz", "test"],
  ["essay", "assignment"], ["paper", "assignment"], ["project", "assignment"], ["homework", "assignment"],
  ["problem set", "assignment"], ["assignment", "assignment"], ["lab report", "assignment"], ["lab", "assignment"],
  ["report", "assignment"], ["presentation", "assignment"], ["reading", "assignment"], ["deadline", "assignment"],
  ["due", "assignment"],
];

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** A month and day with no year: this year, unless that is more than 30 days ago, then next year. */
function resolveYear(month, day, year, ref) {
  if (year) return new Date(year < 100 ? 2000 + year : year, month, day);
  const candidate = new Date(ref.getFullYear(), month, day);
  return candidate < addDays(ref, -30) ? new Date(ref.getFullYear() + 1, month, day) : candidate;
}

function valid(date, month, day) {
  return date.getMonth() === month && date.getDate() === day;
}

/**
 * Find every date mentioned in `text`, relative to `ref` (the day it was said).
 * Returns [{ date: "YYYY-MM-DD", index, match }] in order of appearance.
 */
export function findDates(text, ref = new Date()) {
  const source = String(text);
  const found = [];
  const add = (date, index, match) => found.push({ date: toISO(date), index, match });
  const today = startOfDay(ref);

  // "October 20", "Oct. 20th, 2026"
  for (const m of source.matchAll(new RegExp(`\\b${MONTH_RE}\\.?\\s+${DAY_RE}(?:,?\\s+(\\d{4}))?\\b`, "gi"))) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = Number(m[2]);
    const date = resolveYear(month, day, m[3] && Number(m[3]), today);
    if (valid(date, month, day)) add(date, m.index, m[0]);
  }
  // "20 October", "the 20th of October"
  for (const m of source.matchAll(new RegExp(`\\b${DAY_RE}\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`, "gi"))) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = Number(m[1]);
    const date = resolveYear(month, day, m[3] && Number(m[3]), today);
    if (valid(date, month, day)) add(date, m.index, m[0]);
  }
  // "10/20" or "10/20/2026" (month first)
  for (const m of source.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (month < 0 || month > 11) continue;
    const date = resolveYear(month, day, m[3] && Number(m[3]), today);
    if (valid(date, month, day)) add(date, m.index, m[0]);
  }
  // today, tonight, tomorrow
  for (const m of source.matchAll(/\b(today|tonight|tomorrow)\b/gi)) {
    add(m[1].toLowerCase() === "tomorrow" ? addDays(today, 1) : today, m.index, m[0]);
  }
  // "in 3 days", "in two weeks"
  for (const m of source.matchAll(/\bin\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|weeks?)\b/gi)) {
    const n = NUMBERS[m[1].toLowerCase()] ?? Number(m[1]);
    add(addDays(today, m[2].toLowerCase().startsWith("week") ? n * 7 : n), m.index, m[0]);
  }
  // "Friday", "on Friday", "next Friday". A bare or "on/this/by" weekday is its next occurrence
  // (the same weekday as today means a week from today); "next" adds a week to that.
  for (const m of source.matchAll(/\b(?:(next|this|on|by|until)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)) {
    const target = WEEKDAYS[m[2].toLowerCase()];
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if ((m[1] || "").toLowerCase() === "next") diff += 7;
    add(addDays(today, diff), m.index, m[0]);
  }
  return found.sort((a, b) => a.index - b.index);
}

const TITLE_SKIP = new Set(["the", "a", "an", "our", "your", "my", "their", "his", "her", "this", "that", "is", "are", "will", "be", "and", "so", "next", "big", "on"]);

/** Split text into sentences. */
export function sentences(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// EVENT_WORDS is ordered most specific first, with "due" last, so the first match wins.
function eventWord(sentence) {
  const lower = sentence.toLowerCase();
  for (const [word, type] of EVENT_WORDS) {
    const m = lower.match(new RegExp(`\\b${word}s?\\b`));
    if (m) return { word, type, index: m.index, text: sentence.slice(m.index, m.index + m[0].length) };
  }
  return null;
}

function titleFor(sentence, hit, subject) {
  const due = sentence.toLowerCase().search(/\b(due|deadline)\b/);
  if (due >= 0 && hit.type === "assignment") hit = { ...hit, word: "due", index: due };
  if (hit.word === "due" || hit.word === "deadline") {
    // "the lab write-up is due Friday" -> words before "due"
    const before = sentence.slice(0, hit.index).split(/\s+/).filter(Boolean);
    const words = [];
    for (let i = before.length - 1; i >= 0 && words.length < 4; i--) {
      const w = before[i].replace(/[^\w'-]/g, "");
      if (!w) continue;
      if (TITLE_SKIP.has(w.toLowerCase())) { if (words.length) break; continue; }
      words.unshift(w);
    }
    const name = words.length ? words.join(" ") : "Assignment";
    const withSubject = subject && !name.toLowerCase().includes(subject.toLowerCase()) ? `${subject} ${name}` : name;
    return capitalize(`${withSubject} due`);
  }
  // Up to three meaningful words before the event word: "chapter 5 quiz"
  const before = sentence.slice(0, hit.index).split(/\s+/).filter(Boolean);
  const lead = [];
  for (let i = before.length - 1; i >= 0 && lead.length < 3; i--) {
    const w = before[i].replace(/[^\w'-]/g, "");
    if (!w || TITLE_SKIP.has(w.toLowerCase()) || /^(on|by|for|of|in|at|to|have|has|we|you|there)$/i.test(w)) break;
    lead.unshift(w);
  }
  const core = [...lead, hit.text].join(" ");
  const withSubject = subject && !core.toLowerCase().includes(subject.toLowerCase()) ? `${subject} ${core}` : core;
  return capitalize(withSubject);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Find tests and assignment deadlines: sentences that mention an event word and a date.
 * Returns [{ date, type: "test"|"assignment", title, sentence }].
 */
export function findEvents(text, { ref = new Date(), subject = null } = {}) {
  const events = [];
  const seen = new Set();
  for (const sentence of sentences(text)) {
    const hit = eventWord(sentence);
    if (!hit) continue;
    const dates = findDates(sentence, ref);
    if (!dates.length) continue;
    // Prefer the date closest after the event word, otherwise the first one.
    const after = dates.find((d) => d.index >= hit.index) || dates[0];
    const title = titleFor(sentence, hit, subject);
    const key = `${after.date}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ date: after.date, type: hit.type, title, sentence });
  }
  return events;
}
