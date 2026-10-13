// Study notes for a recorded class: the lines worth keeping, with headings where the teacher
// changed topic, course words and dates highlighted in colours you choose, and the definitions
// Seekto thinks it heard shown as suggestions you keep or dismiss. Only kept ones become flashcards.
import { $, $$, html, raw, esc, toast } from "./ui.js";
import { state, saveNote, locale as currentLocale } from "./state.js";
import { studyNotes, findDefinitions, findEvents, findDates } from "../engine/index.js";
import { t } from "./i18n.js";

// Highlight kinds and their default colours (light and dark). Users change them in Settings.
export const HIGHLIGHTS = [
  { key: "term", label: () => t("Course words"), light: "#ffe66d", dark: "#8a7a1a" },
  { key: "date", label: () => t("Dates and deadlines"), light: "#bfe0ff", dark: "#1f4e7a" },
  { key: "def", label: () => t("Suggested definitions"), light: "#c8f2d0", dark: "#1f5e36" },
  { key: "mine", label: () => t("My own notes"), light: "#ffd1e3", dark: "#6e2a4a" },
];

export function highlightColor(key) {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const h = HIGHLIGHTS.find((x) => x.key === key);
  return state.settings.highlights?.[key] || (dark ? h.dark : h.light);
}

/** Put the chosen colours on the page as CSS variables (--hl-term, --hl-date, ...). */
export function applyHighlights() {
  for (const h of HIGHLIGHTS) document.documentElement.style.setProperty(`--hl-${h.key}`, highlightColor(h.key));
}

// Suggested definitions worth showing: confident enough, not already kept or dismissed.
const MIN_CONFIDENCE = 0.45;
export function suggestions(note) {
  const text = noteBody(note);
  const kept = new Set((note.flashcards || []).map((d) => d.term.toLowerCase()));
  const gone = new Set((note.dismissed || []).map((x) => x.toLowerCase()));
  return findDefinitions(text).filter(
    (d) => d.confidence >= MIN_CONFIDENCE && !kept.has(d.term.toLowerCase()) && !gone.has(d.term.toLowerCase()),
  );
}

function noteBody(note) {
  return note.cues?.length ? note.cues.map((c) => c.text).join(" ") : note.text || "";
}

/** One line with its highlights: course words, dates, suggested or kept definitions. */
function markLine(text, { terms, defs, kept, ref, locale }) {
  const spans = [];
  const add = (a, b, cls, title) => spans.push([a, b, cls, title]);
  if (findEvents(text, { ref, locale }).length)
    for (const d of findDates(text, ref, { locale })) add(d.index, d.end, "date", t("Dates and deadlines"));
  for (const d of defs) {
    const i = text.toLowerCase().indexOf(d.term.toLowerCase());
    if (i >= 0) add(i, i + d.term.length, "def", t("Suggested definition"));
  }
  for (const d of kept) {
    const i = text.toLowerCase().indexOf(d.term.toLowerCase());
    if (i >= 0) add(i, i + d.term.length, "kept", t("Flashcard"));
  }
  for (const term of terms) {
    const re = new RegExp(`(?<![\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\p{L}]*`, "giu");
    for (const m of text.matchAll(re)) add(m.index, m.index + m[0].length, "term", t("Course words"));
  }
  spans.sort((a, b) => a[0] - b[0] || b[1] - b[0] - (a[1] - a[0]));
  let out = "";
  let at = 0;
  for (const [a, b, cls, title] of spans) {
    if (a < at) continue;
    out += esc(text.slice(at, a)) + `<mark class="hl ${cls}" title="${esc(title)}">${esc(text.slice(a, b))}</mark>`;
    at = b;
  }
  return out + esc(text.slice(at));
}

