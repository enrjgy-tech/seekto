// Everything is stored on this device in IndexedDB. If IndexedDB isn't available
// (some private windows), data lives in memory for the session instead.

const DB = "seekto";
const STORES = ["notes", "events", "projects", "audio", "deleted"];
let dbPromise = null;
const memory = Object.fromEntries(STORES.map((s) => [s, new Map()]));

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 2);
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && "result" in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function all(store) {
  const db = await open();
  if (!db) return [...memory[store].values()];
  return tx(db, store, "readonly", (s) => s.getAll());
}

export async function get(store, id) {
  const db = await open();
  if (!db) return memory[store].get(id);
  return tx(db, store, "readonly", (s) => s.get(id));
}

export async function put(store, value) {
  const db = await open();
  if (!db) { memory[store].set(value.id, value); return; }
  await tx(db, store, "readwrite", (s) => s.put(value));
}

export async function remove(store, id) {
  const db = await open();
  if (!db) { memory[store].delete(id); return; }
  await tx(db, store, "readwrite", (s) => s.delete(id));
}

export async function clearAll() {
  const db = await open();
  for (const s of STORES) {
    if (!db) memory[s].clear();
    else await tx(db, s, "readwrite", (st) => st.clear());
  }
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Small settings live in localStorage; it can throw in some contexts, so every access is guarded.
const SETTINGS_KEY = "seekto.settings";
const DEFAULTS = { provider: "none", model: "", apiKey: "", baseUrl: "", speak: true, onboarded: false, signalServer: "https://ntfy.sh" };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* not available */ }
}

/** Ids of every stored recording, without loading the audio. */
export async function audioIds() {
  const db = await open();
  if (!db) return [...memory.audio.keys()];
  return tx(db, "audio", "readonly", (s) => s.getAllKeys());
}
