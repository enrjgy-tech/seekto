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
