// Learning and Work: the same app with the words, home screen and a few tools changed.
import { state, updateSettings } from "./state.js";
import { t } from "./i18n.js";

export const MODES = {
  learning: {
    name: t("Learning"),
    record: t("Record a class"),
    recordTitle: t("Record a class"),
    intro: t("I keep your class notes, your calendar and your assignments in one place, and I help you study."),
    steps: [
      ["sample", t("Try a sample class"), t("See a recorded lesson turn into notes, calendar dates and a quiz.")],
      ["record", t("Record a class"), t("Notes, marks and dates are saved by themselves.")],
      ["paste", t("Paste notes or a syllabus"), t("No microphone needed: get the dates and a practice test.")],
      ["calendar", t("Add your school calendar"), t("Import from Canvas, Google Classroom or any .ics file.")],
      ["settings", t("Choose an AI model (optional)"), t("On your computer, free cloud or paid cloud.")],
    ],
    suggestions: [t("What's due this week?"), t("When is my next test?"), t("Quiz me"), t("Start recording")],
    placeholder: t("Ask about your classes, deadlines or notes"),
    consent: t("Follow your school's rules and ask your teacher before recording."),
    consentCheck: t("My teacher allowed this recording"),
  },
  work: {
    name: t("Work"),
    record: t("Record a meeting"),
    recordTitle: t("Record a meeting"),
    intro: t(
      "I turn your meetings and talks into notes, decisions and action items with owners and dates, and I keep your deadlines in one place.",
    ),
    steps: [
      [
        "sample",
        t("Try a sample meeting"),
        t("See a meeting turn into decisions, action items and a follow-up email."),
      ],
      ["record", t("Record a meeting"), t("Decisions, action items and dates are saved by themselves.")],
      ["paste", t("Paste meeting notes"), t("Get the decisions, action items and dates from notes you already have.")],
      ["calendar", t("Add your calendar"), t("Import any .ics file from Google, Outlook or your team tools.")],
      ["settings", t("Choose an AI model (optional)"), t("On your computer, free cloud or paid cloud.")],
    ],
    suggestions: [
      t("What are my action items?"),
      t("What's due this week?"),
      t("Draft a follow-up email"),
      t("Start recording"),
    ],
    placeholder: t("Ask about your meetings, action items or deadlines"),
    consent: t("Everyone in the meeting must know it's being recorded. Some places require everyone's consent."),
    consentCheck: t("Everyone in this meeting knows it's being recorded"),
  },
};

export const mode = () => (MODES[state.settings.mode] ? state.settings.mode : "learning");
export const words = () => MODES[mode()];

/** Update the parts of the page outside the current view (sidebar labels). */
export function applyChrome() {
  document.body.dataset.mode = mode();
  const rec = document.querySelector(".side [data-go=record]");
  if (rec) rec.lastChild.textContent = words().record;
}

export function setMode(m) {
  updateSettings({ mode: MODES[m] ? m : "learning" });
  applyChrome();
  window.dispatchEvent(new Event("seekto:render"));
}
