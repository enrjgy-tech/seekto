// A practice test someone shared as a link. It opens straight into the first question, on its own
// page without the app around it, with no account and nothing to install.
import { $, html } from "./ui.js";
import { saveNote, today } from "./state.js";
import { uid } from "./store.js";
import { go } from "./nav.js";
import { decodeShare, sharedToText, detectSubject, detectTopic } from "../engine/index.js";
import { openQuiz } from "./quiz.js";

function leave(target = "chat") {
  document.body.classList.remove("standalone");
  go(target);
}

export async function render(main, code) {
  document.body.classList.add("standalone");
  main.innerHTML = `<div class="view shared"><p class="note-small">Opening the shared test…</p></div>`;
  let test;
  try {
    test = await decodeShare(code);
  } catch (err) {
    main.innerHTML = html`<div class="view shared"><h1>Shared test</h1><p class="empty">${err.message}</p><button class="btn" id="home">Open Seekto</button></div>`;
    $("#home").addEventListener("click", () => leave());
    return () => document.body.classList.remove("standalone");
  }
  const n = test.questions.length;
  const c = test.challenge;
  main.innerHTML = html`
    <div class="view shared">
      <header class="shared-head">
        <span class="label">Practice test · ${n} question${n > 1 ? "s" : ""}</span>
        <h1>${test.title}</h1>
        <p class="sub">${c ? `Your classmate got ${c.got} of ${c.of}. Can you beat that?` : "A classmate shared this with you."} Your answers stay on this device.</p>
      </header>
      <div id="quizMount" class="shared-quiz"></div>
      <footer class="shared-foot">
        <button class="btn ghost small" id="save">Save to my notes</button>
        <span class="note-small">Made with <a href="#" id="home">Seekto</a>, free and open source</span>
      </footer>
    </div>`;
  openQuiz({ questions: test.questions, title: test.title, shared: true, challenge: c || null, mount: $("#quizMount"), onLeave: () => leave() });
  $("#save").addEventListener("click", async () => {
    const text = sharedToText(test);
    const note = { id: uid("note"), kind: "typed", createdAt: Date.now(), date: today(), title: test.title, text, subject: detectSubject(text) || "General", topic: detectTopic(text), shared: true };
    await saveNote(note);
    leave(`note/${note.id}`);
  });
  $("#home").addEventListener("click", (e) => { e.preventDefault(); leave(); });
  return () => document.body.classList.remove("standalone");
}
