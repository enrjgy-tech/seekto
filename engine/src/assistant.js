// Understand common study questions and answer them from the person's own notes and calendar,
// with no AI model. Anything else is handed to the model, if one is connected.
import { fromISO, toISO } from "./dates.js";
import { findDefinitions } from "./study.js";
import { buildIndex, search } from "./search.js";

const TEST_WORDS = "test|exam|quiz|midterm|final";
// Answers are written in English with {placeholders}; pass `tr` to translate them (the app passes its t()).
const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text);

/** Work out what the person is asking for. */
export function classify(message) {
  const text = String(message).trim();
  const lower = text.toLowerCase().replace(/[?!.]+$/, "");
  let m;
  if (
    /\baction items?\b|\bmy (?:tasks|to-?dos)\b|\bwhat do i (?:need|have) to do\b|\bwho (?:is doing|owns|has) what\b/.test(
      lower,
    )
  )
    return { intent: "actions" };
  if (
    /\bfollow[- ]?up (?:email|note|message)\b|\brecap email\b|\b(?:draft|write) (?:an? |the )?(?:follow[- ]?up|recap|email)\b/.test(
      lower,
    )
  )
    return { intent: "follow-up" };
  if (
    (m = lower.match(
      new RegExp(`\\bwhen(?:'s| is| are)?\\s+(?:my|the|our)?\\s*(?:next\\s+)?(.*?)\\s*\\b(${TEST_WORDS})s?\\b`),
    ))
  ) {
    return { intent: "next-test", subject: m[1].trim() || null };
  }
  if ((m = lower.match(/\bwhen(?:'s| is)\s+(?:my|the|our)\s+(.+?)\s+(?:due)\b/))) {
    return { intent: "when-due", subject: m[1].trim() };
  }
  if (
    /\b(what'?s|what is|anything)\s+(due|coming up)\b|\bwhat do i have\b|\bupcoming\b|\bdue (today|tomorrow|this week)\b|\bmy (schedule|calendar)\b/.test(
      lower,
    )
  ) {
    const range = /\btoday\b/.test(lower)
      ? "today"
      : /\btomorrow\b/.test(lower)
        ? "tomorrow"
        : /\bthis week\b/.test(lower)
          ? "week"
          : "soon";
    return { intent: "due", range };
  }
  if (
    (m = lower.match(
      /\b(?:quiz|test) me(?:\s+(?:on|about)\s+(.+))?$|\bhelp me (?:study|review)(?:\s+(?:for|on)?\s*(.+))?$|\bmake (?:me )?(?:a )?(?:practice )?(?:test|quiz)(?:\s+(?:on|about|for)\s+(.+))?$/,
    ))
  ) {
    return { intent: "quiz", topic: (m[1] || m[2] || m[3] || "").trim() || null };
  }
  if (
    (m = lower.match(
      /^(?:what(?:'s| is| are| does)|define|meaning of|what do we mean by)\s+(?:a |an |the )?(.+?)(?:\s+mean)?$/,
    ))
  ) {
    return { intent: "define", term: m[1].trim() };
  }
  // Spanish and Portuguese
  const es = lower.replace(/^[¿¡]/, "");
  if (
    (m = es.match(
      /(?:cu[aá]ndo|quando)\s+(?:es|son|[eé]|s[aã]o|tengo|tenho|ser[aá])\s+(?:mi|mis|el|la|los|las|a|o|as|os|minha|meu)?\s*(?:pr[oó]xim[oa]s?\s+)?(examen|prueba|parcial|control|prova|teste|exame|avalia[cç][aã]o)(?:es|s)?(?:\s+de\s+(.+))?$/u,
    ))
  ) {
    return { intent: "next-test", subject: m[2]?.trim() || null };
  }
  if (
    /qu[eé]\s+tengo\s+(?:que\s+entregar\s+)?(?:para\s+)?(?:hoy|ma[nñ]ana|esta\s+semana)|o\s+que\s+(?:eu\s+)?tenho\s+(?:pra\s+|para\s+)?(?:hoje|amanh[aã]|essa\s+semana|esta\s+semana)|qu[eé]\s+(?:hay|tengo)\s+pendiente|o\s+que\s+(?:tem|t[aá])\s+pra\s+entregar|pr[oó]ximas?\s+entregas/u.test(
      es,
    )
  ) {
    const range = /\b(hoy|hoje)\b/u.test(es)
      ? "today"
      : /ma[nñ]ana|amanh[aã]/u.test(es)
        ? "tomorrow"
        : /semana/.test(es)
          ? "week"
          : "soon";
    return { intent: "due", range };
  }
  if (
    (m = es.match(
      /(?:hazme|haz\s+un|quiero\s+(?:un\s+)?(?:practicar|examen|quiz)|ponme\s+a\s+prueba|me\s+(?:faz|faça)|quero\s+(?:praticar|um\s+quiz|um\s+teste)|faz\s+um)\s*(?:un|uma|um)?\s*(?:quiz|examen|test|teste|prova)?(?:\s+(?:de|sobre)\s+(.+))?$/u,
    ))
  ) {
    return { intent: "quiz", topic: m[1]?.trim() || null };
  }
  if (
    (m = es.match(
      /^(?:qu[eé]\s+(?:es|son|significa)|o\s+que\s+(?:[eé]|s[aã]o|significa)|define)\s+(?:un|una|el|la|los|las|o|a|os|as|um|uma)?\s*(.+?)$/u,
    ))
  ) {
    return { intent: "define", term: m[1].trim() };
  }
  if (/\b(start )?record(ing)?\b|^grabar|^gravar/.test(lower) && lower.split(/\s+/).length <= 5)
    return { intent: "record" };
  if (/\b(research|rubric|outline|essay|sources)\b/.test(lower)) return { intent: "research" };
  return { intent: "general" };
}

function daysBetween(fromIso, toIso) {
  return Math.round((fromISO(toIso) - fromISO(fromIso)) / 86400000);
}

/** "today", "tomorrow", "Friday, Oct 16 (in 4 days)" */
export function describeDay(iso, today, { tr = fill, locale = "en-US" } = {}) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return tr("today");
  if (diff === 1) return tr("tomorrow");
  const d = fromISO(iso);
  const label = d.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
  return diff > 1
    ? tr("{date} (in {n} days)", { date: label, n: diff })
    : tr("{date} ({n} days ago)", { date: label, n: -diff });
}

function matchesSubject(event, subject) {
  if (!subject) return true;
  const hay = `${event.title} ${event.subject || ""}`.toLowerCase();
  return subject
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w.replace(/s$/, "")));
}

function upcoming(events, today) {
  return events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Answer a classified question from local data. Returns { text, needsModel, items? }.
 * data: { notes: [{ id, title, subject, text, date }], events: [{ title, date, type, subject }], today: "YYYY-MM-DD" }
 */
export function answerLocally(
  parsed,
  { notes = [], events = [], today = toISO(new Date()), tr = fill, locale = "en-US" } = {},
) {
  const day = (iso) => describeDay(iso, today, { tr, locale });
  switch (parsed.intent) {
    case "next-test": {
      const list = upcoming(events, today).filter(
        (e) =>
          (e.type === "test" || /test|exam|quiz|midterm|final|examen|prueba|parcial|prova|teste/i.test(e.title)) &&
          matchesSubject(e, parsed.subject),
      );
      if (!list.length) {
        return {
          text: parsed.subject
            ? tr(
                "I don't see an upcoming {subject} test in your calendar. Record the class where it's announced, or import your school calendar, and I'll catch it.",
                { subject: parsed.subject },
              )
            : tr(
                "I don't see an upcoming test in your calendar. Record the class where it's announced, or import your school calendar, and I'll catch it.",
              ),
        };
      }
      const [next, ...rest] = list;
      const more = rest.length
        ? ` ${tr("After that: {list}.", {
            list: rest
              .slice(0, 2)
              .map((e) => `${e.title}, ${day(e.date)}`)
              .join("; "),
          })}`
        : "";
      return {
        text: `${tr("Your next one is {title}, {when}.", { title: next.title, when: day(next.date) })}${more}`,
        items: list,
      };
    }
    case "when-due": {
      const list = upcoming(events, today).filter((e) => matchesSubject(e, parsed.subject));
      if (!list.length)
        return { text: tr('I don\'t see "{subject}" in your calendar yet.', { subject: parsed.subject }) };
      return { text: tr("{title} is {when}.", { title: list[0].title, when: day(list[0].date) }), items: list };
    }
    case "due": {
      const span = { today: 0, tomorrow: 1, week: 7, soon: 14 }[parsed.range];
      const start = parsed.range === "tomorrow" ? 1 : 0;
      const list = upcoming(events, today).filter((e) => {
        const d = daysBetween(today, e.date);
        return d >= start && d <= span;
      });
      const none = {
        today: tr("Nothing on your calendar today."),
        tomorrow: tr("Nothing on your calendar tomorrow."),
        week: tr("Nothing on your calendar this week."),
        soon: tr("Nothing on your calendar in the next two weeks."),
      }[parsed.range];
      if (!list.length) return { text: none };
      const items = list.map((e) => `${e.title} (${day(e.date)})`).join("; ");
      const text = {
        today: tr("Coming up today: {list}.", { list: items }),
        tomorrow: tr("Coming up tomorrow: {list}.", { list: items }),
        week: tr("Coming up this week: {list}.", { list: items }),
        soon: tr("Coming up in the next two weeks: {list}.", { list: items }),
      }[parsed.range];
      return { text, items: list };
    }
    case "define": {
      const term = parsed.term.toLowerCase();
      for (const note of notes) {
        const def = findDefinitions(note.text).find(
          (d) => d.term.toLowerCase() === term || d.term.toLowerCase().includes(term),
        );
        if (def) return { text: `${def.term}: ${def.definition}.`, source: note };
      }
      const hit = searchNotes(notes, parsed.term)[0];
      if (hit)
        return {
          text: tr('From your notes on {title}: "{line}"', { title: hit.note.title, line: hit.line }),
          source: hit.note,
          needsModel: true,
        };
      return { text: tr('I couldn\'t find "{term}" in your notes.', { term: parsed.term }), needsModel: true };
    }
    default:
      return { text: "", needsModel: true };
  }
}

/** Search every note's lines. Returns [{ note, line, start, score }], best first. */
export function searchNotes(notes, query, limit = 5) {
  const hits = [];
  for (const note of notes) {
    const cues = note.cues?.length
      ? note.cues
      : (note.text || "").split(/(?<=[.!?])\s+/).map((text, i) => ({ start: i, text }));
    const results = search(buildIndex(cues), query, { limit: 2 });
    for (const r of results) hits.push({ note, line: r.text, start: r.start, score: r.score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
