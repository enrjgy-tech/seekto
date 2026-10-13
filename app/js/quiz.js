// Practice tests from notes: typed or spoken answers, a score at the end, sharing with
// "beat my score", spaced reviews before the test, and exports.
import { html, raw, openOverlay, closeOverlay, download, copy, toast, $, friendlyDate } from "./ui.js";
import { state, noteText, saveEvent, today } from "./state.js";
import { uid } from "./store.js";
import { makeQuiz, checkAnswer, exportQuiz, isReady, chat, encodeShare, shuffle, reviewPlan } from "../engine/index.js";
import { speak, listenOnce, canListen } from "./voice.js";

const FORMATS = [
  ["quizlet", "Quizlet", "txt"],
  ["anki", "Anki", "txt"],
  ["csv", "CSV (Google Forms, Kahoot, spreadsheets)", "csv"],
  ["gift", "Moodle (GIFT)", "txt"],
  ["text", "Printable text", "txt"],
];

function promptFor(q) {
  if (q.kind === "term") return { label: "Which term means…", text: q.prompt };
  if (q.kind === "define") return { label: "What does this mean?", text: q.prompt };
  if (q.kind === "blank") return { label: "Fill in the blank", text: q.prompt };
  return { label: "Question", text: q.prompt };
}

function spokenPrompt(q) {
  if (q.kind === "term") return `Which term means: ${q.prompt}?`;
  if (q.kind === "define") return `What does ${q.prompt} mean?`;
  if (q.kind === "blank") return `Fill in the blank. ${q.prompt.replace(/_{3,}/g, "blank")}`;
  return q.prompt;
}

async function aiQuestions(notes, count) {
  const material = notes.map((n) => `# ${n.title}\n${noteText(n).slice(0, 6000)}`).join("\n\n").slice(0, 16000);
  const reply = await chat(state.settings, {
    system: "You write short practice questions from a student's class notes. Reply with JSON only.",
    messages: [{ role: "user", content: `Write ${count} practice questions from these notes. Mix definitions, "which term" questions and short-answer questions. Reply as a JSON array of {"prompt": "...", "answer": "..."} with short answers.\n\n${material}` }],
    maxTokens: 1800,
  });
  const json = reply.slice(reply.indexOf("["), reply.lastIndexOf("]") + 1);
  return JSON.parse(json)
    .filter((q) => q.prompt && q.answer)
    .map((q) => ({ kind: "ai", prompt: String(q.prompt), answer: String(q.answer), source: "AI" }));
}

/**
 * A link anyone can open to take this test. The questions (and your score, if you finished)
 * live after "#", so no server sees them.
 */
export async function shareLink(title, questions, challenge = null) {
  const url = `${location.origin}${location.pathname}#s=${await encodeShare({ title, questions, challenge })}`;
  const text = challenge ? `I got ${challenge.got}/${challenge.of} on "${title}". Can you beat me?` : `Practice test: ${title}`;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title, text, url }); return url; } catch { /* fall back to copying */ }
  }
  await copy(`${text} ${url}`, "Copied. Paste it in your class chat; anyone can open it, no account needed.");
  return url;
}

/** Upcoming tests on the calendar that came from these notes. */
function testsFor(notes) {
  const ids = new Set(notes.map((n) => n.id));
  const now = today();
  return state.events.filter((e) => e.type === "test" && e.date > now && ids.has(e.noteId)).sort((a, b) => a.date.localeCompare(b.date));
}

async function planReviews(test) {
  const dates = reviewPlan(test.date, today());
  let added = 0;
  for (const date of dates) {
    if (state.events.some((e) => e.type === "review" && e.forEvent === test.id && e.date === date)) continue;
    await saveEvent({ id: uid("event"), type: "review", title: `Review: ${test.title}`, date, noteId: test.noteId, forEvent: test.id, source: "plan" });
    added++;
  }
  return { added, dates };
}

/**
 * Open a quiz built from these notes, or from ready-made questions (a shared test).
 * mount: render inside this element instead of a dialog (the shared-test page).
 * voice: read questions aloud and listen for answers.
 */
