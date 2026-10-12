// What happens after something is captured (a recording, an import, a sample): dates go on the
// calendar, and for meetings, action items with a due date go on it too.
import { state, saveEvent, hasEvent, noteText } from "./state.js";
import { uid } from "./store.js";
import { findEvents, findActionItems, findDecisions } from "../engine/index.js";

export function isMeeting(note) {
  return note.mode === "work";
}

/** Meeting results for a note: { decisions, actions }. */
export function meetingParts(note) {
  const text = noteText(note);
  const ref = new Date(note.createdAt || Date.now());
  return { decisions: findDecisions(text), actions: findActionItems(text, { ref }) };
}

/** Add the note's dates (and, for meetings, dated action items) to the calendar. Returns how many. */
export async function addDates(note, { sample = false } = {}) {
  const text = noteText(note);
  const ref = new Date(note.createdAt || Date.now());
  const subject = note.subject && !["General", "Meeting"].includes(note.subject) ? note.subject : null;
  const found = findEvents(text, { ref, subject }).map((e) => ({ ...e, source: "recording" }));
  if (isMeeting(note)) {
    for (const a of findActionItems(text, { ref })) {
      if (a.due) found.push({ date: a.due, type: "task", title: `${a.owner && !["Team", "Me"].includes(a.owner) ? `${a.owner}: ` : ""}${a.task}`, sentence: a.sentence, source: "meeting" });
    }
  }
  let added = 0;
  for (const e of found) {
    if (hasEvent(e)) continue;
    await saveEvent({ id: uid("event"), ...e, subject: note.subject, noteId: note.id, ...(sample ? { sample: true } : {}) });
    added++;
  }
  note.eventCount = state.events.filter((e) => e.noteId === note.id).length;
  return added;
}

// ---------- On-device transcription of a saved recording ----------
const running = new Map(); // noteId -> latest progress text

export const transcribing = (id) => running.get(id) || null;

/** Transcribe a note's recording on this device, then find its dates (and action items). */
export async function transcribeNote(id) {
  if (running.has(id)) return;
  const { transcribeOnDevice, progressText } = await import("./ondevice.js");
  const { get } = await import("./store.js");
  const { saveNote } = await import("./state.js");
  const { detectSubject, detectTopic } = await import("../engine/index.js");
  const tell = (text) => { running.set(id, text); window.dispatchEvent(new CustomEvent("seekto:asr", { detail: { id, text } })); };
  tell("Starting…");
  try {
    const note = state.notes.find((n) => n.id === id);
    const rec = note?.audioId && (await get("audio", note.audioId));
    if (!rec?.blob) throw new Error("The recording isn't on this device.");
    const cues = await transcribeOnDevice(rec.blob, {
      quality: state.settings.asrQuality || "fast",
      language: state.settings.asrLanguage || null,
      onProgress: (p) => tell(progressText(p)),
    });
    const fresh = state.notes.find((n) => n.id === id) || note;
    fresh.cues = cues;
    fresh.text = cues.map((c) => c.text).join(" ");
    if (!fresh.subject || fresh.subject === "General") fresh.subject = fresh.mode === "work" ? "Meeting" : detectSubject(fresh.text) || "General";
    fresh.topic = detectTopic(fresh.text) || fresh.topic;
    if (/^(Recording|Meeting: Recording|General: Recording)$/.test(fresh.title)) fresh.title = `${fresh.mode === "work" ? "Meeting" : fresh.subject}: ${fresh.topic}`;
    delete fresh.pendingTranscript;
    const added = await addDates(fresh);
    await saveNote(fresh);
    running.delete(id);
    window.dispatchEvent(new CustomEvent("seekto:asr", { detail: { id, done: true, added, lines: cues.length } }));
  } catch (err) {
    running.delete(id);
    window.dispatchEvent(new CustomEvent("seekto:asr", { detail: { id, error: err.message } }));
  }
}
