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

// Every change is announced so paired devices can sync it. Changes that arrive from
// another device are saved with { remote: true } so they aren't sent straight back.
function announce(detail) {
  window.dispatchEvent(new CustomEvent("seekto:changed", { detail }));
}

async function tombstone(store, id, remote) {
  const t = { id, store, at: Date.now() };
  await put("deleted", t);
  if (!remote) announce({ deleted: t });
}

export async function saveNote(note, { remote = false } = {}) {
  if (!remote) note.updatedAt = Date.now();
  await put("notes", note);
  if (!remote) announce({ store: "notes", record: note });
  state.notes = [note, ...state.notes.filter((n) => n.id !== note.id)].sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteNote(id, { remote = false } = {}) {
  const note = state.notes.find((n) => n.id === id);
  await remove("notes", id);
  if (note?.audioId) await remove("audio", note.audioId);
  await tombstone("notes", id, remote);
  state.notes = state.notes.filter((n) => n.id !== id);
}

export async function saveEvent(event, { remote = false } = {}) {
  if (!remote) event.updatedAt = Date.now();
  await put("events", event);
  if (!remote) announce({ store: "events", record: event });
  state.events = [...state.events.filter((e) => e.id !== event.id), event].sort((a, b) => a.date.localeCompare(b.date));
}

export async function deleteEvent(id, { remote = false } = {}) {
  await remove("events", id);
  await tombstone("events", id, remote);
  state.events = state.events.filter((e) => e.id !== id);
}

export async function saveProject(project, { remote = false } = {}) {
  if (!remote) project.updatedAt = Date.now();
  await put("projects", project);
  if (!remote) announce({ store: "projects", record: project });
  state.projects = [project, ...state.projects.filter((p) => p.id !== project.id)].sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProject(id, { remote = false } = {}) {
  await remove("projects", id);
  await tombstone("projects", id, remote);
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
