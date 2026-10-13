// The first screen for someone new: the sample class plays straight away, and what Seekto finds
// lands where it belongs. Dates drop onto the calendar and explained terms become test questions.
// Record and Paste are right there; the assistant is one tap away.
import { $, html, raw, esc, friendlyDate } from "./ui.js";
import { state } from "./state.js";
import { go } from "./nav.js";
import { sampleScript, loadSample } from "./sample.js";
import { openPaste } from "./paste.js";
import { openQuiz, shareLink } from "./quiz.js";
import { findEvents, findDefinitions, findDates, toISO, fromISO, makeQuiz, formatTime } from "../engine/index.js";
import { t, uiLocale } from "./i18n.js";
import { defaultTranscriber } from "./ondevice.js";
import { canListen } from "./voice.js";

let run = 0;

/** Highlight dates and the defined term in one line, like a highlighter. */
function marked(text, ref, locale, subject) {
  const spans = [];
  if (findEvents(text, { ref, locale, subject }).length) for (const d of findDates(text, ref, { locale })) spans.push([d.index, d.end]);
  for (const d of findDefinitions(text)) {
    const i = text.toLowerCase().indexOf(d.term.toLowerCase());
    if (i >= 0) spans.push([i, i + d.term.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let out = "";
  let at = 0;
  for (const [a, b] of spans) {
    if (a < at) continue;
    out += `${esc(text.slice(at, a))}<mark class="found">${esc(text.slice(a, b))}</mark>`;
    at = b;
  }
  return out + esc(text.slice(at));
}

export function render(main) {
  const me = ++run;
  const script = sampleScript("learning");
  const ref = new Date();
  const locale = uiLocale();
  const all = findEvents(script.lines.join(" "), { ref, locale, subject: script.subject });
  const last = all.reduce((m, e) => (e.date > m ? e.date : m), toISO(ref));
  // Whole weeks from Monday, so the strip reads like a calendar, as many weeks as the dates need.
  const monday = new Date(ref);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const span = Math.min(21, 7 * Math.ceil((Math.round((fromISO(last) - monday) / 86400000) + 1) / 7));
  const days = Array.from({ length: span }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });
  const todayISO = toISO(ref);
  // The practice test this class becomes, so the counter ends on the number of questions it really has.
  const quiz = makeQuiz([{ title: script.title, topic: script.topic, text: script.lines.join(" ") }]);
  const blankLines = quiz.filter((q) => q.kind === "blank").map((q) => q.prompt.replace("_____", q.answer));
  const asks = (line) => findDefinitions(line).length + blankLines.filter((b) => line.includes(b)).length;

  const privateHere = (state.settings.transcriber || defaultTranscriber(canListen)) === "device" || !canListen;
  main.innerHTML = html`
    <div class="view home">
      <header class="home-head">
        <h1>${t("Your teacher says it once.")}<br>${t("Seekto catches it.")}</h1>
        <p class="lede">${privateHere ? t("Record a class. The deadlines go on your calendar, and the lesson becomes a practice test you can share with your class. Free, no account, and the transcript is made on your device.") : t("Record a class. The deadlines go on your calendar, and the lesson becomes a practice test you can share with your class. Free and no account. On this device, live transcripts use your browser's speech service; you can switch to private, on-device transcripts in Settings.")}</p>
        <div class="row cta">
          <button class="btn big rec" data-go-record><span class="dot" aria-hidden="true"></span>${t("Record a class")}</button>
          <button class="btn big ghost" data-paste>${t("Paste notes or a syllabus")}</button>
          <button class="btn ghost linkish" data-chat>${t("Open the assistant")}</button>
        </div>
      </header>
      <section class="stage" aria-label="${t("A sample class, playing")}">
        <div class="panel stage-class">
          <div class="stage-head"><span class="pulse" id="hPulse" aria-hidden="true"></span><b>${script.title}</b><span class="note-small">${t("sample class (scripted)")}</span><span class="mono note-small" id="hClock">0:00</span></div>
          <div class="stage-lines" id="hLines"></div>
        </div>
        <div class="stage-side">
          <div class="panel week">
            <b>${t("Your calendar")}</b>
            <div class="days" id="hDays">${raw(days.map((d) => html`<div class="dcell ${toISO(d) < todayISO ? "past" : toISO(d) === todayISO ? "today" : ""}" data-day="${toISO(d)}" aria-label="${d.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })}"><span class="dw">${d.toLocaleDateString(locale, { weekday: "short" })}</span><span class="dn">${d.getDate()}</span></div>`).join(""))}</div>
            <ul class="added" id="hAdded" aria-live="polite"></ul>
          </div>
          <div class="panel testcard">
            <b>${t("Practice test")}</b>
            <p class="qcount"><span id="hQn">0</span> <span id="hQl">${t("questions so far")}</span></p>
            <div class="row" id="hTest" hidden>
              <button class="btn" data-take>${t("Take the test")}</button>
              <button class="btn ghost" data-sharetest>${t("Share with your class")}</button>
            </div>
          </div>
        </div>
      </section>
      <p class="note-small home-foot"><button class="btn ghost small" id="hReplay" hidden>${t("Play it again")}</button> ${t("Deadlines and definitions are found in English, Spanish and Portuguese, with no AI. Change the language in Settings.")}</p>
    </div>`;

  main.querySelector("[data-go-record]").addEventListener("click", () => go("record"));
  main.querySelector("[data-paste]").addEventListener("click", openPaste);
  main.querySelector("[data-chat]").addEventListener("click", () => go("chat"));
  $("#hReplay").addEventListener("click", () => render(main));

  let note = null;
  const ready = (async () => {
    const existing = state.notes.find((n) => n.sample && n.title === script.title);
    note = existing || (await loadSample("learning")).note;
  })();

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pace = reduce ? 0 : (window.seektoDemoPace ?? 1);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * pace));
  let questions = 0;
  (async () => {
    await wait(500);
    for (let i = 0; i < script.lines.length; i++) {
      if (me !== run || !document.contains(main)) return;
      const text = script.lines[i];
      const row = document.createElement("div");
      row.className = "live-line";
      row.innerHTML = `<span class="t mono">${formatTime(i * 9 + 2)}</span><span>${marked(text, ref, locale, script.subject)}</span>`;
      $("#hLines").appendChild(row);
      $("#hLines").scrollTop = $("#hLines").scrollHeight;
      $("#hClock").textContent = formatTime(i * 9 + 6);
      const events = findEvents(text, { ref, locale, subject: script.subject });
      for (const e of events) {
        const cell = main.querySelector(`.dcell[data-day="${e.date}"]`);
        if (!cell) continue;
        const mark = document.createElement("span");
        mark.className = "pill found";
        mark.setAttribute("aria-hidden", "true");
        cell.appendChild(mark);
        cell.classList.add("has");
        const item = document.createElement("li");
        item.innerHTML = html`<span class="when">${friendlyDate(e.date)}</span><mark class="found">${((x) => x.charAt(0).toUpperCase() + x.slice(1))(e.title.replace(new RegExp(`^${script.subject}:?\\s+`, "i"), ""))}</mark>`;
        $("#hAdded").appendChild(item);
      }
      const add = asks(text);
      if (add) {
        questions += add;
        $("#hQn").textContent = questions;
        $("#hQl").textContent = questions === 1 ? t("question so far") : t("questions so far");
        $("#hQn").parentElement.classList.remove("bump");
        void $("#hQn").offsetWidth;
        $("#hQn").parentElement.classList.add("bump");
      }
      await wait(events.length ? 1300 : add ? 900 : 520);
    }
    await ready;
    if (me !== run || !document.contains(main)) return;
    $("#hPulse").remove();
    const total = makeQuiz([{ title: note.title, topic: note.topic, text: note.text }]).length;
    $("#hQn").textContent = total;
    $("#hQl").textContent = total === 1 ? t("question, ready") : t("questions, ready");
    $("#hTest").hidden = false;
    $("#hReplay").hidden = false;
    main.querySelector("[data-take]").addEventListener("click", () => openQuiz({ notes: [note], title: note.title.replace(/^[^:]+:\s*/, "") }));
    main.querySelector("[data-sharetest]").addEventListener("click", () => {
      const qs = makeQuiz([{ title: note.title, topic: note.topic, text: note.text }]);
      shareLink(note.title.replace(/^[^:]+:\s*/, ""), qs);
    });
  })();
  return () => { run++; };
}
