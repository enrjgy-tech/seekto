// Practice tests from notes: typed or spoken answers, a score at the end, sharing with
// "beat my score", spaced reviews before the test, and exports.
import { html, raw, openOverlay, closeOverlay, download, copy, toast, announce, $, friendlyDate, esc } from "./ui.js";
import { state, noteText, saveEvent, today } from "./state.js";
import { uid } from "./store.js";
import { makeQuiz, checkAnswer, exportQuiz, isReady, chat, encodeShare, shuffle, reviewPlan } from "../engine/index.js";
import { speak, listenOnce, canListen } from "./voice.js";
import { t } from "./i18n.js";

// A function so the labels follow the interface language.
const formats = () => [
  ["quizlet", "Quizlet", "txt"],
  ["anki", "Anki", "txt"],
  ["csv", t("CSV (Google Forms, Kahoot, spreadsheets)"), "csv"],
  ["gift", "Moodle (GIFT)", "txt"],
  ["text", t("Printable text"), "txt"],
];

function promptFor(q) {
  if (q.choices && q.kind === "blank") return { label: t("Pick the missing word"), text: q.prompt };
  if (q.kind === "term") return { label: t("Which term means…"), text: q.prompt };
  if (q.kind === "define") return { label: t("What does this mean?"), text: q.prompt };
  if (q.kind === "blank") return { label: t("Fill in the blank"), text: q.prompt };
  return { label: t("Question"), text: q.prompt };
}

function spokenPrompt(q) {
  if (q.choices)
    return `${spokenPrompt({ ...q, choices: null })} ${t("Is it: {options}?", { options: q.choices.join(t(", or ")) })}`;
  if (q.kind === "term") return t("Which term means: {prompt}?", { prompt: q.prompt });
  if (q.kind === "define") return t("What does {term} mean?", { term: q.prompt });
  if (q.kind === "blank") return t("Fill in the blank. {prompt}", { prompt: q.prompt.replace(/_{3,}/g, t("blank")) });
  return q.prompt;
}

async function aiQuestions(notes, count) {
  const material = notes
    .map((n) => `# ${n.title}\n${noteText(n).slice(0, 6000)}`)
    .join("\n\n")
    .slice(0, 16000);
  const reply = await chat(state.settings, {
    system: "You write short practice questions from a student's class notes. Reply with JSON only.",
    messages: [
      {
        role: "user",
        content: `Write ${count} practice questions from these notes. Mix definitions, "which term" questions and short-answer questions. Reply as a JSON array of {"prompt": "...", "answer": "..."} with short answers.\n\n${material}`,
      },
    ],
    maxTokens: 1800,
  });
  const json = reply.slice(reply.indexOf("["), reply.lastIndexOf("]") + 1);
  return JSON.parse(json)
    .filter((q) => q.prompt && q.answer)
    .map((q) => ({ kind: "ai", prompt: String(q.prompt), answer: String(q.answer), source: t("AI") }));
}

/**
 * A link anyone can open to take this test. The questions (and your score, if you finished)
 * live after "#", so no server sees them.
 */
export async function shareLink(title, questions, challenge = null) {
  const url = `${location.origin}${location.pathname}#s=${await encodeShare({ title, questions, challenge })}`;
  const text = challenge
    ? challenge.got === challenge.of
      ? t('I got {got}/{of} on "{title}". Can you match it?', { got: challenge.got, of: challenge.of, title })
      : t('I got {got}/{of} on "{title}". Can you beat me?', { got: challenge.got, of: challenge.of, title })
    : t("Practice test: {title}", { title });
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title, text, url });
      return url;
    } catch {
      /* fall back to copying */
    }
  }
  await copy(`${text} ${url}`, t("Copied. Paste it in your class chat; anyone can open it, no account needed."));
  return url;
}

