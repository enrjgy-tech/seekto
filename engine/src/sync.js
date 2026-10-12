// Pairing codes and the rules for syncing data between two devices.
// Every record has an id and an updatedAt time; deletions are kept as tombstones { id, store, at }
// so a deleted note doesn't come back from the other device. The newest change wins.

export const STORES = ["notes", "events", "projects"];
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L, easy to read aloud

/** A 6-character pairing code. `random` returns numbers in [0, 1). */
export function makeCode(random = Math.random, length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

/** Clean up a typed code: upper case, no spaces or dashes, common mix-ups fixed. */
export function normalizeCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/0/g, "O")
    .replace(/[1IL]/g, "1")
    .replace(/1/g, "I")
    .replace(/[^A-Z2-9]/g, "");
}

export function isValidCode(code) {
  return new RegExp(`^[${CODE_ALPHABET}]{6}$`).test(code);
}

/** A long random id, for device ids and shared secrets. */
export function randomId(bytes = 16, crypto = globalThis.crypto) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, bytes * 2);
}

const stamp = (r) => r.updatedAt || r.createdAt || 0;

/** What this device has: { notes: { id: updatedAt }, ..., deleted: { id: at }, audio: [ids] }. */
export function manifest(data, tombstones = [], audioIds = []) {
  const m = { deleted: {}, audio: [...audioIds] };
  for (const s of STORES) m[s] = Object.fromEntries((data[s] || []).map((r) => [r.id, stamp(r)]));
  for (const t of tombstones) m.deleted[t.id] = t.at;
  return m;
}

/**
 * What to send to the other device, given its manifest.
 * Returns { records: { notes: [...], ... }, deleted: [tombstones], audio: [ids] }.
 */
export function outgoing(data, tombstones, audioIds, remote) {
  const out = { records: {}, deleted: [], audio: [] };
  for (const s of STORES) {
    out.records[s] = (data[s] || []).filter((r) => {
      const theirs = remote[s]?.[r.id];
      const theirDelete = remote.deleted?.[r.id];
      if (theirDelete !== undefined && theirDelete >= stamp(r)) return false;
      return theirs === undefined || stamp(r) > theirs;
    });
  }
  out.deleted = tombstones.filter((t) => remote.deleted?.[t.id] === undefined);
  const theirAudio = new Set(remote.audio || []);
  const needed = new Set(out.records.notes.map((n) => n.audioId).filter(Boolean));
  out.audio = audioIds.filter((id) => needed.has(id) && !theirAudio.has(id));
  return out;
}

/**
 * Decide what to do with records and tombstones that arrived from the other device.
 * local: { notes: [...], ... } and localTombstones. Returns { put: [{ store, record }], remove: [{ store, id }], tombstones: [...] }.
 */
export function incoming(local, localTombstones, payload) {
  const result = { put: [], remove: [], tombstones: [] };
  const deletedHere = new Map(localTombstones.map((t) => [t.id, t.at]));
  for (const s of STORES) {
    const mine = new Map((local[s] || []).map((r) => [r.id, r]));
    for (const r of payload.records?.[s] || []) {
      const have = mine.get(r.id);
      const gone = deletedHere.get(r.id);
      if (gone !== undefined && gone >= stamp(r)) continue;
      if (!have || stamp(r) > stamp(have)) result.put.push({ store: s, record: r });
    }
  }
  for (const t of payload.deleted || []) {
    if (deletedHere.has(t.id)) continue;
    const store = t.store && STORES.includes(t.store) ? t.store : STORES.find((s) => (local[s] || []).some((r) => r.id === t.id));
    const have = store && (local[store] || []).find((r) => r.id === t.id);
    if (have && stamp(have) > t.at) continue;
    if (have) result.remove.push({ store, id: t.id });
    result.tombstones.push(t);
  }
  return result;
}

/** Split a string into pieces no longer than `size` characters, tagged so they can be rejoined. */
export function chunk(text, size = 3000) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.length ? parts : [""];
}

/**
 * Encode a message for a pub/sub server with a size cap (ntfy turns anything over 4096 bytes
 * into an attachment). Returns frame strings, each at most `limit` UTF-8 bytes.
 */
export function frames(text, id, limit = 3800) {
  const bytes = (s) => new TextEncoder().encode(s).length;
  for (let size = 3000; size >= 16; size = Math.floor(size / 2)) {
    const parts = chunk(text, size);
    const out = parts.map((d, i) => JSON.stringify({ m: id, i, n: parts.length, d }));
    if (out.every((f) => bytes(f) <= limit)) return out;
  }
  throw new Error("Message is too large to send.");
}

/** Collects chunks per message id and returns the full text once every part has arrived. */
export function makeAssembler() {
  const pending = new Map();
  return (id, index, total, part) => {
    if (!pending.has(id)) pending.set(id, new Array(total));
    const parts = pending.get(id);
    parts[index] = part;
    if (parts.filter((p) => p !== undefined).length < total) return null;
    pending.delete(id);
    return parts.join("");
  };
}

/** A short, friendly name for this device from its user agent. */
/** The DTLS fingerprints of both ends of a connection, in a fixed order. */
export function channelBinding(localSdp = "", remoteSdp = "") {
  const fp = (sdp) => (sdp.match(/a=fingerprint:\S+ (\S+)/) || [])[1] || "";
  return [fp(localSdp), fp(remoteSdp)].sort().join("|");
}

export function deviceName(ua = "") {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux computer";
  return "Device";
}

/**
 * Prove you hold the shared secret without sending it: SHA-256 over the challenge, the
 * connection's fingerprints, who is proving, and the secret. Binding the fingerprints stops a
 * proof from being relayed to another connection; binding the prover stops it being reflected.
 */
export async function proof(secret, nonce, crypto = globalThis.crypto, { channel = "", prover = "" } = {}) {
  const data = new TextEncoder().encode(`${nonce}|${channel}|${prover}:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
