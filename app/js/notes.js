// Notes, organized by date and subject, and a note page with the recording, transcript,
// marks, your typed notes, questions, a quiz and the dates found in it.
import { $, $$, html, raw, toast, esc, download, readFile, friendlyDate } from "./ui.js";
import { state, saveNote, deleteNote, saveEvent, hasEvent, noteText, today } from "./state.js";
import { get, uid, put } from "./store.js";
import { go } from "./nav.js";
import {
  formatTime, buildIndex, search, parseCaptions, parseTranscriptText, detectSubject, detectTopic,
  findEvents, searchNotes, toISO, fromISO, isReady, chat, stem, tokens,
} from "../engine/index.js";
import { openQuiz } from "./quiz.js";
import { isMeeting, addDates, transcribeNote, transcribing } from "./capture.js";
import { supported as canTranscribeHere } from "./ondevice.js";
import { meetingPanelHtml, openFollowUp } from "./meeting.js";

let filter = "All";
let query = "";

function groupLabel(iso) {
  const days = Math.round((fromISO(today()) - fromISO(iso)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return fromISO(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function preview(note) {
  return noteText(note).slice(0, 160) || (note.duration ? "Recording without a transcript" : "Empty note");
}

export function renderList(main) {
  const subjects = ["All", ...new Set(state.notes.map((n) => n.subject || "General"))];
  main.innerHTML = html`
    <div class="view">
      <div class="view-head">
        <h1>Notes</h1>
        <div class="row">
          <button class="btn ghost" id="newNote">New note</button>
          <label class="btn ghost" style="cursor:pointer">Import<input type="file" id="importFile" accept=".vtt,.srt,.txt,audio/*,video/*" hidden></label>
          <button class="btn" id="goRecord">Record</button>
        </div>
      </div>
      <input type="search" id="noteSearch" placeholder="Search all notes" value="${query}" aria-label="Search all notes">
      <div class="row" id="subjects">${raw(subjects.map((s) => html`<button class="chip" aria-pressed="${s === filter}">${s}</button>`).join(""))}</div>
      <div id="noteList"></div>
    </div>`;
  $("#goRecord").addEventListener("click", () => go("record"));
  $("#newNote").addEventListener("click", async () => {
    const work = state.settings.mode === "work";
    const note = { id: uid("note"), kind: "typed", createdAt: Date.now(), date: today(), title: work ? "Meeting notes" : "Untitled note", subject: work ? "Meeting" : "General", topic: "", text: "", cues: [], marks: [], mine: [], ...(work ? { mode: "work" } : {}) };
    await saveNote(note);
    go(`note/${note.id}`);
  });
  $("#importFile").addEventListener("change", (e) => importFile(e.target.files[0]));
  $("#subjects").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.textContent; renderList(main); });
  $("#noteSearch").addEventListener("input", (e) => { query = e.target.value; drawList(); });
  drawList();
}

function drawList() {
  const box = $("#noteList");
  if (!box) return;
  let notes = state.notes.filter((n) => filter === "All" || (n.subject || "General") === filter);
  if (query.trim()) {
    const hits = searchNotes(notes.map((n) => ({ ...n, text: noteText(n) })), query, 30);
    const ids = [...new Set(hits.map((h) => h.note.id))];
    const titleHits = notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase())).map((n) => n.id);
    notes = [...new Set([...titleHits, ...ids])].map((id) => notes.find((n) => n.id === id));
  }
  if (!notes.length) {
    box.innerHTML = `<p class="empty">${state.notes.length ? "No notes match." : "No notes yet. Record a class, type a note, or import a recording or transcript."}</p>`;
    return;
  }
  const groups = new Map();
  for (const n of notes) {
    const g = query ? "Results" : groupLabel(n.date);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(n);
  }
  box.innerHTML = [...groups].map(([label, list]) => html`
    <h3 class="group-title">${label}</h3>
    <div class="cards">${raw(list.map((n) => html`
      <button class="card" data-id="${n.id}">
        <b>${n.title}</b>
        <span class="meta"><span>${friendlyDate(n.date)}</span><span>${n.subject || "General"}</span>${raw(n.duration ? `<span>${formatTime(n.duration)}</span>` : "")}${raw(n.marks?.length ? `<span>${n.marks.length} lost</span>` : "")}${raw(n.eventCount ? `<span>${n.eventCount} date${n.eventCount > 1 ? "s" : ""}</span>` : "")}</span>
        <p>${preview(n)}</p>
      </button>`).join(""))}</div>`).join("");
  $$(".card", box).forEach((c) => c.addEventListener("click", () => go(`note/${c.dataset.id}`)));
}

