// Record a class: audio stays on the device, a live transcript where the browser supports it,
// "lost here" marks and typed notes stamped to the second. Dates it hears go to the calendar.
import { $, html, raw, toast, esc } from "./ui.js";
import { state, saveNote } from "./state.js";
import { words, mode } from "./profile.js";
import { addDates } from "./capture.js";
import { put, uid } from "./store.js";
import { go } from "./nav.js";
import { formatTime, detectSubject, detectTopic, toISO } from "../engine/index.js";
import { transcribe, canListen } from "./voice.js";

const SUBJECTS = ["Auto-detect", "Math", "English", "Biology", "Chemistry", "Physics", "History", "Computer Science", "Economics", "Psychology", "Other"];

// The recording keeps going if you switch views, so it lives at module level.
const rec = { active: false, startedAt: 0, cues: [], marks: [], mine: [], interim: "", chunks: [], recorder: null, stream: null, speech: null, wake: null, subject: "Auto-detect", title: "" };
let tick = null;

const elapsed = () => (rec.active ? (Date.now() - rec.startedAt) / 1000 : 0);

export function render(main) {
  main.innerHTML = html`
    <div class="view">
      <div class="view-head"><h1>${words().recordTitle}</h1></div>
      <section class="panel recorder">
        <div class="row" style="justify-content:center">
          ${raw(mode() === "work" ? "" : html`<label class="field" style="min-width:220px"><span class="label">Subject</span>
            <select id="recSubject">${raw(SUBJECTS.map((s) => html`<option ${s === rec.subject ? "selected" : ""}>${s}</option>`).join(""))}</select></label>`)}
          <label class="field" style="min-width:220px"><span class="label">Title (optional)</span>
            <input type="text" id="recTitle" placeholder="Seekto names it for you" value="${rec.title}"></label>
        </div>
        <div class="timer mono" id="recTimer">${formatTime(elapsed())}</div>
        ${raw(words().needConsent && !rec.active ? `<label class="row note-small" style="justify-content:center;gap:8px"><input type="checkbox" id="consent" style="width:auto"> Everyone in this meeting knows it's being recorded</label>` : "")}
        <button class="recbtn ${rec.active ? "on" : ""}" id="recBtn" aria-pressed="${rec.active}" ${raw(words().needConsent && !rec.active ? "disabled" : "")}>${rec.active ? "Stop" : "Record"}</button>
        <div class="row" id="recTools" ${raw(rec.active ? "" : "hidden")} style="justify-content:center">
          <button class="btn ghost" id="markBtn">Lost here</button>
          <form id="mineForm" class="row"><input type="text" id="mineInput" placeholder="Type a note, press Enter" style="min-width:240px"></form>
        </div>
        <p class="note-small" id="recHelp">${canListen ? "Audio stays on this device. The live transcript uses your browser's speech service (in Chrome and Edge it is processed online)." : "This browser can record but can't transcribe live. Audio stays on this device; add a transcript later from the note."} ${words().consent}</p>
      </section>
      <section class="panel" id="livePanel" ${raw(rec.active || rec.cues.length ? "" : "hidden")}>
        <span class="label">Live transcript</span>
        <div class="live" id="live"></div>
      </section>
    </div>`;

  $("#recBtn").addEventListener("click", () => (rec.active ? stop() : start()));
  $("#markBtn").addEventListener("click", () => { rec.marks.push({ start: elapsed(), label: "Lost here" }); drawLive(); toast("Marked"); });
  $("#mineForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#mineInput").value.trim();
    if (!v) return;
    rec.mine.push({ start: elapsed(), text: v });
    $("#mineInput").value = "";
    drawLive();
  });
  $("#recSubject")?.addEventListener("change", (e) => (rec.subject = e.target.value));
  $("#consent")?.addEventListener("change", (e) => ($("#recBtn").disabled = !e.target.checked));
  $("#recTitle").addEventListener("input", (e) => (rec.title = e.target.value));
  drawLive();
  clearInterval(tick);
  tick = setInterval(() => { const t = $("#recTimer"); if (t) t.textContent = formatTime(elapsed()); }, 500);
  return () => clearInterval(tick);
}

function drawLive() {
  const box = $("#live");
  if (!box) return;
  const rows = [
    ...rec.cues.map((c) => ({ ...c, cls: "" })),
    ...rec.marks.map((m) => ({ start: m.start, text: `⚑ ${m.label}`, cls: "mark" })),
    ...rec.mine.map((m) => ({ start: m.start, text: `✎ ${m.text}`, cls: "mine" })),
  ].sort((a, b) => a.start - b.start);
  box.innerHTML = rows.map((r) => `<div class="line ${r.cls}"><span class="t">${formatTime(r.start)}</span><span>${esc(r.text)}</span></div>`).join("") +
    (rec.interim ? `<div class="line"><span class="t">${formatTime(elapsed())}</span><span class="interim">${esc(rec.interim)}</span></div>` : "");
  box.scrollTop = box.scrollHeight;
}

async function start() {
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    return toast("Microphone access was blocked. Allow it in your browser's site settings.");
  }
  Object.assign(rec, { active: true, startedAt: Date.now(), cues: [], marks: [], mine: [], interim: "", chunks: [] });
  const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
  rec.recorder = new MediaRecorder(rec.stream, type ? { mimeType: type } : undefined);
  rec.recorder.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
  rec.recorder.start(5000);
  let lineStart = 0;
  rec.speech = transcribe({
    onLine: ({ text, final }) => {
      if (!rec.interim) lineStart = Math.max(0, elapsed() - 2);
      if (final) {
        if (text) rec.cues.push({ start: lineStart, text: text.charAt(0).toUpperCase() + text.slice(1) });
        rec.interim = "";
      } else rec.interim = text;
      drawLive();
    },
    onError: (err) => toast(err.message),
  });
  try { rec.wake = await navigator.wakeLock?.request("screen"); } catch { /* optional */ }
  window.dispatchEvent(new Event("seekto:render"));
}

async function stop() {
  rec.active = false;
  rec.speech?.stop();
  try { rec.wake?.release(); } catch { /* optional */ }
  const duration = (Date.now() - rec.startedAt) / 1000;
  const done = new Promise((r) => (rec.recorder.onstop = r));
  rec.recorder.stop();
  rec.stream.getTracks().forEach((t) => t.stop());
  await done;
  if (rec.interim) rec.cues.push({ start: Math.max(0, duration - 3), text: rec.interim });

  const createdAt = Date.now();
  const text = rec.cues.map((c) => c.text).join(" ");
  const work = mode() === "work";
  const chosen = work ? "Meeting" : rec.subject === "Auto-detect" ? null : rec.subject;
  const subject = chosen || detectSubject(text) || "General";
  const topic = text ? detectTopic(text) : "Recording";
  const audioId = uid("audio");
  await put("audio", { id: audioId, blob: new Blob(rec.chunks, { type: rec.recorder.mimeType || "audio/webm" }) });
  const note = {
    id: uid("note"), kind: "recording", createdAt, date: toISO(new Date(createdAt)), duration,
    title: rec.title.trim() || `${subject === "General" ? "" : `${subject}: `}${topic}`,
    subject, topic, cues: rec.cues, marks: rec.marks, mine: rec.mine, text, audioId, ...(work ? { mode: "work" } : {}),
  };
  if (work && !rec.title.trim()) note.title = `Meeting: ${topic}`;
  const added = await addDates(note);
  await saveNote(note);
  Object.assign(rec, { title: "", cues: [], marks: [], mine: [], interim: "", chunks: [] });
  toast(added ? `Saved. Added ${added} date${added > 1 ? "s" : ""} to your calendar.` : "Saved to your notes.");
  go(`note/${note.id}`);
}

export const isRecording = () => rec.active;
export { state };
