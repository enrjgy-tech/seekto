// The home screen: a guided assistant that answers from your notes and calendar,
// starts quizzes, and talks out loud in talk mode.
import { $, html, raw, toast } from "./ui.js";
import { state, today, noteText, updateSettings } from "./state.js";
import { go } from "./nav.js";
import { classify, answerLocally, searchNotes, describeDay, isReady, chat as askModel } from "../engine/index.js";
import { openQuiz } from "./quiz.js";
import { speak, listenOnce, canListen } from "./voice.js";

const HISTORY_KEY = "seekto.chat";
let history = loadHistory();
let talk = false;

function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory() {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40))); } catch { /* not available */ }
}

const SUGGESTIONS = ["What's due this week?", "When is my next test?", "Quiz me", "Start recording"];

function stepsHtml() {
  const s = state.settings;
  const steps = [
    ["record", "Record a class", "Notes, marks and dates are saved by themselves.", state.notes.some((n) => n.kind === "recording")],
    ["calendar", "Add your school calendar", "Import from Canvas, Google Classroom or any .ics file.", state.events.some((e) => e.source === "import")],
    ["ask", "Ask me anything", "“When is my math test?” or “Quiz me on chapter 5.”", history.some((m) => m.role === "user")],
    ["settings", "Choose an AI model (optional)", "On your computer, free cloud or paid cloud.", isReady(s)],
  ];
  return steps.map(([go, title, text, done]) => html`<button class="step" data-step="${go}"><b>${title}</b><span>${text}</span>${raw(done ? '<span class="done">Done</span>' : "")}</button>`).join("");
}

export function render(main) {
  main.innerHTML = html`
    <div style="overflow-y:auto;min-height:0" id="chatScroll">
      <div class="view">
        <section class="welcome" id="welcome">
          <div class="view-head"><h1>${greeting()}</h1><button class="btn ghost small phone-only" id="phoneSettings">Settings</button></div>
          <p class="sub">I'm Seekto, your study assistant. I keep your class notes, your calendar and your assignments in one place, and I help you study.</p>
          <div class="steps">${raw(stepsHtml())}</div>
        </section>
        <div class="msgs" id="msgs" aria-live="polite"></div>
      </div>
    </div>
    <div class="composer">
      <div class="talk-banner" id="talkBanner" hidden><span class="pulse"></span><span id="talkState">Talk mode is on. Ask out loud.</span></div>
      <div class="suggest" id="suggest" style="max-width:880px;margin:0 auto 10px"></div>
      <form id="chatForm">
        <label for="chatInput" class="label" style="position:absolute;left:-9999px">Message</label>
        <input id="chatInput" type="text" autocomplete="off" placeholder="Ask about your classes, deadlines or notes">
        <button type="button" class="iconbtn" id="talkBtn" aria-pressed="false" title="Talk mode" aria-label="Talk mode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
        <button class="btn">Send</button>
      </form>
    </div>`;

  $("#suggest").innerHTML = SUGGESTIONS.map((s) => html`<button type="button">${s}</button>`).join("");
  $("#suggest").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send(b.textContent); });
  $("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#chatInput").value.trim(); if (v) { $("#chatInput").value = ""; send(v); } });
  $("#welcome").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    if (b.dataset.step === "ask") $("#chatInput").focus();
    else go(b.dataset.step);
  });
  $("#talkBtn").addEventListener("click", toggleTalk);
  $("#phoneSettings").addEventListener("click", () => go("settings"));
  drawHistory();
  if (!state.settings.onboarded && !history.length) {
    updateSettings({ onboarded: true });
  }
  return () => { talk = false; window.speechSynthesis?.cancel(); };
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

function drawHistory() {
  const box = $("#msgs");
  if (!box) return;
  $("#welcome").hidden = history.length > 0;
  box.innerHTML = history.map(messageHtml).join("");
  box.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("click", () => runAction(JSON.parse(b.dataset.action))));
  const scroll = $("#chatScroll");
  scroll.scrollTop = scroll.scrollHeight;
}

function messageHtml(m) {
  if (m.role === "user") return html`<div class="msg user"><div class="bubble">${m.text}</div></div>`;
  const actions = (m.actions || []).map((a) => html`<button class="btn ghost small" data-action='${JSON.stringify(a)}'>${a.label}</button>`).join("");
  const items = (m.items || []).map((e) => html`<div class="event"><span class="when">${describeDay(e.date, today())}</span><span>${e.title}</span><span class="kind ${e.type}">${e.type || ""}</span></div>`).join("");
  return html`<div class="msg bot"><span class="who">Seekto</span><div class="bubble">${m.text}</div>${raw(items ? `<div class="items">${items}</div>` : "")}${raw(actions ? `<div class="row">${actions}</div>` : "")}</div>`;
}

function runAction(a) {
  if (a.go) return go(a.go);
  if (a.quiz !== undefined) return startQuiz(a.quiz);
}

function notesFor(topic) {
  if (!topic) return state.notes.slice(0, 8);
  const t = topic.toLowerCase();
  const bySubject = state.notes.filter((n) => `${n.subject || ""} ${n.title}`.toLowerCase().includes(t));
  if (bySubject.length) return bySubject;
  const hits = searchNotes(state.notes.map((n) => ({ ...n, text: noteText(n) })), topic, 8);
  return [...new Map(hits.map((h) => [h.note.id, state.notes.find((n) => n.id === h.note.id)])).values()];
}

