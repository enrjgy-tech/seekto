// Understand common study questions and answer them from the person's own notes and calendar,
// with no AI model. Anything else is handed to the model, if one is connected.
import { fromISO, toISO } from "./dates.js";
import { findDefinitions } from "./study.js";
import { buildIndex, search } from "./search.js";

const TEST_WORDS = "test|exam|quiz|midterm|final";

/** Work out what the person is asking for. */
export function classify(message) {
  const text = String(message).trim();
  const lower = text.toLowerCase().replace(/[?!.]+$/, "");
  let m;
  if ((m = lower.match(new RegExp(`\\bwhen(?:'s| is| are)?\\s+(?:my|the|our)?\\s*(?:next\\s+)?(.*?)\\s*\\b(${TEST_WORDS})s?\\b`)))) {
    return { intent: "next-test", subject: m[1].trim() || null };
  }
  if ((m = lower.match(/\bwhen(?:'s| is)\s+(?:my|the|our)\s+(.+?)\s+(?:due)\b/))) {
    return { intent: "when-due", subject: m[1].trim() };
  }
  if (/\b(what'?s|what is|anything)\s+(due|coming up)\b|\bwhat do i have\b|\bupcoming\b|\bdue (today|tomorrow|this week)\b|\bmy (schedule|calendar)\b/.test(lower)) {
    const range = /\btoday\b/.test(lower) ? "today" : /\btomorrow\b/.test(lower) ? "tomorrow" : /\bthis week\b/.test(lower) ? "week" : "soon";
    return { intent: "due", range };
  }
  if ((m = lower.match(/\b(?:quiz|test) me(?:\s+(?:on|about)\s+(.+))?$|\bhelp me (?:study|review)(?:\s+(?:for|on)?\s*(.+))?$|\bmake (?:me )?(?:a )?(?:practice )?(?:test|quiz)(?:\s+(?:on|about|for)\s+(.+))?$/))) {
    return { intent: "quiz", topic: (m[1] || m[2] || m[3] || "").trim() || null };
  }
  if ((m = lower.match(/^(?:what(?:'s| is| are| does)|define|meaning of|what do we mean by)\s+(?:a |an |the )?(.+?)(?:\s+mean)?$/))) {
    return { intent: "define", term: m[1].trim() };
  }
  if (/\b(start )?record(ing)?\b/.test(lower) && lower.split(/\s+/).length <= 5) return { intent: "record" };
  if (/\b(research|rubric|outline|essay|sources)\b/.test(lower)) return { intent: "research" };
  return { intent: "general" };
}

function daysBetween(fromIso, toIso) {
  return Math.round((fromISO(toIso) - fromISO(fromIso)) / 86400000);
}

/** "today", "tomorrow", "Friday, Oct 16 (in 4 days)" */
export function describeDay(iso, today) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  const d = fromISO(iso);
  const label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return diff > 1 ? `${label} (in ${diff} days)` : `${label} (${-diff} days ago)`;
}

function matchesSubject(event, subject) {
  if (!subject) return true;
  const hay = `${event.title} ${event.subject || ""}`.toLowerCase();
  return subject.toLowerCase().split(/\s+/).every((w) => hay.includes(w.replace(/s$/, "")));
}

function upcoming(events, today) {
  return events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Answer a classified question from local data. Returns { text, needsModel, items? }.
 * data: { notes: [{ id, title, subject, text, date }], events: [{ title, date, type, subject }], today: "YYYY-MM-DD" }
 */
export function answerLocally(parsed, { notes = [], events = [], today = toISO(new Date()) } = {}) {
  switch (parsed.intent) {
    case "next-test": {
      const list = upcoming(events, today).filter((e) => (e.type === "test" || /test|exam|quiz|midterm|final/i.test(e.title)) && matchesSubject(e, parsed.subject));
      if (!list.length) {
        const what = parsed.subject ? `${parsed.subject} test` : "test";
        return { text: `I don't see an upcoming ${what} in your calendar. Record the class where it's announced, or import your school calendar, and I'll catch it.` };
      }
      const [next, ...rest] = list;
      const more = rest.length ? ` After that: ${rest.slice(0, 2).map((e) => `${e.title}, ${describeDay(e.date, today)}`).join("; ")}.` : "";
      return { text: `Your next one is ${next.title}, ${describeDay(next.date, today)}.${more}`, items: list };
    }
    case "when-due": {
      const list = upcoming(events, today).filter((e) => matchesSubject(e, parsed.subject));
      if (!list.length) return { text: `I don't see "${parsed.subject}" in your calendar yet.` };
      return { text: `${list[0].title} is ${describeDay(list[0].date, today)}.`, items: list };
    }
    case "due": {
      const span = { today: 0, tomorrow: 1, week: 7, soon: 14 }[parsed.range];
      const start = parsed.range === "tomorrow" ? 1 : 0;
      const list = upcoming(events, today).filter((e) => {
        const d = daysBetween(today, e.date);
        return d >= start && d <= span;
      });
      const when = { today: "today", tomorrow: "tomorrow", week: "this week", soon: "in the next two weeks" }[parsed.range];
      if (!list.length) return { text: `Nothing on your calendar ${when}.` };
      return { text: `Coming up ${when}: ${list.map((e) => `${e.title} (${describeDay(e.date, today)})`).join("; ")}.`, items: list };
    }
    case "define": {
      const term = parsed.term.toLowerCase();
      for (const note of notes) {
        const def = findDefinitions(note.text).find((d) => d.term.toLowerCase() === term || d.term.toLowerCase().includes(term));
        if (def) return { text: `${def.term}: ${def.definition}.`, source: note };
      }
      const hit = searchNotes(notes, parsed.term)[0];
      if (hit) return { text: `From your notes on ${hit.note.title}: "${hit.line}"`, source: hit.note, needsModel: true };
      return { text: `I couldn't find "${parsed.term}" in your notes.`, needsModel: true };
    }
    default:
      return { text: "", needsModel: true };
  }
}

/** Search every note's lines. Returns [{ note, line, start, score }], best first. */
export function searchNotes(notes, query, limit = 5) {
  const hits = [];
  for (const note of notes) {
    const cues = note.cues?.length ? note.cues : (note.text || "").split(/(?<=[.!?])\s+/).map((text, i) => ({ start: i, text }));
    const results = search(buildIndex(cues), query, { limit: 2 });
    for (const r of results) hits.push({ note, line: r.text, start: r.start, score: r.score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
