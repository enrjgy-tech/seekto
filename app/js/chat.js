// The home screen: a guided assistant that answers from your notes and calendar,
// starts quizzes, and talks out loud in talk mode.
import { $, html, raw, toast } from "./ui.js";
import { state, today, noteText, updateSettings } from "./state.js";
import { go } from "./nav.js";
import { classify, answerLocally, searchNotes, describeDay, isReady, chat as askModel, findDefinitions, findEvents, findActionItems, findDecisions, formatTime } from "../engine/index.js";
import { openQuiz } from "./quiz.js";
import { words, mode, setMode } from "./profile.js";
import { loadSample, hasSamples, sampleScript } from "./sample.js";
import { isMeeting, meetingParts } from "./capture.js";
import { openFollowUp } from "./meeting.js";
import { friendlyDate } from "./ui.js";
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


function stepsHtml() {
  const s = state.settings;
  const done = {
    sample: hasSamples(),
    record: state.notes.some((n) => n.kind === "recording" && !n.sample),
    calendar: state.events.some((e) => e.source === "import"),
    settings: isReady(s),
  };
  const steps = words().steps.map(([go, title, text]) => [go, title, text, done[go]]);
  return steps.map(([go, title, text, done]) => html`<button class="step" data-step="${go}"><b>${title}</b><span>${text}</span>${raw(done ? '<span class="done">Done</span>' : "")}</button>`).join("");
}

export function render(main) {
  main.innerHTML = html`
    <div style="overflow-y:auto;min-height:0" id="chatScroll">
      <div class="view">
        <section class="welcome" id="welcome">
          <div class="view-head"><h1>${greeting()}</h1><span class="row phone-only"><button class="btn ghost small" id="phoneDevices">Devices</button><button class="btn ghost small" id="phoneSettings">Settings</button></span></div>
          <div class="row" style="align-items:center;gap:10px;margin:-4px 0 6px"><span class="note-small">I'm using Seekto for</span>
            <div class="seg" role="group" aria-label="Use Seekto for">${raw(["learning", "work"].map((m) => html`<button type="button" data-pickmode="${m}" aria-pressed="${m === mode()}">${m === "learning" ? "Learning" : "Work"}</button>`).join(""))}</div></div>
          <p class="sub">I'm Seekto. ${words().intro}</p>
          <div class="steps">${raw(stepsHtml())}</div>
        </section>
        <div class="chat-bar" id="chatBar" hidden>
          <div class="seg" role="group" aria-label="Use Seekto for">${raw(["learning", "work"].map((m) => html`<button type="button" data-pickmode="${m}" aria-pressed="${m === mode()}">${m === "learning" ? "Learning" : "Work"}</button>`).join(""))}</div>
          <button class="btn ghost small" id="newChat">New chat</button>
        </div>
        <div class="msgs" id="msgs" aria-live="polite"></div>
      </div>
    </div>
    <div class="composer">
      <div class="talk-banner" id="talkBanner" hidden><span class="pulse"></span><span id="talkState">Talk mode is on. Ask out loud.</span></div>
      <div class="suggest" id="suggest" style="max-width:880px;margin:0 auto 10px"></div>
      <form id="chatForm">
        <label for="chatInput" class="label" style="position:absolute;left:-9999px">Message</label>
        <input id="chatInput" type="text" autocomplete="off" placeholder="${words().placeholder}">
        <button type="button" class="iconbtn" id="talkBtn" aria-pressed="false" title="Talk mode" aria-label="Talk mode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
        <button class="btn">Send</button>
      </form>
    </div>`;

  $("#suggest").innerHTML = words().suggestions.map((s) => html`<button type="button">${s}</button>`).join("");
  $("#suggest").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send(b.textContent); });
  $("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#chatInput").value.trim(); if (v) { $("#chatInput").value = ""; send(v); } });
  $("#welcome").addEventListener("click", (e) => {
    const m = e.target.closest("[data-pickmode]");
    if (m) return setMode(m.dataset.pickmode);
    const b = e.target.closest("[data-step]");
    if (!b) return;
    if (b.dataset.step === "ask") $("#chatInput").focus();
    else if (b.dataset.step === "sample") runSample(mode());
    else go(b.dataset.step);
  });
  $("#talkBtn").addEventListener("click", toggleTalk);
  $("#chatBar").addEventListener("click", (e) => { const m = e.target.closest("[data-pickmode]"); if (m) setMode(m.dataset.pickmode); });
  $("#newChat").addEventListener("click", () => { history = []; saveHistory(); window.dispatchEvent(new Event("seekto:render")); });
  $("#phoneSettings").addEventListener("click", () => go("settings"));
  $("#phoneDevices").addEventListener("click", () => window.dispatchEvent(new Event("seekto:connect")));
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
  $("#chatBar").hidden = history.length === 0;
  box.innerHTML = history.map(messageHtml).join("");
  box.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("click", () => runAction(JSON.parse(b.dataset.action))));
  const scroll = $("#chatScroll");
  scroll.scrollTop = scroll.scrollHeight;
}

