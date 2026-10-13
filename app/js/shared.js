// A practice test someone shared as a link. It opens straight into the first question, on its own
// page without the app around it, with no account and nothing to install.
import { $, html, raw } from "./ui.js";
import { saveNote, today } from "./state.js";
import { uid } from "./store.js";
import { go } from "./nav.js";
import { decodeShare, sharedToText, detectSubject, detectTopic } from "../engine/index.js";
import { openQuiz } from "./quiz.js";
import { t } from "./i18n.js";

function leave(target = "chat") {
  document.body.classList.remove("standalone");
  go(target);
}

export async function render(main, code) {
  document.body.classList.add("standalone");
  main.innerHTML = `<div class="view shared"><p class="note-small">${t("Opening the shared test…")}</p></div>`;
  let test;
  try {
    test = await decodeShare(code);
  } catch (err) {
    main.innerHTML = html`<div class="view shared"><h1>${t("Shared test")}</h1><p class="empty">${err.message}</p><button class="btn" id="home">${t("Open Seekto")}</button></div>`;
    $("#home").addEventListener("click", () => leave());
    return () => document.body.classList.remove("standalone");
  }
  const n = test.questions.length;
  const c = test.challenge?.got > 0 ? test.challenge : null;
  main.innerHTML = html`
    <div class="view shared">
      <header class="shared-head">
        <span class="label">${n > 1 ? t("Practice test · {n} questions", { n }) : t("Practice test · 1 question")}</span>
        <h1>${test.title}</h1>
        <p class="sub">${c ? (c.got === c.of ? t("Your classmate got all {of} right. Can you match that?", { of: c.of }) : t("Your classmate got {got} of {of}. Can you beat that?", { got: c.got, of: c.of })) : t("A classmate shared this with you.")} ${t("Your answers stay on this device.")}</p>
      </header>
      <div id="quizMount" class="shared-quiz"></div>
      <footer class="shared-foot">
        <button class="btn ghost small" id="save">${t("Save to my notes")}</button>
        <span class="note-small">${raw(t('Made with <a href="#" id="home">Seekto</a>, free and open source'))}</span>
      </footer>
    </div>`;
  openQuiz({
    questions: test.questions,
    title: test.title,
    shared: true,
    challenge: c || null,
    mount: $("#quizMount"),
    onLeave: () => leave(),
  });
  $("#save").addEventListener("click", async () => {
    const text = sharedToText(test);
    const note = {
      id: uid("note"),
      kind: "typed",
      createdAt: Date.now(),
      date: today(),
      title: test.title,
      text,
      subject: detectSubject(text) || "General",
      topic: detectTopic(text),
      shared: true,
    };
    await saveNote(note);
    leave(`note/${note.id}`);
  });
  $("#home").addEventListener("click", (e) => {
    e.preventDefault();
    leave();
  });
  return () => document.body.classList.remove("standalone");
}