async function importFile(file) {
  if (!file) return;
  const createdAt = Date.now();
  const note = { id: uid("note"), kind: "import", createdAt, date: today(), title: file.name.replace(/\.[^.]+$/, ""), subject: "General", topic: "", text: "", cues: [], marks: [], mine: [] };
  if (/^(audio|video)\//.test(file.type)) {
    const audioId = uid("audio");
    await put("audio", { id: audioId, blob: file });
    note.audioId = audioId;
  } else {
    const content = await readFile(file);
    note.cues = /-->/.test(content) ? parseCaptions(content) : parseTranscriptText(content);
    if (!note.cues.length) note.text = content;
  }
  finishNote(note);
  await saveNote(note);
  toast("Imported");
  go(`note/${note.id}`);
  if (note.audioId && !note.cues.length && state.settings.transcriber === "device") transcribeNote(note.id);
}

function finishNote(note) {
  const text = noteText(note);
  if (!text) return;
  note.text = text;
  note.subject = note.subject && note.subject !== "General" ? note.subject : detectSubject(text) || "General";
  note.topic = detectTopic(text);
}

export async function renderDetail(main, id) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) { main.innerHTML = `<div class="view"><p class="empty">That note doesn't exist anymore.</p></div>`; return; }
  const typed = note.kind === "typed";
  main.innerHTML = html`
    <div class="view">
      <div class="view-head">
        <button class="btn ghost small" id="back">← Notes</button>
        <div class="row">
          <button class="btn ghost small" id="quiz">Quiz me</button>
          <button class="btn ghost small" id="summary">Summarize</button>
          <button class="btn ghost small" id="export">Export</button>
          <button class="btn danger small" id="del">Delete</button>
        </div>
      </div>
      <input type="text" id="title" value="${note.title}" aria-label="Title" style="font-size:22px;font-weight:700;border:0;padding:0;background:none">
      <div class="row note-small"><span>${friendlyDate(note.date)}</span>
        <select id="subject" style="width:auto;padding:3px 8px">${raw(["General", "Meeting", "Math", "English", "Biology", "Chemistry", "Physics", "History", "Computer Science", "Economics", "Psychology", "Other"].map((s) => html`<option ${s === note.subject ? "selected" : ""}>${s}</option>`).join(""))}</select>
        ${raw(note.topic ? html`<span>Topic: ${note.topic}</span>` : "")}</div>
      <div class="detail">
        <section class="panel">
          ${raw(note.audioId ? `<audio id="audio" controls preload="metadata"></audio>` : "")}
          ${raw(typed ? `<textarea id="body" rows="16" placeholder="Write your notes. Dates like &quot;quiz on Friday&quot; are added to your calendar.">${esc(note.text)}</textarea>` : `<span class="label">Transcript and notes</span><div class="transcript" id="lines"></div>`)}
          ${raw(!typed && !note.cues?.length && note.audioId && canTranscribeHere ? `<div class="field"><span class="label">Transcript</span><p class="note-small" id="asrStatus">${transcribing(note.id) || "Make the transcript on this device: private, works offline after a one-time download, about 100 languages."}</p><div class="row"><button class="btn small" id="asrGo" ${transcribing(note.id) ? "disabled" : ""}>Transcribe on this device</button></div></div>` : "")}
          ${raw(!typed && !note.cues?.length ? `<div class="field"><span class="label">${note.audioId ? "Or add a transcript" : "No transcript yet"}</span><p class="note-small">Add a caption file (.vtt or .srt) or paste a transcript with times.</p><textarea id="pasteT" rows="4" placeholder="0:00&#10;Today we start chapter 5…"></textarea><div class="row"><button class="btn small" id="useT">Use transcript</button><label class="btn ghost small" style="cursor:pointer">Caption file<input type="file" id="capFile" accept=".vtt,.srt,.txt" hidden></label></div></div>` : "")}
        </section>
        <section class="panel">
          ${raw(isMeeting(note) ? `<div id="meetingBox" style="display:grid;gap:8px">${meetingPanelHtml(note)}</div>` : "")}
          <form id="askForm" class="row"><input type="text" id="ask" placeholder="Ask this note" style="flex:1"><button class="btn">Ask</button></form>
          <div id="answers" class="items" style="display:grid;gap:8px"></div>
          <span class="label">Dates in this note</span>
          <div id="noteEvents" class="agenda"></div>
          <button class="btn ghost small" id="findDates">Find dates again</button>
          <div id="summaryBox" class="note-small" style="white-space:pre-wrap"></div>
        </section>
      </div>
    </div>`;

  $("#back").addEventListener("click", () => go("notes"));
  $("#title").addEventListener("change", async (e) => { note.title = e.target.value.trim() || "Untitled note"; await saveNote(note); });
  $("#subject").addEventListener("change", async (e) => { note.subject = e.target.value; await saveNote(note); });
  $("#del").addEventListener("click", async () => {
    if ($("#del").dataset.sure !== "1") { $("#del").dataset.sure = "1"; $("#del").textContent = "Tap again to delete"; return; }
    await deleteNote(note.id);
    toast("Note deleted");
    go("notes");
  });
  $("#quiz").addEventListener("click", () => openQuiz({ notes: [note], title: `Quiz: ${note.title}` }));
  $("#export").addEventListener("click", () => download(`${note.title.replace(/[^\w-]+/g, "-")}.md`, toMarkdown(note), "text/markdown"));
  $("#summary").addEventListener("click", () => summarize(note));
  main.querySelector("[data-followup]")?.addEventListener("click", () => openFollowUp(note));
  $("#findDates").addEventListener("click", async () => {
    const added = await addDates(note);
    await saveNote(note);
    toast(added ? `Added ${added} date${added > 1 ? "s" : ""}` : "No new dates found");
    drawEvents(note);
  });

  if (typed) {
    let timer;
    $("#body").addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        note.text = e.target.value;
        finishNote(note);
        const added = await addDates(note);
        if (added) { toast(`Added ${added} date${added > 1 ? "s" : ""} to your calendar`); drawEvents(note); }
        await saveNote(note);
        const box = $("#meetingBox");
        if (box) { box.innerHTML = meetingPanelHtml(note); box.querySelector("[data-followup]")?.addEventListener("click", () => openFollowUp(note)); }
      }, 1200);
    });
  }
  $("#asrGo")?.addEventListener("click", (e) => { e.target.disabled = true; transcribeNote(note.id); });
  const view = main.firstElementChild;
  const onAsr = (e) => {
    if (!view.isConnected) { window.removeEventListener("seekto:asr", onAsr); return; }
    if (e.detail.id !== note.id) return;
    if (e.detail.done) { toast(`Transcribed${e.detail.added ? `. Added ${e.detail.added} date${e.detail.added > 1 ? "s" : ""} to your calendar` : ""}.`); renderDetail(main, id); return; }
    const st = $("#asrStatus");
    if (st) st.textContent = e.detail.error || e.detail.text;
    if (e.detail.error && $("#asrGo")) $("#asrGo").disabled = false;
  };
  window.addEventListener("seekto:asr", onAsr);
  $("#useT")?.addEventListener("click", async () => { await addTranscript(note, $("#pasteT").value); renderDetail(main, id); });
  $("#capFile")?.addEventListener("change", async (e) => { await addTranscript(note, await readFile(e.target.files[0])); renderDetail(main, id); });

  if (note.audioId) {
    const rec = await get("audio", note.audioId);
    if (rec?.blob && $("#audio")) $("#audio").src = URL.createObjectURL(rec.blob);
  }
  drawLines(note);
  drawEvents(note);

  const index = buildIndex(note.cues?.length ? note.cues : (note.text || "").split(/(?<=[.!?])\s+/).map((t, i) => ({ start: i, text: t })));
  $("#askForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#ask").value.trim();
    if (!q) return;
    const res = search(index, q);
    const terms = new Set(tokens(q));
    $("#answers").innerHTML = res.length
      ? res.map((r) => html`<div class="ans">${raw(note.cues?.length ? `<button class="btn small" data-seek="${r.start}" style="justify-self:start">▶ ${formatTime(r.start)}</button>` : "")}<span>${raw(esc(r.context).replace(/[A-Za-z0-9]+/g, (w) => (terms.has(stem(w.toLowerCase())) ? `<mark>${w}</mark>` : w)))}</span></div>`).join("")
      : `<p class="empty">Nothing in this note matches. Try other words${isReady(state.settings) ? ", or ask the assistant" : ""}.</p>`;
    $$("[data-seek]", $("#answers")).forEach((b) => b.addEventListener("click", () => seek(Number(b.dataset.seek))));
    if (res[0] && note.cues?.length) seek(res[0].start);
  });
}

