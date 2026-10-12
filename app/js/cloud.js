// Your account and the storage you bring (a Supabase project you own).
//
// Everything is encrypted on this device before it's sent (see engine/src/vault.js), so the
// storage only holds opaque ids, version numbers and ciphertext. Syncing is "newest change wins",
// the same rule devices use with each other, so the two kinds of sync never fight.
import { state, saveNote, saveEvent, saveProject, deleteNote, deleteEvent, deleteProject } from "./state.js";
import { all, put, get, audioIds } from "./store.js";
import {
  deriveAccount, itemId, sealItem, openItem, sealBytes, openBytes, makeAccountKey, isValidAccountKey, formatAccountKey, incoming, STORES,
} from "../engine/index.js";

const LS = { account: "seekto.account", seen: "seekto.cloud.seen", outbox: "seekto.cloud.outbox", audio: "seekto.cloud.audio" };
const PART = 768 * 1024; // recording piece size before encryption
const AUDIO_MANIFEST = 1; // versions 1 and 2 mark recordings; records use timestamps
const AUDIO_PART = 2;
const POLL_MS = 60 * 1000;

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function write(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* not available */ } }

/** { key, url, apiKey, enabled, cursor, lastSync, error } or null */
export function account() { return read(LS.account, null); }
function saveAccount(patch) { const a = { ...(account() || {}), ...patch }; write(LS.account, a); emit(); return a; }

const listeners = new Set();
export function onCloud(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(); }

