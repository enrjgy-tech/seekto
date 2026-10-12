// Learning and Work: the same app with the words, home screen and a few tools changed.
import { state, updateSettings } from "./state.js";

export const MODES = {
  learning: {
    name: "Learning",
    record: "Record a class",
    recordTitle: "Record a class",
    intro: "I keep your class notes, your calendar and your assignments in one place, and I help you study.",
    steps: [
      ["sample", "Try a sample class", "See a recorded lesson turn into notes, calendar dates and a quiz."],
      ["record", "Record a class", "Notes, marks and dates are saved by themselves."],
      ["calendar", "Add your school calendar", "Import from Canvas, Google Classroom or any .ics file."],
      ["settings", "Choose an AI model (optional)", "On your computer, free cloud or paid cloud."],
    ],
    suggestions: ["What's due this week?", "When is my next test?", "Quiz me", "Start recording"],
    placeholder: "Ask about your classes, deadlines or notes",
    consent: "Follow your school's rules and ask before recording.",
    needConsent: false,
  },
  work: {
    name: "Work",
    record: "Record a meeting",
    recordTitle: "Record a meeting",
    intro: "I turn your meetings and talks into notes, decisions and action items with owners and dates, and I keep your deadlines in one place.",
    steps: [
      ["sample", "Try a sample meeting", "See a meeting turn into decisions, action items and a follow-up email."],
      ["record", "Record a meeting", "Decisions, action items and dates are saved by themselves."],
      ["calendar", "Add your calendar", "Import any .ics file from Google, Outlook or your team tools."],
      ["settings", "Choose an AI model (optional)", "On your computer, free cloud or paid cloud."],
    ],
    suggestions: ["What are my action items?", "What's due this week?", "Draft a follow-up email", "Start recording"],
    placeholder: "Ask about your meetings, action items or deadlines",
    consent: "Everyone in the meeting must know it's being recorded. Some places require everyone's consent.",
    needConsent: true,
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