/** The study panel's HTML for a note. */
export function studyHtml(note) {
  const text = noteBody(note);
  if (!text.trim()) return `<p class="empty">${t("No transcript yet.")}</p>`;
  const notes = studyNotes(text);
  const defs = suggestions(note);
  const kept = note.flashcards || [];
  const ref = new Date(note.createdAt || Date.now());
  const locale = currentLocale();
  const opts = { defs, kept, ref, locale };
  const defFor = (line) => defs.find((d) => line.toLowerCase().includes(d.term.toLowerCase()));
  const sectionsHtml = notes.sections
    .map(
      (sec) => html`
      <div class="study-sec">
        ${raw(sec.title ? html`<h3 class="study-h">${sec.title}</h3>` : "")}
        <ul class="study-lines">
          ${raw(
            sec.lines
              .map((l) => {
                const d = defFor(l.text);
                return `<li class="study-line" data-i="${l.index}"><span>${markLine(l.text, { ...opts, terms: l.terms })}</span>${
                  d
                    ? `<span class="study-ask"><span class="note-small">${esc(t("Definition of {term}?", { term: d.term }))}</span> <button class="btn small" data-keep="${esc(d.term)}" title="${esc(t("Keep as a flashcard"))}">${t("Keep")}</button> <button class="btn ghost small" data-dismiss="${esc(d.term)}" title="${esc(t("Not a definition"))}">${t("No")}</button></span>`
                    : ""
                }</li>`;
              })
              .join(""),
          )}
        </ul>
      </div>`,
    )
    .join("");
  const otherDefs = defs.filter((d) => !notes.sections.some((s) => s.lines.some((l) => defFor(l.text) === d)));
  return html`
    <div class="study">
      <div class="study-terms" aria-label="${t("Course words")}">${raw(
        notes.terms
          .slice(0, 14)
          .map((x) => html`<mark class="hl term">${x.term}</mark>`)
          .join(" "),
      )}</div>
      ${raw(sectionsHtml)}
      ${raw(
        otherDefs.length
          ? html`<div class="study-sec"><h3 class="study-h">${t("Seekto also heard these. Keep the real ones.")}</h3><ul class="study-lines">${raw(
              otherDefs
                .map(
                  (d) =>
                    `<li class="study-line"><span><mark class="hl def">${esc(d.term)}</mark>: ${esc(d.definition)}</span><span class="study-ask"><button class="btn small" data-keep="${esc(d.term)}">${t("Keep")}</button> <button class="btn ghost small" data-dismiss="${esc(d.term)}">${t("No")}</button></span></li>`,
                )
                .join(""),
            )}</ul></div>`
          : "",
      )}
      <div class="study-sec">
        <h3 class="study-h">${t("Flashcards")} <span class="note-small">(${kept.length})</span></h3>
        ${raw(
          kept.length
            ? `<ul class="study-lines">${kept
                .map(
                  (d, i) =>
                    `<li class="study-line"><span><mark class="hl kept">${esc(d.term)}</mark>: ${esc(d.definition)}</span><button class="btn ghost small" data-unkeep="${i}" title="${esc(t("Remove flashcard"))}">×</button></li>`,
                )
                .join("")}</ul>`
            : `<p class="note-small">${t("Keep a suggested definition above and it becomes a flashcard in your practice test. Nothing is added on its own: on real lectures about half of the suggestions are right.")}</p>`,
        )}
      </div>
    </div>`;
}

/** Draw the panel into `box` and wire Keep / No / remove. `onChange` runs after each change. */
export function drawStudy(note, box, onChange) {
  box.innerHTML = studyHtml(note);
  const redo = async () => {
    await saveNote(note);
    drawStudy(note, box, onChange);
    onChange?.();
  };
  $$("[data-keep]", box).forEach((b) =>
    b.addEventListener("click", () => {
      const d = suggestions(note).find((x) => x.term === b.dataset.keep);
      if (!d) return;
      note.flashcards = [...(note.flashcards || []), { term: d.term, definition: d.definition, sentence: d.sentence }];
      toast(t("Kept as a flashcard"));
      redo();
    }),
  );
  $$("[data-dismiss]", box).forEach((b) =>
    b.addEventListener("click", () => {
      note.dismissed = [...(note.dismissed || []), b.dataset.dismiss];
      redo();
    }),
  );
  $$("[data-unkeep]", box).forEach((b) =>
    b.addEventListener("click", () => {
      note.flashcards.splice(Number(b.dataset.unkeep), 1);
      redo();
    }),
  );
  $$(".study-line[data-i]", box).forEach((l) =>
    l.addEventListener("dblclick", () =>
      box.dispatchEvent(new CustomEvent("study:goto", { detail: Number(l.dataset.i) })),
    ),
  );
}

/** Study notes as Markdown, for export. */
export function studyMarkdown(note) {
  const text = noteBody(note);
  if (!text.trim()) return [];
  const notes = studyNotes(text);
  const out = [`## ${t("Study notes")}`];
  for (const sec of notes.sections) {
    if (sec.title) out.push("", `### ${sec.title}`);
    for (const l of sec.lines) out.push(`- ${l.text}`);
  }
  if (note.flashcards?.length) {
    out.push("", `### ${t("Flashcards")}`);
    for (const d of note.flashcards) out.push(`- **${d.term}**: ${d.definition}`);
  }
  out.push("");
  return out;
}

/** The HTML for the Settings section where colours are chosen. */
export function highlightSettingsHtml() {
  return html`
    <h2>${t("Highlights")}</h2>
    <p class="note-small">${t("Colours for what Seekto marks in your notes. Pick what helps you read.")}</p>
    <div class="row" style="flex-wrap:wrap;gap:12px">
      ${raw(
        HIGHLIGHTS.map(
          (h) =>
            html`<label class="row" style="gap:6px"><input type="color" data-hl="${h.key}" value="${highlightColor(h.key)}" aria-label="${h.label()}" style="width:40px;height:32px;padding:0;border:0;background:none"> <mark class="hl ${h.key}">${h.label()}</mark></label>`,
        ).join(""),
      )}
      <button class="btn ghost small" id="hlReset">${t("Reset colours")}</button>
    </div>`;
}

export function wireHighlightSettings(root, updateSettings) {
  $$("[data-hl]", root).forEach((inp) =>
    inp.addEventListener("input", () => {
      updateSettings({ highlights: { ...(state.settings.highlights || {}), [inp.dataset.hl]: inp.value } });
      applyHighlights();
    }),
  );
  $("#hlReset", root)?.addEventListener("click", () => {
    updateSettings({ highlights: {} });
    applyHighlights();
    $$("[data-hl]", root).forEach((inp) => (inp.value = highlightColor(inp.dataset.hl)));
  });
}
