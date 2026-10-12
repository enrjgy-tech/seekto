// Practice tests from notes: typed or spoken answers, both directions, and exports.
import { html, raw, openOverlay, closeOverlay, download, copy, toast, $ } from "./ui.js";
import { state, noteText } from "./state.js";
import { makeQuiz, checkAnswer, exportQuiz, isReady, chat, encodeShare } from "../engine/index.js";
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

/** A link anyone can open to take this test. The questions live after "#", so no server sees them. */
export async function shareLink(title, questions) {
  const url = `${location.origin}${location.pathname}#s=${await encodeShare({ title, questions })}`;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title, text: `Practice test: ${title}`, url }); return url; } catch { /* fall back to copying */ }
  }
  await copy(url, "Link copied. Anyone can open it, no account needed.");
  return url;
}

/**
 * Open a quiz built from these notes, or from ready-made questions (a shared test).
 * voice: read questions aloud and listen for answers.
 */
export function openQuiz({ notes = [], questions: given = null, title = "Practice test", voice = false, count = 10, shared = false }) {
  let questions = given || makeQuiz(notes.map((n) => ({ title: n.title, topic: n.topic, text: noteText(n) })), { count });
  let i = 0;
  let score = 0;
  let answered = false;
  const sheet = openOverlay("");

  function draw() {
    if (!questions.length) {
      sheet.innerHTML = html`
        <div class="view-head"><h2>${title}</h2><button class="btn ghost small" data-close>Close</button></div>
        <p class="empty">These notes don't have enough to make questions yet. Notes with definitions ("X is…", "X means…") work best.</p>
        ${raw(isReady(state.settings) ? `<button class="btn" data-ai>Make questions with AI</button>` : `<p class="note-small">Connecting an AI model in Settings lets Seekto write questions from any notes.</p>`)}`;
      return wire();
    }
    if (i >= questions.length) {
      sheet.innerHTML = html`
        <div class="view-head"><h2>${title}</h2><button class="btn ghost small" data-close>Close</button></div>
        <p style="font-size:20px">You got <b>${score}</b> of ${questions.length}.</p>
        <div class="row"><button class="btn" data-again>Try again</button>${raw(!shared ? `<button class="btn ghost" data-share>Share this test</button>` : "")}${raw(isReady(state.settings) && notes.length ? `<button class="btn ghost" data-ai>New questions with AI</button>` : "")}</div>
        ${raw(exportBlock())}`;
      if (voice) speak(`Done. You got ${score} out of ${questions.length}.`);
      return wire();
    }
    const q = questions[i];
    const p = promptFor(q);
    answered = false;
    sheet.innerHTML = html`
      <div class="view-head"><h2>${title}</h2><span class="note-small mono">${i + 1} / ${questions.length}</span><button class="btn ghost small" data-close>Close</button></div>
      <div class="qcard">
        <span class="label">${p.label}</span>
        <div class="prompt">${p.text}</div>
        <form class="row" data-answer>
          <input type="text" id="quizAnswer" autocomplete="off" placeholder="Your answer" aria-label="Your answer" style="flex:1">
          ${raw(canListen ? `<button type="button" class="iconbtn" data-say title="Answer out loud" aria-label="Answer out loud"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : "")}
          <button class="btn">Check</button>
        </form>
        <div class="result" id="quizResult"></div>
      </div>
      <div class="row"><button class="btn ghost small" data-skip>Show answer</button>${raw(i === 0 && !shared ? `<button class="btn ghost small" data-share>Share as a link</button>` : "")}${raw(q.source ? html`<span class="note-small">From: ${q.source}</span>` : "")}</div>
      ${raw(i === 0 ? exportBlock() : "")}`;
    wire();
    $("#quizAnswer", sheet).focus();
    if (voice) runVoice(q);
  }

  function exportBlock() {
    return `<details><summary class="label" style="cursor:pointer">Export this test</summary><div class="row" style="margin-top:10px">${FORMATS.map(([f, label]) => `<button class="btn ghost small" data-export="${f}">${label}</button>`).join("")}</div>
      <p class="note-small" style="margin-top:8px">Import the file into Quizlet, Anki, Google Forms, Kahoot or Moodle. Direct upload to connected sites is on the roadmap.</p></details>`;
  }

  function grade(given) {
    if (answered) return;
    answered = true;
    const q = questions[i];
    const ok = checkAnswer(given, q.answer);
    if (ok) score++;
    const box = $("#quizResult", sheet);
    box.className = `result ${ok ? "ok" : "no"}`;
    box.innerHTML = html`<b>${ok ? "Correct." : "Not quite."}</b> ${ok ? "" : raw(html`The answer is <b>${q.answer}</b>.`)} <button class="btn small" data-next style="margin-left:8px">Next</button>`;
    $("[data-next]", sheet).addEventListener("click", () => { i++; draw(); });
    $("[data-next]", sheet).focus();
    return ok;
  }

  async function runVoice(q) {
    await speak(spokenPrompt(q));
    if (!canListen || !document.contains(sheet)) return;
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
    sheet.querySelector("[data-answer]")?.addEventListener("submit", (e) => { e.preventDefault(); grade($("#quizAnswer", sheet).value); });
    sheet.querySelector("[data-skip]")?.addEventListener("click", () => grade(""));
    sheet.querySelector("[data-again]")?.addEventListener("click", () => { i = 0; score = 0; draw(); });
    sheet.querySelectorAll("[data-share]").forEach((b) => b.addEventListener("click", () => shareLink(title, questions)));
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