/** Upcoming tests on the calendar that came from these notes. */
function testsFor(notes) {
  const ids = new Set(notes.map((n) => n.id));
  const now = today();
  return state.events
    .filter((e) => e.type === "test" && e.date > now && ids.has(e.noteId))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function planReviews(test) {
  const dates = reviewPlan(test.date, today());
  let added = 0;
  for (const date of dates) {
    if (state.events.some((e) => e.type === "review" && e.forEvent === test.id && e.date === date)) continue;
    await saveEvent({
      id: uid("event"),
      type: "review",
      title: t("Review: {title}", { title: test.title }),
      date,
      noteId: test.noteId,
      forEvent: test.id,
      source: "plan",
    });
    added++;
  }
  return { added, dates };
}

/**
 * Open a quiz built from these notes, or from ready-made questions (a shared test).
 * mount: render inside this element instead of a dialog (the shared-test page).
 * voice: read questions aloud and listen for answers.
 */
export function openQuiz({
  notes = [],
  questions: given = null,
  title = t("Practice test"),
  voice = false,
  count = 10,
  shared = false,
  challenge = null,
  mount = null,
  onLeave = null,
}) {
  let flip = false;
  // A shared test is shuffled too, but still opens on a multiple-choice question (one tap on a phone)
  const mcFirst = (list) => {
    const at = list.findIndex((q) => q.choices);
    if (at > 0) list.unshift(...list.splice(at, 1));
    return list;
  };
  const build = () =>
    given
      ? mcFirst(shuffle(given))
      : makeQuiz(
          // A recorded class brings only the definitions the student kept; typed or pasted notes are clean enough to use as found
          notes.map((n) => ({
            title: n.title,
            topic: n.topic,
            text: noteText(n),
            ...(n.cues?.length ? { definitions: n.flashcards || [] } : {}),
          })),
          { count, flip },
        );
  let questions = build();
  let i = 0;
  let score = 0;
  let answered = false;
  // Answering out loud uses the browser's speech service (online in Chrome and Edge), so a shared
  // test, which promises that answers stay on the device, doesn't offer it.
  const mic = canListen && !shared;
  const sheet = mount || openOverlay("");
  const close = mount ? "" : `<button class="btn ghost small" data-close>${t("Close")}</button>`;
  if (!mount) sheet.closest(".overlay")?.setAttribute("aria-label", title);

  function head(extra = "") {
    // On the shared-test page the page itself shows the title
    return mount
      ? html`<div class="view-head quiz-head"><span></span>${raw(extra)}</div>`
      : html`<div class="view-head"><h2 id="quizTitle">${title}</h2>${raw(extra)}${raw(close)}</div>`;
  }

  function draw() {
    if (!questions.length) {
      sheet.innerHTML = html`
        ${raw(head())}
        <p class="empty">${t('These notes don\'t have enough to make questions yet. Notes where a term is explained ("mitosis is when…", "we call this…") work best.')}</p>
        ${raw(isReady(state.settings) ? `<button class="btn" data-ai>${t("Make questions with AI")}</button>` : `<p class="note-small">${t("Connecting an AI model in Settings lets Seekto write questions from any notes.")}</p>`)}`;
      return wire();
    }
    if (i >= questions.length) return drawEnd();
    const q = questions[i];
    const p = promptFor(q);
    answered = false;
    sheet.innerHTML = html`
      ${raw(head(`<span class="note-small mono"><span aria-hidden="true">${i + 1} / ${questions.length}</span><span class="sr-only">${t("Question {n} of {total}", { n: i + 1, total: questions.length })}</span></span>`))}
      <div class="progress" aria-hidden="true"><span style="width:${Math.round((i / questions.length) * 100)}%"></span></div>
      <div class="qcard">
        <span class="label" id="qLabel">${p.label}</span>
        <div class="prompt" id="qPrompt">${raw(esc(p.text).replace(/_{3,}/g, `<span aria-hidden="true">_____</span><span class="sr-only">${esc(t("blank"))}</span>`))}</div>
        ${raw(
          q.choices
            ? html`<div class="choices" role="group" aria-labelledby="qLabel qPrompt">${raw(q.choices.map((c, n) => html`<button type="button" class="choice" data-choice="${n}"><span class="key" aria-hidden="true">${String.fromCharCode(65 + n)}</span><span>${c}</span></button>`).join(""))}</div>`
            : html`<form class="row" data-answer>
          <input type="text" id="quizAnswer" autocomplete="off" placeholder="${t("Your answer")}" aria-labelledby="qLabel qPrompt" style="flex:1">
          ${raw(mic ? `<button type="button" class="iconbtn" data-say title="${esc(t("Answer out loud (uses your browser's speech service)"))}" aria-label="${esc(t("Answer out loud"))}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : "")}
          <button class="btn">${t("Check")}</button>
        </form>`,
        )}
        <div class="result" id="quizResult" role="status" aria-live="polite"></div>
      </div>
      <div class="row"><button class="btn ghost small" data-skip>${t("Show answer")}</button>${raw(i === 0 && !shared ? `<button class="btn ghost small" data-share>${t("Share as a link")}</button>` : "")}${raw(q.source && !shared ? html`<span class="note-small">${t("From: {source}", { source: q.source })}</span>` : "")}</div>
      ${raw(i === 0 && !shared ? exportBlock() : "")}`;
    wire();
    // On the shared-test page, the first question doesn't grab focus, so the page's heading and
    // "your classmate got…" line are read first.
    if (!(mount && i === 0)) ($("#quizAnswer", sheet) || $(".choice", sheet)).focus();
    // Letters pick an option: A, B, C, D
    sheet.onkeydown = (e) => {
      if (answered || e.ctrlKey || e.metaKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
      const n = "abcde".indexOf(e.key.toLowerCase());
      const b = n >= 0 && sheet.querySelector(`[data-choice="${n}"]`);
      if (b) {
        e.preventDefault();
        b.click();
      }
    };
    if (voice) runVoice(q);
  }

  function drawEnd() {
    const of = questions.length;
    // A score of 0 isn't something to brag about or to beat, so it isn't sent or compared.
    const beat =
      challenge?.got > 0 &&
      (score > challenge.got
        ? t("You beat them.")
        : score === challenge.got
          ? score === challenge.of
            ? t("Both perfect.")
            : t("A tie.")
          : t("They got {got}. Try again?", { got: challenge.got }));
    const tests = shared ? [] : testsFor(notes);
    const next = tests[0];
    const planned = next && state.events.some((e) => e.type === "review" && e.forEvent === next.id);
    sheet.innerHTML = html`
      ${raw(head())}
      <div class="score" role="status"><b>${score}</b><span>/ ${of}</span></div>
      ${raw(beat ? html`<p class="sub" style="text-align:center">${beat}</p>` : "")}
      <div class="row" style="justify-content:center">
        ${raw(score > 0 ? html`<button class="btn" data-challenge>${shared ? t("Send my score back") : t("Challenge a classmate")}</button>` : html`<button class="btn" data-share>${t("Share this test")}</button>`)}
        <button class="btn ghost" data-again>${shared ? t("Try again") : t("Try again the other way round")}</button>
        ${raw(isReady(state.settings) && notes.length ? `<button class="btn ghost" data-ai>${t("New questions with AI")}</button>` : "")}
      </div>
      ${raw(
        next
          ? html`<section class="panel plan">
        <b>${t("{title} is {date}.", { title: next.title, date: friendlyDate(next.date) })}</b>
        <p class="sub">${planned ? t("Your reviews are on the calendar.") : t("Short reviews a few days apart help it stick. Seekto can put them on your calendar.")}</p>
        ${raw(planned ? "" : `<div class="row"><button class="btn small" data-plan>${t("Plan reviews before it")}</button></div>`)}
      </section>`
          : "",
      )}
      ${raw(shared ? "" : exportBlock())}
      ${raw(shared && onLeave ? `<section class="panel made"><b>${t("Make tests like this from your own classes")}</b><p class="sub">${t("Seekto turns a class recording or your notes into deadlines on your calendar and a practice test. Free, open source, no account.")}</p><div class="row"><button class="btn" data-leave>${t("Make your own")}</button><a class="btn ghost" href="https://github.com/enrjgy-tech/seekto" target="_blank" rel="noopener">${t("See how it works")}</a></div></section>` : "")}`;
    if (voice) speak(t("Done. You got {score} out of {of}.", { score, of }));
    wire();
    ($("[data-challenge]", sheet) || $("[data-share]", sheet)).focus();
    announce(t("You got {score} of {of}.", { score, of }));
    $("[data-plan]", sheet)?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      const { added, dates } = await planReviews(next);
      toast(
        added
          ? added > 1
            ? t("Added {n} reviews: {dates}", { n: added, dates: dates.map(friendlyDate).join(", ") })
            : t("Added 1 review: {dates}", { dates: dates.map(friendlyDate).join(", ") })
          : t("Too close to the test to space reviews out. Practice today!"),
      );
      drawEnd();
    });
  }

  function exportBlock() {
    return `<details><summary class="label" style="cursor:pointer">${t("Export this test")}</summary><div class="row" style="margin-top:10px">${formats()
      .map(([f, label]) => `<button class="btn ghost small" data-export="${f}">${label}</button>`)
      .join("")}</div>
      <p class="note-small" style="margin-top:8px">${t("Import the file into Quizlet, Anki, Google Forms, Kahoot or Moodle.")}</p></details>`;
  }

  // given: what was typed or said ("" = show the answer); picked: the chosen option's number
  function grade(given, picked = null) {
    if (answered) return;
    answered = true;
    const q = questions[i];
    const ok = picked !== null ? q.choices[picked] === q.answer : given !== "" && checkAnswer(given, q.answer);
    if (ok) score++;
    const letter = q.choices ? String.fromCharCode(65 + q.choices.indexOf(q.answer)) : "";
    if (q.choices) {
      // Options stay in the tab order (aria-disabled, not disabled) so a screen reader can go back to them
      sheet.querySelectorAll(".choice").forEach((b, n) => {
        b.setAttribute("aria-disabled", "true");
        const mark = q.choices[n] === q.answer ? t("right answer") : n === picked ? t("your answer") : "";
        if (q.choices[n] === q.answer) b.classList.add("right");
        else if (n === picked) b.classList.add("wrong");
        if (mark) b.insertAdjacentHTML("beforeend", html`<span class="sr-only"> (${mark})</span>`);
      });
    }
    // Long answers typed from memory rarely match word for word, so the student can mark them
    const selfMark = !ok && !q.choices && q.kind !== "blank" && q.answer.split(/\s+/).length > 3;
    const next = i + 1 < questions.length ? t("Next") : t("See my score");
    const box = $("#quizResult", sheet);
    box.className = `result ${ok ? "ok" : selfMark ? "" : "no"}`;
    box.innerHTML = selfMark
      ? html`<b>${given === "" ? t("Here's the answer:") : t("Compare with the answer:")}</b> <b>${q.answer}</b><span class="row selfmark"><button class="btn small" data-mine="1">${t("I got it")}</button><button class="btn ghost small" data-mine="0">${t("I missed it")}</button></span>`
      : html`<b>${ok ? t("Correct.") : given === "" && picked === null ? (q.choices ? t("The answer is {letter}.", { letter }) : t("Here's the answer:")) : q.choices ? t("Not quite. The answer is {letter}.", { letter }) : t("Not quite.")}</b>${raw(!ok && q.choices ? html`<span class="sr-only"> ${q.answer}</span>` : "")} ${ok || q.choices ? "" : raw(html`<b>${q.answer}</b>`)} <button class="btn small" data-next style="margin-left:8px">${next}</button>`;
    const go = () => {
      i++;
      draw();
    };
    $("[data-next]", sheet)?.addEventListener("click", go);
    sheet.querySelectorAll("[data-mine]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.mine === "1") score++;
        go();
      }),
    );
    ($("[data-next]", sheet) || $("[data-mine]", sheet)).focus();
    if ($("#quizAnswer", sheet)) $("#quizAnswer", sheet).readOnly = true;
    if (selfMark) return null;
    return ok;
  }

  async function runVoice(q) {
    await speak(spokenPrompt(q));
    if (!mic || !document.contains(sheet)) return;
    try {
      const heard = await listenOnce();
      if (!document.contains(sheet) || answered) return;
      let ok;
      if (q.choices) {
        const n = q.choices.findIndex((c) => checkAnswer(heard, c));
        ok = grade(heard, n >= 0 ? n : -1);
      } else {
        $("#quizAnswer", sheet).value = heard;
        ok = grade(heard);
      }
      if (ok === null) return; // the student marks long answers on screen
      await speak(ok ? t("Correct.") : t("Not quite. The answer is {answer}.", { answer: q.answer }));
      if (document.contains(sheet)) {
        i++;
        draw();
      }
    } catch (err) {
      toast(err.message);
    }
  }

  function wire() {
    sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeOverlay));
    sheet.querySelector("[data-answer]")?.addEventListener("submit", (e) => {
      e.preventDefault();
      grade($("#quizAnswer", sheet).value.trim());
    });
    sheet.querySelector("[data-skip]")?.addEventListener("click", () => grade(""));
    sheet.querySelectorAll("[data-choice]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!answered) grade(b.textContent, Number(b.dataset.choice));
      }),
    );
    sheet.querySelector("[data-again]")?.addEventListener("click", () => {
      flip = !flip;
      questions = build();
      i = 0;
      score = 0;
      draw();
    });
    sheet.querySelector("[data-leave]")?.addEventListener("click", () => onLeave?.());
    sheet
      .querySelectorAll("[data-share]")
      .forEach((b) => b.addEventListener("click", () => shareLink(title, questions)));
    sheet
      .querySelector("[data-challenge]")
      ?.addEventListener("click", () => shareLink(title, questions, { got: score, of: questions.length }));
    sheet.querySelector("[data-say]")?.addEventListener("click", async () => {
      try {
        toast(t("Listening…"));
        const heard = await listenOnce();
        $("#quizAnswer", sheet).value = heard;
        if (heard) grade(heard);
      } catch (err) {
        toast(err.message);
      }
    });
    sheet.querySelector("[data-ai]")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      e.target.textContent = t("Writing questions…");
      try {
        questions = await aiQuestions(notes, count);
        i = 0;
        score = 0;
        draw();
      } catch (err) {
        toast(err.message || t("The AI couldn't write questions."));
        e.target.disabled = false;
        e.target.textContent = t("Try again with AI");
      }
    });
    sheet.querySelectorAll("[data-export]").forEach((b) =>
      b.addEventListener("click", () => {
        const [fmt, , ext] = formats().find(([f]) => f === b.dataset.export);
        const text = exportQuiz(questions, fmt);
        download(
          `${title.replace(/[^\w-]+/g, "-").toLowerCase()}-${fmt}.${ext}`,
          text,
          ext === "csv" ? "text/csv" : "text/plain",
        );
        copy(text, t("Downloaded and copied"));
      }),
    );
  }

  draw();
}

/** Open a practice test for the note behind a calendar review. */
export function practiceNote(noteId) {
  const note = state.notes.find((n) => n.id === noteId);
  if (!note) return toast(t("That note isn't on this device anymore."));
  openQuiz({ notes: [note], title: t("Quiz: {title}", { title: note.title }) });
}