// ---------- The storage: a Supabase project with supabase.sql applied ----------
export function supabase(url, apiKey) {
  const base = String(url || "").trim().replace(/\/+$/, "");
  const headers = { apikey: apiKey, "Content-Type": "application/json" };
  if (String(apiKey).startsWith("eyJ")) headers.Authorization = `Bearer ${apiKey}`; // older "anon" keys are JWTs
  async function call(path, init) {
    let res;
    try {
      res = await fetch(`${base}${path}`, { ...init, headers });
    } catch {
      throw new Error("Couldn't reach your Supabase project. Check the project URL and your internet connection.");
    }
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { res, data };
  }
  async function rpc(fn, args) {
    const { res, data } = await call(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
    if (res.ok) return data;
    const code = data?.code || "";
    const message = data?.message || "";
    if (code === "PGRST202" || res.status === 404) throw new Error("Seekto's setup script hasn't been run in this project yet. Run it in the SQL Editor, then try again.");
    if (res.status === 401 && !message.includes("seekto")) throw new Error("Supabase didn't accept that API key. Use the project's publishable (or anon) key.");
    if (message.includes("seekto: wrong account or token")) { const e = new Error("This account isn't on your storage any more. It may have been deleted, or its key changed on another device."); e.gone = true; throw e; }
    throw new Error(message || `Supabase returned an error (${res.status}).`);
  }
  return {
    label: base.replace(/^https?:\/\//, ""),
    info: () => rpc("seekto_info", {}),
    /** true if the tables refuse direct access, as the setup script makes them. */
    async locked() {
      const { res } = await call("/rest/v1/seekto_items?select=item_id&limit=1", { method: "GET" });
      return !res.ok;
    },
    register: (a) => rpc("seekto_register", { p_account: a.accountId, p_token: a.writeToken }),
    put: (a, items) => rpc("seekto_put", { p_account: a.accountId, p_token: a.writeToken, p_items: items }),
    changes: (a, since) => rpc("seekto_changes", { p_account: a.accountId, p_token: a.writeToken, p_since: since, p_limit: 500 }),
    get: (a, ids) => rpc("seekto_get", { p_account: a.accountId, p_token: a.writeToken, p_ids: ids }),
    forget: (a) => rpc("seekto_forget", { p_account: a.accountId, p_token: a.writeToken }),
  };
}

/** Check a project before using it. Returns a list of { ok, text } lines; throws on hard failures. */
export async function testStorage(url, apiKey) {
  // https for hosted projects; plain http only for a Supabase running on this computer
  if (!/^(https:\/\/.+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$)/.test(String(url).trim())) throw new Error("The project URL starts with https://, like https://abcd1234.supabase.co");
  const s = supabase(url, apiKey);
  const info = await s.info();
  if (info?.app !== "seekto") throw new Error("This project answered, but not like Seekto storage. Run the setup script again.");
  const lines = [{ ok: true, text: `Seekto storage found (version ${info.schema})` }];
  lines.push((await s.locked())
    ? { ok: true, text: "Tables are closed to direct access" }
    : { ok: false, text: "Tables are open to direct access. Run the setup script again to close them." });
  return lines;
}

// ---------- Sync ----------
let acct = null;
let backend = null;
let busy = null;
let timer = null;
let soon = null;

const seen = () => read(LS.seen, {});
const outbox = () => new Set(read(LS.outbox, []));
function addToOutbox(keys) { const o = outbox(); for (const k of keys) o.add(k); write(LS.outbox, [...o]); }
const stamp = (r) => Math.max(3, r.updatedAt || r.createdAt || 3);

async function everything() {
  const [tombs, audio] = await Promise.all([all("deleted"), audioIds()]);
  const keys = [];
  for (const s of STORES) for (const r of state[s]) keys.push(`${s}:${r.id}`);
  for (const t of tombs) keys.push(`deleted:${t.id}`);
  return { keys, audio };
}

// Changes made here or received from a device go to the storage; changes that came from the
// storage don't go back.
window.addEventListener("seekto:changed", (e) => {
  const { store, record, deleted, from } = e.detail;
  if (from === "cloud" || !account()?.enabled) return;
  addToOutbox([deleted ? `deleted:${deleted.id}` : `${store}:${record.id}`]);
  clearTimeout(soon);
  soon = setTimeout(() => syncNow(), 1500);
});

function batches(items, maxChars = 3_000_000) {
  const out = [];
  let cur = [];
  let size = 0;
  for (const it of items) {
    if (cur.length && (cur.length >= 200 || size + it.body.length > maxChars)) { out.push(cur); cur = []; size = 0; }
    cur.push(it);
    size += it.body.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function push() {
  const keys = [...outbox()];
  const tombs = new Map((await all("deleted")).map((t) => [t.id, t]));
  const items = [];
  const known = seen();
  for (const key of keys) {
    const [kind, ...rest] = key.split(":");
    const id = rest.join(":");
    if (kind === "deleted") {
      const t = tombs.get(id);
      if (!t?.store) continue;
      const iid = await itemId(acct, t.store, id);
      items.push({ item_id: iid, version: Math.max(3, t.at), body: await sealItem(acct, iid, Math.max(3, t.at), { store: t.store, deleted: t }) });
    } else if (STORES.includes(kind)) {
      const r = state[kind].find((x) => x.id === id);
      if (!r) continue; // deleted since; its tombstone is in the outbox
      const iid = await itemId(acct, kind, id);
      if (known[iid] >= stamp(r)) continue;
      items.push({ item_id: iid, version: stamp(r), body: await sealItem(acct, iid, stamp(r), { store: kind, record: r }) });
    }
  }
  for (const batch of batches(items)) {
    await backend.put(acct, batch);
    const k = seen();
    for (const it of batch) k[it.item_id] = Math.max(k[it.item_id] || 0, it.version);
    write(LS.seen, k);
  }
  const left = outbox();
  for (const key of keys) left.delete(key);
  write(LS.outbox, [...left]);
  await pushAudio();
}

// Recordings: one small manifest plus encrypted pieces, uploaded once.
async function pushAudio() {
  const done = new Set(read(LS.audio, []));
  const wanted = new Set(state.notes.map((n) => n.audioId).filter(Boolean));
  for (const id of await audioIds()) {
    if (done.has(id) || !wanted.has(id)) continue;
    const rec = await get("audio", id);
    if (!rec?.blob) continue;
    const bytes = new Uint8Array(await rec.blob.arrayBuffer());
    const parts = Math.max(1, Math.ceil(bytes.length / PART));
    const items = [];
    for (let i = 0; i < parts; i++) {
      const iid = await itemId(acct, "audio-part", `${id}:${i}`);
      items.push({ item_id: iid, version: AUDIO_PART, body: await sealBytes(acct, iid, AUDIO_PART, bytes.subarray(i * PART, (i + 1) * PART)) });
    }
    const mid = await itemId(acct, "audio", id);
    for (const batch of batches(items)) await backend.put(acct, batch);
    await backend.put(acct, [{ item_id: mid, version: AUDIO_MANIFEST, body: await sealItem(acct, mid, AUDIO_MANIFEST, { store: "audio", id, mime: rec.blob.type, parts, size: bytes.length }) }]);
    done.add(id);
    write(LS.audio, [...done]);
  }
}

async function pull() {
  let cursor = account()?.cursor || 0;
  const known = seen();
  const fresh = [];
  for (;;) {
    const page = await backend.changes(acct, cursor);
    for (const c of page) {
      cursor = Math.max(cursor, c.seq);
      if (c.version === AUDIO_PART) continue; // fetched when its recording is needed
      if ((known[c.item_id] || 0) >= c.version) continue; // already have it, or an old copy
      fresh.push(c);
    }
    if (page.length < 500) break;
  }
  const payload = { records: {}, deleted: [] };
  const recordings = [];
  for (let i = 0; i < fresh.length; i += 100) {
    const rows = await backend.get(acct, fresh.slice(i, i + 100).map((c) => c.item_id));
    for (const row of rows) {
      if ((known[row.item_id] || 0) >= row.version) continue;
      let value;
      try { value = await openItem(acct, row.item_id, row.version, row.body); } catch { continue; } // tampered: ignore
      known[row.item_id] = row.version;
      if (value.store === "audio") recordings.push(value);
      else if (value.deleted) payload.deleted.push(value.deleted);
      else if (STORES.includes(value.store)) (payload.records[value.store] ||= []).push(value.record);
    }
  }
  const local = { notes: state.notes, events: state.events, projects: state.projects };
  const plan = incoming(local, await all("deleted"), payload);
  const SAVE = { notes: saveNote, events: saveEvent, projects: saveProject };
  const DELETE = { notes: deleteNote, events: deleteEvent, projects: deleteProject };
  for (const { store, record } of plan.put) await SAVE[store](record, { remote: true, from: "cloud" });
  for (const { store, id } of plan.remove) await DELETE[store](id, { remote: true, from: "cloud" });
  for (const t of plan.tombstones) await put("deleted", t);
  write(LS.seen, known);
  const haveAudio = new Set(await audioIds());
  let gotAudio = 0;
  for (const r of recordings) {
    if (haveAudio.has(r.id)) continue;
    const ids = [];
    for (let i = 0; i < r.parts; i++) ids.push(await itemId(acct, "audio-part", `${r.id}:${i}`));
    const chunks = new Array(r.parts);
    for (let i = 0; i < ids.length; i += 4) {
      for (const row of await backend.get(acct, ids.slice(i, i + 4))) {
        chunks[ids.indexOf(row.item_id)] = await openBytes(acct, row.item_id, row.version, row.body);
      }
    }
    if (chunks.some((c) => !c)) continue; // still uploading from the other device; next time
    await put("audio", { id: r.id, blob: new Blob(chunks, { type: r.mime }) });
    const done = new Set(read(LS.audio, []));
    done.add(r.id);
    write(LS.audio, [...done]);
    gotAudio++;
  }
  saveAccount({ cursor });
  const count = plan.put.length + plan.remove.length;
  if (count || gotAudio) window.dispatchEvent(new CustomEvent("seekto:synced", { detail: { from: "your storage", count, audio: gotAudio > 0 } }));
}

/** Push local changes, then pull new ones. Safe to call any time. */
export function syncNow() {
  if (!acct || !backend) return Promise.resolve();
  if (busy) return busy;
  busy = (async () => {
    saveAccount({ syncing: true });
    try {
      await push();
      await pull();
      saveAccount({ syncing: false, lastSync: Date.now(), error: null });
    } catch (err) {
      saveAccount({ syncing: false, error: err.message, gone: !!err.gone });
    } finally {
      busy = null;
    }
  })();
  return busy;
}

/** Start syncing if this device has an account turned on. */
export async function startCloud() {
  const a = account();
  clearInterval(timer);
  acct = null;
  backend = null;
  if (!a?.enabled || !isValidAccountKey(a.key)) return;
  acct = await deriveAccount(a.key);
  backend = supabase(a.url, a.apiKey);
  timer = setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, POLL_MS);
  syncNow();
}

window.addEventListener("focus", () => syncNow());

// ---------- Setting up, joining, changing the key, leaving ----------
export function newKey() { return makeAccountKey(); }

/** Turn on storage with a key (new or existing). Uploads what's here and downloads what's there. */
export async function connectAccount({ key, url, apiKey }) {
  const k = formatAccountKey(key);
  const a = await deriveAccount(k);
  const s = supabase(url, apiKey);
  await s.register(a);
  write(LS.seen, {});
  write(LS.audio, []);
  saveAccount({ key: k, url: url.trim(), apiKey: apiKey.trim(), enabled: true, cursor: 0, error: null, gone: false, since: Date.now() });
  const { keys } = await everything();
  addToOutbox(keys);
  await startCloud();
  await busy;
  return account();
}

/** Stop syncing on this device. The storage keeps its copy; the key stays unless `forgetKey`. */
export function disconnect({ forgetKey = false } = {}) {
  clearInterval(timer);
  acct = null;
  backend = null;
  if (forgetKey) { write(LS.account, null); write(LS.seen, null); write(LS.outbox, null); write(LS.audio, null); emit(); }
  else saveAccount({ enabled: false });
}

/** Delete everything this account has on the storage, then stop syncing here. */
export async function deleteCloudCopy() {
  const a = account();
  await supabase(a.url, a.apiKey).forget(await deriveAccount(a.key));
  disconnect({ forgetKey: true });
}

/**
 * Make a new account key and move the data to it. Everything is encrypted again with keys from
 * the new code and the old account is deleted, so a lost device or a leaked key loses access.
 * Other devices will ask for the new key.
 */
export async function changeKey() {
  const a = account();
  await syncNow();
  const oldAcct = await deriveAccount(a.key);
  const key = makeAccountKey();
  await connectAccount({ key, url: a.url, apiKey: a.apiKey });
  if (account()?.error) throw new Error(account().error);
  await supabase(a.url, a.apiKey).forget(oldAcct);
  return key;
}

/** Text for a recovery kit file. */
export function recoveryKit(a = account()) {
  return [
    "SEEKTO RECOVERY KIT",
    "",
    "Keep this somewhere safe and private. Anyone with this key can read your Seekto notes, recordings and calendar.",
    "Nobody, including Seekto, can recover your data if you lose this key and all your devices.",
    "",
    `Account key:   ${a.key}`,
    `Storage:       ${a.url}`,
    `API key:       ${a.apiKey}`,
    "",
    "To use it on a new device: open Seekto, go to Settings > Account and storage > I have an account key.",
    `Made: ${new Date().toLocaleString()}`,
    "",
  ].join("\n");
}