export function openQuiz({ notes = [], questions: given = null, title = "Practice test", voice = false, count = 10, shared = false, challenge = null, mount = null, onLeave = null }) {
  let flip = false;
  const build = () => (given ? shuffle(given) : makeQuiz(notes.map((n) => ({ title: n.title, topic: n.topic, text: noteText(n) })), { count, flip }));
  let questions = build();
  let i = 0;
  let score = 0;
  let answered = false;
  // Answering out loud uses the browser's speech service (online in Chrome and Edge), so a shared
  // test, which promises that answers stay on the device, doesn't offer it.
  const mic = canListen && !shared;
  const sheet = mount || openOverlay("");
  const close = mount ? "" : `<button class="btn ghost small" data-close>Close</button>`;
  if (!mount) sheet.closest(".overlay")?.setAttribute("aria-label", title);

  function head(extra = "") {
    // On the shared-test page the page itself shows the title
    return mount ? html`<div class="view-head quiz-head"><span></span>${raw(extra)}</div>` : html`<div class="view-head"><h2 id="quizTitle">${title}</h2>${raw(extra)}${raw(close)}</div>`;
  }

  function draw() {
    if (!questions.length) {
      sheet.innerHTML = html`
        ${raw(head())}
        <p class="empty">These notes don't have enough to make questions yet. Notes where a term is explained ("mitosis is when…", "we call this…") work best.</p>
        ${raw(isReady(state.settings) ? `<button class="btn" data-ai>Make questions with AI</button>` : `<p class="note-small">Connecting an AI model in Settings lets Seekto write questions from any notes.</p>`)}`;
      return wire();
    }
    if (i >= questions.length) return drawEnd();
    const q = questions[i];
    const p = promptFor(q);
    answered = false;
    sheet.innerHTML = html`
      ${raw(head(`<span class="note-small mono" aria-label="Question ${i + 1} of ${questions.length}">${i + 1} / ${questions.length}</span>`))}
      <div class="progress" aria-hidden="true"><span style="width:${Math.round((i / questions.length) * 100)}%"></span></div>
      <div class="qcard">
        <span class="label" id="qLabel">${p.label}</span>
        <div class="prompt" id="qPrompt">${p.text}</div>
        <form class="row" data-answer>
          <input type="text" id="quizAnswer" autocomplete="off" placeholder="Your answer" aria-labelledby="qLabel qPrompt" style="flex:1">
          ${raw(mic ? `<button type="button" class="iconbtn" data-say title="Answer out loud (uses your browser's speech service)" aria-label="Answer out loud"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : "")}
          <button class="btn">Check</button>
        </form>
        <div class="result" id="quizResult" role="status" aria-live="polite"></div>
      </div>
      <div class="row"><button class="btn ghost small" data-skip>Show answer</button>${raw(i === 0 && !shared ? `<button class="btn ghost small" data-share>Share as a link</button>` : "")}${raw(q.source && !shared ? html`<span class="note-small">From: ${q.source}</span>` : "")}</div>
      ${raw(i === 0 && !shared ? exportBlock() : "")}`;
    wire();
    $("#quizAnswer", sheet).focus();
    if (voice) runVoice(q);
  }

  function drawEnd() {
    const of = questions.length;
    const beat = challenge && (score > challenge.got ? "You beat them." : score === challenge.got ? "A tie." : `They got ${challenge.got}. Try again?`);
    const tests = shared ? [] : testsFor(notes);
    const next = tests[0];
    const planned = next && state.events.some((e) => e.type === "review" && e.forEvent === next.id);
    sheet.innerHTML = html`
      ${raw(head())}
      <div class="score" role="status"><b>${score}</b><span>/ ${of}</span></div>
      ${raw(beat ? html`<p class="sub" style="text-align:center">${beat}</p>` : "")}
      <div class="row" style="justify-content:center">
        <button class="btn" data-challenge>${shared ? "Send my score back" : "Challenge a classmate"}</button>
        <button class="btn ghost" data-again>Try again${raw(shared ? "" : " the other way round")}</button>
        ${raw(isReady(state.settings) && notes.length ? `<button class="btn ghost" data-ai>New questions with AI</button>` : "")}
      </div>
      ${raw(next ? html`<section class="panel plan">
        <b>${next.title} is ${friendlyDate(next.date)}.</b>
        <p class="sub">${planned ? "Your reviews are on the calendar." : "Short reviews a few days apart help it stick. Seekto can put them on your calendar."}</p>
        ${raw(planned ? "" : `<div class="row"><button class="btn small" data-plan>Plan reviews before it</button></div>`)}
      </section>` : "")}
      ${raw(shared ? "" : exportBlock())}
      ${raw(shared && onLeave ? `<section class="panel made"><b>Make tests like this from your own classes</b><p class="sub">Seekto turns a class recording or your notes into deadlines on your calendar and a practice test. Free, open source, no account.</p><div class="row"><button class="btn" data-leave>Make your own</button><a class="btn ghost" href="https://github.com/enrjgy-tech/seekto" target="_blank" rel="noopener">See how it works</a></div></section>` : "")}`;
    if (voice) speak(`Done. You got ${score} out of ${of}.`);
    wire();
    $("[data-challenge]", sheet).focus();
    $("[data-plan]", sheet)?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      const { added, dates } = await planReviews(next);
      toast(added ? `Added ${added} review${added > 1 ? "s" : ""}: ${dates.map(friendlyDate).join(", ")}` : "Too close to the test to space reviews out. Practice today!");
      drawEnd();
    });
  }

  function exportBlock() {
    return `<details><summary class="label" style="cursor:pointer">Export this test</summary><div class="row" style="margin-top:10px">${FORMATS.map(([f, label]) => `<button class="btn ghost small" data-export="${f}">${label}</button>`).join("")}</div>
      <p class="note-small" style="margin-top:8px">Import the file into Quizlet, Anki, Google Forms, Kahoot or Moodle.</p></details>`;
  }

  function grade(given) {
    if (answered) return;
    answered = true;
    const q = questions[i];
    const ok = given !== "" && checkAnswer(given, q.answer);
    if (ok) score++;
    const box = $("#quizResult", sheet);
    box.className = `result ${ok ? "ok" : "no"}`;
    box.innerHTML = html`<b>${ok ? "Correct." : given === "" ? "Here's the answer:" : "Not quite."}</b> ${ok ? "" : raw(html`<b>${q.answer}</b>`)} <button class="btn small" data-next style="margin-left:8px">${i + 1 < questions.length ? "Next" : "See my score"}</button>`;
    $("[data-next]", sheet).addEventListener("click", () => { i++; draw(); });
    $("[data-next]", sheet).focus();
    $("#quizAnswer", sheet).readOnly = true;
    return ok;
  }

  async function runVoice(q) {
    await speak(spokenPrompt(q));
    if (!mic || !document.contains(sheet)) return;
    try {
      const heard = await listenOnce();
      if (!document.contains(sheet) || answered) return;
      $("#quizAnswer", sheet).value = heard;
      const ok = grade(heard);
      await speak(ok ? "Correct." : `Not quite. The answer is ${q.answer}.`);
      if (document.contains(sheet)) { i++; draw(); }
    } catch (err) {
      toast(err.message);
    }
  }

  function wire() {
    sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeOverlay));
    sheet.querySelector("[data-answer]")?.addEventListener("submit", (e) => { e.preventDefault(); grade($("#quizAnswer", sheet).value.trim()); });
    sheet.querySelector("[data-skip]")?.addEventListener("click", () => grade(""));
    sheet.querySelector("[data-again]")?.addEventListener("click", () => { flip = !flip; questions = build(); i = 0; score = 0; draw(); });
    sheet.querySelector("[data-leave]")?.addEventListener("click", () => onLeave?.());
    sheet.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", () => shareLink(title, questions)));
    sheet.querySelector("[data-challenge]")?.addEventListener("click", () => shareLink(title, questions, { got: score, of: questions.length }));
    sheet.querySelector("[data-say]")?.addEventListener("click", async () => {
      try {
        toast("Listening…");
        const heard = await listenOnce();
        $("#quizAnswer", sheet).value = heard;
        if (heard) grade(heard);
      } catch (err) { toast(err.message); }
    });
    sheet.querySelector("[data-ai]")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = "Writing questions…";
      try {
        questions = await aiQuestions(notes, count);
        i = 0; score = 0; draw();
      } catch (err) {
        toast(err.message || "The AI couldn't write questions.");
        e.target.disabled = false;
        e.target.textContent = "Try again with AI";
      }
    });
    sheet.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", () => {
      const [fmt, , ext] = FORMATS.find(([f]) => f === b.dataset.export);
      const text = exportQuiz(questions, fmt);
      download(`${title.replace(/[^\w-]+/g, "-").toLowerCase()}-${fmt}.${ext}`, text, ext === "csv" ? "text/csv" : "text/plain");
      copy(text, "Downloaded and copied");
    }));
  }

  draw();
}

/** Open a practice test for the note behind a calendar review. */
export function practiceNote(noteId) {
  const note = state.notes.find((n) => n.id === noteId);
  if (!note) return toast("That note isn't on this device anymore.");
  openQuiz({ notes: [note], title: `Quiz: ${note.title}` });
}