function seek(t) {
  const audio = $("#audio");
  if (audio) { audio.currentTime = t; audio.play().catch(() => {}); }
  const line = $(`.line[data-t="${t}"]`);
  $$(".line.on").forEach((l) => l.classList.remove("on"));
  if (line) { line.classList.add("on"); line.scrollIntoView({ block: "center", behavior: "smooth" }); }
}

function drawLines(note) {
  const box = $("#lines");
  if (!box) return;
  const rows = [
    ...(note.cues || []).map((c) => ({ ...c, cls: "" })),
    ...(note.marks || []).map((m) => ({ start: m.start, text: `⚑ ${m.label}`, cls: "mark" })),
    ...(note.mine || []).map((m) => ({ start: m.start, text: `✎ ${m.text}`, cls: "mine" })),
  ].sort((a, b) => a.start - b.start);
  box.innerHTML = rows.length
    ? rows.map((r) => `<button class="line ${r.cls}" data-t="${r.start}"><span class="t">${formatTime(r.start)}</span><span>${esc(r.text)}</span></button>`).join("")
    : `<p class="empty">No transcript lines.</p>`;
  $$(".line", box).forEach((l) => l.addEventListener("click", () => seek(Number(l.dataset.t))));
  const audio = $("#audio");
  if (audio) audio.addEventListener("timeupdate", () => {
    const t = audio.currentTime;
    let cur = null;
    for (const l of $$(".line", box)) if (Number(l.dataset.t) <= t) cur = l;
    $$(".line.on", box).forEach((l) => l !== cur && l.classList.remove("on"));
    cur?.classList.add("on");
  });
}