function startQuiz(topic) {
  const notes = notesFor(topic);
  if (!notes.length) { reply({ text: topic ? `I don't have notes on ${topic} yet. Record a class or add a note first.` : "You don't have any notes yet. Record a class or add a note first.", actions: [{ label: "Record a class", go: "record" }] }); return; }
  openQuiz({ notes, title: topic ? `Quiz: ${topic}` : "Practice test", voice: talk });
}

function reply(m) {
  history.push({ role: "bot", ...m });
  saveHistory();
  drawHistory();
  if (talk && state.settings.speak !== false) return speak(m.speak || m.text);
  return Promise.resolve();
}

async function send(text) {
  history.push({ role: "user", text });
  saveHistory();
  drawHistory();
  const parsed = classify(text);

  if (parsed.intent === "record") { await reply({ text: "Opening the recorder." }); return go("record"); }
  if (parsed.intent === "quiz") {
    const notes = notesFor(parsed.topic);
    await reply({ text: notes.length ? `Starting a quiz from ${notes.length} note${notes.length > 1 ? "s" : ""}${parsed.topic ? ` on ${parsed.topic}` : ""}.` : "I need some notes first." });
    return startQuiz(parsed.topic);
  }
  if (parsed.intent === "research") {
    return reply({ text: "Research & assignments keeps your topic, rubric, past notes and videos together, and builds a plan.", actions: [{ label: "Open research", go: "research" }] });
  }

  const local = answerLocally(parsed, { notes: state.notes.map((n) => ({ ...n, text: noteText(n) })), events: state.events, today: today() });
  const actions = local.source ? [{ label: `Open "${local.source.title}"`, go: `note/${local.source.id}` }] : [];
  if (local.text && !local.needsModel) return reply({ text: local.text, items: local.items?.slice(0, 5), actions });

  if (isReady(state.settings)) {
    const pending = { role: "bot", text: "Thinking…" };
    history.push(pending);
    drawHistory();
    try {
      const answer = await askModel(state.settings, { system: systemPrompt(text), messages: conversation(), maxTokens: 900 });
      history.pop();
      return reply({ text: answer.trim() || "I don't have an answer for that.", actions });
    } catch (err) {
      history.pop();
      return reply({ text: `${local.text ? `${local.text}\n\n` : ""}(${err.message})`, actions: [{ label: "AI settings", go: "settings" }] });
    }
  }
  const hits = searchNotes(state.notes.map((n) => ({ ...n, text: noteText(n) })), text, 3);
  if (local.text) return reply({ text: `${local.text}\n\nFor open questions, choose an AI model in Settings.`, actions: [...actions, { label: "AI settings", go: "settings" }] });
  if (hits.length) {
    return reply({
      text: `Here's what your notes say:\n${hits.map((h) => `• ${h.note.title}: "${h.line}"`).join("\n")}\n\nFor open questions, choose an AI model in Settings.`,
      actions: [{ label: `Open "${hits[0].note.title}"`, go: `note/${hits[0].note.id}` }, { label: "AI settings", go: "settings" }],
    });
  }
  return reply({
    text: "I can answer questions about your calendar and notes, start quizzes and record classes without an AI model. For open questions, choose one in Settings: on your computer, free cloud, or paid cloud.",
    actions: [{ label: "AI settings", go: "settings" }],
  });
}

function conversation() {
  return history
    .filter((m) => m.text && m.text !== "Thinking…")
    .slice(-10)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
}

function systemPrompt(question) {
  const hits = searchNotes(state.notes.map((n) => ({ ...n, text: noteText(n) })), question, 6);
  const notes = hits.map((h) => `- [${h.note.title}, ${h.note.date}] ${h.line}`).join("\n") || "(no matching notes)";
  const events = state.events.filter((e) => e.date >= today()).slice(0, 12).map((e) => `- ${e.date}: ${e.title}`).join("\n") || "(nothing upcoming)";
  return `You are Seekto, a friendly study assistant for a student. Today is ${today()}.
Use the student's own notes and calendar when they are relevant, and say when something isn't in their notes.
Keep answers short, clear and easy to say out loud. Help the student understand, plan and improve their own work; don't write graded assignments for them.

Relevant lines from their notes:
${notes}

Upcoming on their calendar:
${events}`;
}

async function toggleTalk() {
  if (!canListen) return toast("This browser can't listen. Try Chrome, Edge or Safari.");
  talk = !talk;
  $("#talkBtn").setAttribute("aria-pressed", String(talk));
  $("#talkBanner").hidden = !talk;
  if (talk) {
    await speak("Talk mode is on. What do you need?");
    loop();
  } else {
    window.speechSynthesis?.cancel();
  }
}

async function loop() {
  while (talk && document.contains($("#talkBtn"))) {
    $("#talkState").textContent = "Listening…";
    let heard = "";
    try {
      heard = await listenOnce();
    } catch (err) {
      toast(err.message);
      talk = false;
      break;
    }
    if (!talk) break;
    if (!heard) continue;
    if (/^(stop|stop talking|exit|goodbye|bye)$/i.test(heard.trim())) {
      talk = false;
      await speak("Okay, talk mode is off.");
      break;
    }
    $("#talkState").textContent = `You said: ${heard}`;
    await send(heard);
    if ($("#overlay").children.length) break; // a quiz took over the voice
  }
  if (document.contains($("#talkBtn"))) {
    $("#talkBtn").setAttribute("aria-pressed", String(talk));
    $("#talkBanner").hidden = !talk;
  }
}
