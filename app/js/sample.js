// Samples: one click shows what Seekto does with a class or a meeting, using a short scripted
// transcript instead of the microphone. Samples are marked so they can be removed in one go.
import { state, saveNote, deleteNote, deleteEvent } from "./state.js";
import { uid } from "./store.js";
import { toISO, detectTopic } from "../engine/index.js";
import { addDates, meetingParts } from "./capture.js";

const CLASS = {
  title: "Biology: Cell division",
  subject: "Biology",
  lines: [
    "Okay everyone, today we're starting chapter five, which is all about how cells divide.",
    "Mitosis means one cell dividing into two identical daughter cells.",
    "Before a cell divides, it copies its DNA, so each new cell gets a full set of chromosomes.",
    "A chromosome is a long strand of DNA wrapped around proteins.",
    "The centromere is the point where the two copies of a chromosome are held together.",
    "Meiosis is the kind of division that makes sperm and egg cells, with half the chromosomes.",
    "Remember, mitosis is for growth and repair, and meiosis is for reproduction.",
    "The chapter five quiz is on Friday, so review the four phases of mitosis.",
    "The onion root lab report is due next Wednesday.",
    "Cytokinesis is the final step, when the cytoplasm splits into two cells.",
  ],
};

const MEETING = {
  title: "Launch sync",
  subject: "Meeting",
  lines: [
    "Okay, let's get started. Thanks everyone for joining the launch sync.",
    "First, the beta. We decided to launch the beta on November 2nd.",
    "Maria will send the updated pitch deck to the client by Friday.",
    "Sam to book the room for the customer workshop.",
    "I'll write up the survey results tomorrow and share them in the channel.",
    "We agreed that support hours stay the same through the holidays.",
    "Can you send the budget spreadsheet to finance?",
    "Let's schedule a review with legal next Tuesday.",
    "Priya will update the onboarding guide before the beta goes out.",
    "Great, that's everything. Thanks all.",
  ],
};

export const sampleScript = (kind) => (kind === "work" ? MEETING : CLASS);

/** Load a sample class or meeting. Returns { note, added, decisions, actions }. */
export async function loadSample(kind = "learning") {
  const s = kind === "work" ? MEETING : CLASS;
  const createdAt = Date.now();
  const cues = s.lines.map((text, i) => ({ start: i * 9 + 2, text }));
  const note = {
    id: uid("note"), kind: "recording", sample: true, createdAt, date: toISO(new Date(createdAt)), duration: s.lines.length * 9 + 4,
    title: s.title, subject: s.subject, topic: kind === "work" ? "Beta launch" : detectTopic(s.lines.join(" ")),
    cues, marks: kind === "work" ? [] : [{ start: 38, label: "Lost here" }], mine: [], text: s.lines.join(" "),
    ...(kind === "work" ? { mode: "work" } : {}),
  };
  const added = await addDates(note, { sample: true });
  await saveNote(note);
  const { decisions, actions } = kind === "work" ? meetingParts(note) : { decisions: [], actions: [] };
  return { note, added, decisions, actions };
}

export const hasSamples = () => state.notes.some((n) => n.sample);

export async function removeSamples() {
  for (const e of state.events.filter((x) => x.sample)) await deleteEvent(e.id);
  for (const n of state.notes.filter((x) => x.sample)) await deleteNote(n.id);
}
