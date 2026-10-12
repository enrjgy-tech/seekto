// A practice test someone shared as a link. Opens with no account and nothing to install.
import { $, html } from "./ui.js";
import { saveNote, today } from "./state.js";
import { uid } from "./store.js";
import { go } from "./nav.js";
import { decodeShare, sharedToText, detectSubject, detectTopic } from "../engine/index.js";
import { openQuiz } from "./quiz.js";

export async function render(main, code) {
  main.innerHTML = `<div class="view"><p class="note-small">Opening the shared test…</p></div>`;
  let test;
  try {
    test = await decodeShare(code);
  } catch (err) {
    main.innerHTML = html`<div class="view"><h1>Shared test</h1><p class="empty">${err.message}</p><button class="btn" id="home">Open Seekto</button></div>`;
    $("#home").addEventListener("click", () => go("chat"));
    return;
  }
  const n = test.questions.length;
  main.innerHTML = html`
    <div class="view" style="max-width:640px">
      <span class="label">Shared practice test</span>
      <h1 style="margin:6px 0 4px">${test.title}</h1>
      <p class="sub">${n} question${n > 1 ? "s" : ""}. No account needed, and nothing you answer leaves this device.</p>
      <div class="row"><button class="btn" id="start">Start practicing</button><button class="btn ghost" id="save">Save to my notes</button></div>
      <section class="panel" style="margin-top:28px">
        <b>Made with Seekto</b>
        <p class="sub">Seekto turns classes and meetings into notes, deadlines and practice tests. It's free and open source, works without an account, and keeps your data on your device.</p>
        <div class="row"><button class="btn ghost small" id="home">Try Seekto</button><a class="btn ghost small" href="https://github.com/enrjgy-tech/seekto" target="_blank" rel="noopener">See the code</a></div>
      </section>
    </div>`;
  $("#start").addEventListener("click", () => openQuiz({ questions: test.questions, title: test.title, shared: true }));
  $("#save").addEventListener("click", async () => {
    const text = sharedToText(test);
    const note = { id: uid("note"), kind: "typed", createdAt: Date.now(), date: today(), title: test.title, text, subject: detectSubject(text) || "General", topic: detectTopic(text), shared: true };
    await saveNote(note);
    go(`note/${note.id}`);
  });
  $("#home").addEventListener("click", () => go("chat"));
}