function messageHtml(m) {
  if (m.live) return liveHtml(m);
  if (m.role === "user") return html`<div class="msg user"><div class="bubble">${m.text}</div></div>`;
  const actions = (m.actions || []).map((a) => html`<button class="btn ghost small" data-action='${JSON.stringify(a)}'>${a.label}</button>`).join("");
  const items = (m.items || []).map((e) => html`<div class="event"><span class="when">${describeDay(e.date, today())}</span><span>${e.title}</span><span class="kind ${e.type}">${e.type || ""}</span></div>`).join("");
  return html`<div class="msg bot"><span class="who">Seekto</span><div class="bubble">${m.text}</div>${raw(items ? `<div class="items">${items}</div>` : "")}${raw(actions ? `<div class="row">${actions}</div>` : "")}</div>`;
}

function runAction(a) {
  if (a.go) return go(a.go);
  if (a.quiz !== undefined) return startQuiz(a.quiz);
  if (a.sample) return runSample(a.sample);
  if (a.followup) { const n = state.notes.find((x) => x.id === a.followup); if (n) openFollowUp(n); }
  if (a.ask) return send(a.ask);
}

// Plays the sample like a live recording: lines appear as they're "spoken", and dates and action
// items light up the moment Seekto hears them. Then the sample is saved like a real recording.
async function playSample(kind) {
  const box = $("#msgs");
  if (!box) return;
  $("#welcome").hidden = true;
  const script = sampleScript(kind);
  const card = document.createElement("div");
  card.className = "msg bot";
  card.innerHTML = html`<span class="who">Seekto · listening to a sample ${kind === "work" ? "meeting" : "class"}</span><div class="live-card"><div class="live-head"><span class="pulse"></span><b>${script.title}</b><span class="mono note-small" id="liveClock">0:00</span></div><div class="live-lines" id="liveLines"></div></div>`;
  box.appendChild(card);
  const lines = card.querySelector("#liveLines");
  const scroll = $("#chatScroll");
  const ref = new Date();
  const saved = { title: script.title, kind, lines: [] };
  for (let i = 0; i < script.lines.length; i++) {
    const text = script.lines[i];
    const row = document.createElement("div");
    row.className = "live-line";
    row.innerHTML = html`<span class="t mono">${formatTime(i * 9 + 2)}</span><span>${text}</span>`;
    lines.appendChild(row);
    card.querySelector("#liveClock").textContent = formatTime(i * 9 + 6);
    const found = [];
    for (const e of findEvents(text, { ref, subject: kind === "work" ? null : script.subject })) found.push(["date", `Added to calendar · ${friendlyDate(e.date)} · ${e.title}`]);
    if (kind === "work" && findDecisions(text).length) found.push(["def", "Decision"]);
    if (kind === "work") for (const a of findActionItems(text, { ref })) found.push(["task", `Action item · ${a.owner || "Unassigned"}${a.due ? ` · ${friendlyDate(a.due)}` : ""}`]);
    else if (findDefinitions(text).length) found.push(["def", `Definition · ${findDefinitions(text)[0].term}`]);
    saved.lines.push({ t: i * 9 + 2, text, chips: found });
    const chips = found.map(([cls, label]) => html`<span class="chip ${cls}">${label}</span>`);
    if (chips.length) { const c = document.createElement("div"); c.className = "chips"; c.innerHTML = chips.join(""); row.appendChild(c); }
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    await new Promise((r) => setTimeout(r, chips.length ? 900 : 420));
  }
  history.push({ role: "bot", live: saved, text: "" });
  saveHistory();
}

