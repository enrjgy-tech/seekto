// In-memory copy of the person's data, loaded from the device on start.
import { all, put, remove, loadSettings, saveSettings } from "./store.js";
import { toISO } from "../engine/index.js";

export const state = {
  notes: [],
  events: [],
  projects: [],
  settings: loadSettings(),
};

export async function loadAll() {
  const [notes, events, projects] = await Promise.all([all("notes"), all("events"), all("projects")]);
  state.notes = notes.sort((a, b) => b.createdAt - a.createdAt);
  state.events = events.sort((a, b) => a.date.localeCompare(b.date));
  state.projects = projects.sort((a, b) => b.createdAt - a.createdAt);
}

// Every change is announced so paired devices and your storage can sync it. Changes that arrive
// from elsewhere are saved with { remote: true, from: "peer" | "cloud" }: they keep their own
// timestamps, and the announcement says where they came from so they aren't sent straight back.
function announce(detail) {
  window.dispatchEvent(new CustomEvent("seekto:changed", { detail }));
}

const origin = (remote, from) => (remote ? from || "peer" : undefined);

async function tombstone(store, id, remote, from) {
  const t = { id, store, at: Date.now() };
  await put("deleted", t);
  announce({ deleted: t, from: origin(remote, from) });
}

async function saveRecord(store, record, remote, from) {
  if (!remote) record.updatedAt = Date.now();
  await put(store, record);
  announce({ store, record, from: origin(remote, from) });
}

export async function saveNote(note, { remote = false, from } = {}) {
  await saveRecord("notes", note, remote, from);
  state.notes = [note, ...state.notes.filter((n) => n.id !== note.id)].sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteNote(id, { remote = false, from } = {}) {
  const note = state.notes.find((n) => n.id === id);
  await remove("notes", id);
  if (note?.audioId) await remove("audio", note.audioId);
  await tombstone("notes", id, remote, from);
  state.notes = state.notes.filter((n) => n.id !== id);
}

export async function saveEvent(event, { remote = false, from } = {}) {
  await saveRecord("events", event, remote, from);
  state.events = [...state.events.filter((e) => e.id !== event.id), event].sort((a, b) => a.date.localeCompare(b.date));
}

export async function deleteEvent(id, { remote = false, from } = {}) {
  await remove("events", id);
  await tombstone("events", id, remote, from);
  state.events = state.events.filter((e) => e.id !== id);
}

export async function saveProject(project, { remote = false, from } = {}) {
  await saveRecord("projects", project, remote, from);
  state.projects = [project, ...state.projects.filter((p) => p.id !== project.id)].sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProject(id, { remote = false, from } = {}) {
  await remove("projects", id);
  await tombstone("projects", id, remote, from);
  state.projects = state.projects.filter((p) => p.id !== id);
}

export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  saveSettings(state.settings);
}

export const today = () => toISO(new Date());

/** Notes as plain text for the engine: { id, title, subject, topic, text, cues, date }. */
export function noteText(note) {
  return note.text || (note.cues || []).map((c) => c.text).join(" ");
}

/** Is this event already on the calendar (same day, same title)? */
export function hasEvent(e) {
  return state.events.some((x) => x.date === e.date && x.title.toLowerCase() === e.title.toLowerCase());
}
