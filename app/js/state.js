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

export async function saveNote(note) {
  await put("notes", note);
  state.notes = [note, ...state.notes.filter((n) => n.id !== note.id)].sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteNote(id) {
  const note = state.notes.find((n) => n.id === id);
  await remove("notes", id);
  if (note?.audioId) await remove("audio", note.audioId);
  state.notes = state.notes.filter((n) => n.id !== id);
}

export async function saveEvent(event) {
  await put("events", event);
  state.events = [...state.events.filter((e) => e.id !== event.id), event].sort((a, b) => a.date.localeCompare(b.date));
}

export async function deleteEvent(id) {
  await remove("events", id);
  state.events = state.events.filter((e) => e.id !== id);
}

export async function saveProject(project) {
  await put("projects", project);
  state.projects = [project, ...state.projects.filter((p) => p.id !== project.id)].sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProject(id) {
  await remove("projects", id);
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
