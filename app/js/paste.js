// "Paste notes or a syllabus": for anyone who can't record (school rules, a blocked microphone)
// or already has the text. Seekto finds the dates and the terms and makes a practice test.
import { $, html, raw, openOverlay, closeOverlay, friendlyDate, download } from "./ui.js";
import { state, saveNote, today } from "./state.js";
import { uid } from "./store.js";
import { go } from "./nav.js";
import { addDates } from "./capture.js";
import { detectSubject, detectTopic, makeQuiz, fromISO, toICS } from "../engine/index.js";
import { openQuiz } from "./quiz.js";
import { typeLabel } from "./calendar.js";
import { t } from "./i18n.js";
import { mode } from "./profile.js";

export function openPaste() {
  const sheet = openOverlay("");
  sheet.innerHTML = html`
    <div class="view-head"><h2>${t("Paste notes or a syllabus")}</h2><button class="btn ghost small" data-close>${t("Close")}</button></div>
    <p class="sub">${t("Class notes, a syllabus, a teacher's announcement, a transcript: Seekto puts the dates on your calendar and turns explained terms into a practice test. Nothing is uploaded.")}</p>
    <label class="field"><span class="label">${t("Text")}</span><textarea id="pasteText" rows="10" placeholder="${t("The chapter 5 quiz is on Friday. Mitosis is when one cell divides into two identical cells…")}"></textarea></label>
    <div class="row">
      <label class="field" style="flex:1;min-width:180px"><span class="label">${t("Written or said on")}</span><input type="date" id="pasteDate" value="${today()}"></label>
      <button class="btn" id="pasteGo" style="align-self:end">${t("Find dates and make a test")}</button>
    </div>
    <div id="pasteOut" role="status" aria-live="polite"></div>`;
  sheet.querySelector("[data-close]").addEventListener("click", closeOverlay);
  $("#pasteGo", sheet).addEventListener("click", async () => {
    const text = $("#pasteText", sheet).value.trim();
    if (!text) return $("#pasteText", sheet).focus();
    const day = $("#pasteDate", sheet).value || today();
    const subject = detectSubject(text) || "General";
    const topic = detectTopic(text);
    const createdAt = fromISO(day).setHours(12);
    const work = mode() === "work";
    const note = {
      id: uid("note"),
      kind: "typed",
      createdAt,
      date: day,
      title: work ? `${t("Meeting")}: ${topic}` : subject === "General" ? topic : `${subject}: ${topic}`,
      subject: work ? "Meeting" : subject,
      topic,
      text,
      cues: [],
      marks: [],
      mine: [],
      ...(work ? { mode: "work" } : {}),
    };
    await addDates(note);
    await saveNote(note);
    const events = state.events.filter((e) => e.noteId === note.id);
    const asks = makeQuiz([{ title: note.title, topic, text }]).length;
    $("#pasteOut", sheet).innerHTML = html`
      <section class="panel" style="gap:10px">
        <b>${events.length === 1 ? t("1 date added to your calendar") : t("{n} dates added to your calendar", { n: events.length })}${asks ? ` · ${asks === 1 ? t("1 question for your practice test") : t("{n} questions for your practice test", { n: asks })}` : ""}</b>
        ${raw(events.length ? `<div class="agenda">${events.map((e) => html`<div class="event"><span class="when">${friendlyDate(e.date)}</span><span>${e.title}</span><span class="kind ${e.type}">${typeLabel(e.type)}</span></div>`).join("")}</div>` : html`<p class="note-small">${t('No dates found. Seekto looks for things like "the quiz is on Friday" or "due October 20".')}</p>`)}
        <div class="row">
          <button class="btn" data-quiz>${t("Take the practice test")}</button>
          ${raw(events.length ? html`<button class="btn ghost" data-remind>${t("Remind me about these")}</button>` : "")}
          <button class="btn ghost" data-open>${t("Open the note")}</button>
        </div>
      </section>`;
    $("[data-quiz]", sheet).addEventListener("click", () => openQuiz({ notes: [note], title: topic }));
    $("[data-remind]", sheet)?.addEventListener("click", () =>
      download(
        "seekto-reminders.ics",
        toICS(events, { labels: { tomorrow: t("Tomorrow"), today: t("Today") } }),
        "text/calendar",
      ),
    );
    $("[data-open]", sheet).addEventListener("click", () => {
      closeOverlay();
      go(`note/${note.id}`);
    });
  });
  requestAnimationFrame(() => $("#pasteText", sheet)?.focus());
}