function drawEvents(note) {
  const list = state.events.filter((e) => e.noteId === note.id);
  $("#noteEvents").innerHTML = list.length
    ? list.map((e) => html`<div class="event"><span class="when">${friendlyDate(e.date)}</span><span>${e.title}</span><span class="kind ${e.type}">${e.type}</span></div>`).join("")
    : `<p class="empty">No dates found in this note.</p>`;
}

async function addTranscript(note, content) {
  if (!content?.trim()) return toast("Paste a transcript first");
  note.cues = /-->/.test(content) ? parseCaptions(content) : parseTranscriptText(content);
  if (!note.cues.length) return toast("That transcript has no times. Use a .vtt/.srt file or lines like 1:05.");
  note.text = "";
  finishNote(note);
  await saveNote(note);
  toast("Transcript added");
}

async function summarize(note) {
  const box = $("#summaryBox");
  if (!isReady(state.settings)) {
    box.innerHTML = `Summaries use an AI model. <a href="#settings">Choose one in Settings</a> (on your computer, free cloud or paid).`;
    return;
  }
  box.textContent = "Summarizing…";
  try {
    box.textContent = await chat(state.settings, {
      system: "You summarize a student's class notes into short study notes: 3 to 6 key points, key terms with definitions, and anything due or on a test. Plain text with bullets.",
      messages: [{ role: "user", content: noteText(note).slice(0, 20000) || note.title }],
      maxTokens: 700,
    });
  } catch (err) {
    box.textContent = err.message;
  }
}

function toMarkdown(note) {
  const lines = [
    `# ${note.title}`, "", `${note.date} · ${note.subject}${note.topic ? ` · ${note.topic}` : ""}`, "",
    ...(note.mine?.length ? ["## My notes", ...note.mine.map((m) => `- [${formatTime(m.start)}] ${m.text}`), ""] : []),
    ...(note.marks?.length ? ["## Lost here", ...note.marks.map((m) => `- ${formatTime(m.start)}`), ""] : []),
    "## Transcript", ...(note.cues?.length ? note.cues.map((c) => `[${formatTime(c.start)}] ${c.text}`) : [note.text || ""]),
  ];
  return lines.join("\n");
}

export { toISO };