function liveHtml(m) {
  const rows = m.live.lines.map((l) => html`<div class="live-line"><span class="t mono">${formatTime(l.t)}</span><span>${l.text}</span>${raw(l.chips.length ? `<div class="chips">${l.chips.map(([cls, label]) => html`<span class="chip ${cls}">${label}</span>`).join("")}</div>` : "")}</div>`).join("");
  return html`<div class="msg bot"><span class="who">Seekto · sample ${m.live.kind === "work" ? "meeting" : "class"} (scripted)</span><div class="live-card"><div class="live-head"><b>${m.live.title}</b></div><div class="live-lines">${raw(rows)}</div></div></div>`;
}

async function runSample(kind) {
  await playSample(kind);
  const { note, decisions, actions } = await loadSample(kind);
  const events = state.events.filter((e) => e.noteId === note.id);
  if (kind === "work") {
    const lines = [
      `I loaded a sample meeting, "${note.title}". From what was said, I found ${decisions.length} decision${decisions.length === 1 ? "" : "s"} and ${actions.length} action items.`,
      "",
      "Decisions:",
      ...decisions.map((d) => `• ${d.text}`),
      "",
      "Action items:",
      ...actions.map((a) => `• ${a.owner || "Unassigned"}: ${a.task}${a.due ? ` (${friendlyDate(a.due)})` : ""}`),
      "",
      events.length ? `The ${events.length} with dates are on your calendar:` : "",
    ];
    return reply({ text: lines.join("\n").trim(), items: events, actions: [{ label: "Draft the follow-up email", followup: note.id }, { label: "Open the meeting", go: `note/${note.id}` }, { label: "What are my action items?", ask: "What are my action items?" }] });
  }
  return reply({
    text: `I loaded a sample biology class, "${note.title}". While the teacher talked, I wrote the transcript, found ${findDefinitions(note.text).length} definitions to quiz you on, and put ${events.length === 1 ? "this date" : `these ${events.length} dates`} on your calendar:`,
    items: events,
    actions: [{ label: "Quiz me on it", quiz: "Biology" }, { label: "When is my next test?", ask: "When is my next test?" }, { label: "Open the class notes", go: `note/${note.id}` }],
  });
}

function actionItemsReply() {
  const meetings = state.notes.filter(isMeeting);
  const all = meetings.flatMap((n) => meetingParts(n).actions.map((a) => ({ ...a, note: n })));
  if (!all.length) {
    return reply({ text: meetings.length ? "I didn't find action items in your meetings." : "You don't have any meeting notes yet. Record a meeting, or try the sample.", actions: [{ label: "Try a sample meeting", sample: "work" }, { label: "Record a meeting", go: "record" }] });
  }
  const sorted = all.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const mine = sorted.filter((a) => a.owner === "Me");
  const lines = sorted.slice(0, 12).map((a) => `• ${a.owner || "Unassigned"}: ${a.task}${a.due ? ` (${friendlyDate(a.due)})` : ""}`);
  return reply({ text: `${mine.length ? `${mine.length} of these are yours. ` : ""}Action items from your meetings:\n${lines.join("\n")}`, actions: [{ label: "Draft a follow-up email", followup: sorted[0].note.id }] });
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
  if (parsed.intent === "actions") return actionItemsReply();
  if (parsed.intent === "follow-up") {
    const latest = state.notes.find(isMeeting);
    if (!latest) return reply({ text: "I need a meeting first. Record one, or try the sample.", actions: [{ label: "Try a sample meeting", sample: "work" }] });
    openFollowUp(latest);
    return reply({ text: `Here's a follow-up email for "${latest.title}". Check it before you send it.`, actions: [{ label: "Open it again", followup: latest.id }] });
  }
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
    .filter((m) => m.text && !m.live && m.text !== "Thinking…")
    .slice(-10)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
}

function systemPrompt(question) {
  const hits = searchNotes(state.notes.map((n) => ({ ...n, text: noteText(n) })), question, 6);
  const notes = hits.map((h) => `- [${h.note.title}, ${h.note.date}] ${h.line}`).join("\n") || "(no matching notes)";
  const events = state.events.filter((e) => e.date >= today()).slice(0, 12).map((e) => `- ${e.date}: ${e.title}`).join("\n") || "(nothing upcoming)";
  const who = mode() === "work"
    ? "a friendly assistant for someone at work. You help with meetings, decisions, action items and deadlines"
    : "a friendly study assistant for a student. Help the student understand, plan and improve their own work; don't write graded assignments for them";
  return `You are Seekto, ${who}. Today is ${today()}.
Use their own notes and calendar when they are relevant, and say when something isn't in their notes.
Keep answers short, clear and easy to say out loud.

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
