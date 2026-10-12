// Your account: a key with no login, and end-to-end encryption for storage you bring yourself.
//
// The account key is 23 random characters plus a check character (about 114 bits), shown as
// six groups of four: K7M2-P9QX-... Everything else comes from it with HKDF:
//   account id   - which rows are yours on the storage server (reveals nothing else)
//   write token  - proves to the server that you may change those rows (it stores only a hash)
//   item key     - turns "notes:note-123" into an opaque id, so the server can't see what's what
//   data key     - AES-GCM key that encrypts every item
// The storage only ever sees the account id, opaque item ids, version numbers and ciphertext.
// Each ciphertext is bound to its account, item id and version, so the server can't swap items
// or pass an old version off as a new one.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 characters, no 0/O or 1/I/L
const RANDOM_CHARS = 23;
const SALT = "seekto/account/v1";

/** A new account key. `bytes(n)` returns n random bytes (defaults to WebCrypto). */
export function makeAccountKey(bytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  let out = "";
  while (out.length < RANDOM_CHARS) {
    for (const b of bytes(32)) {
      if (b < 248 && out.length < RANDOM_CHARS) out += ALPHABET[b % 31]; // 248 = 31 * 8, so no bias
    }
  }
  return formatAccountKey(out + checkChar(out));
}

function checkChar(chars) {
  let sum = 0;
  for (let i = 0; i < chars.length; i++) sum += (i + 1) * ALPHABET.indexOf(chars[i]);
  return ALPHABET[sum % 31];
}

/** Upper case, no spaces or dashes. */
export function normalizeAccountKey(input) {
  return String(input || "").toUpperCase().replace(/[\s\-_.]/g, "");
}

export function formatAccountKey(input) {
  return normalizeAccountKey(input).match(/.{1,4}/g)?.join("-") || "";
}

/** Right length, right characters, and the check character matches (catches most typos). */
export function isValidAccountKey(input) {
  const k = normalizeAccountKey(input);
  if (k.length !== RANDOM_CHARS + 1 || [...k].some((c) => !ALPHABET.includes(c))) return false;
  return checkChar(k.slice(0, RANDOM_CHARS)) === k[RANDOM_CHARS];
}

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Everything derived from the account key. Throws if the key isn't valid. */
export async function deriveAccount(accountKey, crypto = globalThis.crypto) {
  if (!isValidAccountKey(accountKey)) throw new Error("That account key isn't right. Check each character.");
  const subtle = crypto.subtle;
  const base = await subtle.importKey("raw", enc.encode(normalizeAccountKey(accountKey)), "HKDF", false, ["deriveBits", "deriveKey"]);
  const params = (info) => ({ name: "HKDF", hash: "SHA-256", salt: enc.encode(SALT), info: enc.encode(info) });
  const bits = (info, n) => subtle.deriveBits(params(info), base, n);
  const [id, write] = await Promise.all([bits("account-id", 128), bits("write-token", 256)]);
  const itemKey = await subtle.deriveKey(params("item-ids"), base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  const dataKey = await subtle.deriveKey(params("data"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { accountId: hex(id), writeToken: hex(write), itemKey, dataKey, crypto };
}

/** The opaque storage id for a record, e.g. itemId(acct, "notes", "note-123"). */
export async function itemId(acct, kind, id) {
  return hex(await acct.crypto.subtle.sign("HMAC", acct.itemKey, enc.encode(`${kind}:${id}`))).slice(0, 40);
}

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const bound = (acct, id, version) => enc.encode(`${acct.accountId}|${id}|${version}`);

/** Encrypt bytes for item `id` at `version`. Returns base64 of IV + ciphertext. */
export async function sealBytes(acct, id, version, bytes) {
  const iv = acct.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await acct.crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: bound(acct, id, version) }, acct.dataKey, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return toBase64(out);
}

/** Decrypt; throws if the data, its id or its version were changed. */
export async function openBytes(acct, id, version, body) {
  const raw = fromBase64(body);
  try {
    const pt = await acct.crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.subarray(0, 12), additionalData: bound(acct, id, version) }, acct.dataKey, raw.subarray(12));
    return new Uint8Array(pt);
  } catch {
    throw new Error("An item from storage failed its integrity check and was ignored.");
  }
}

export async function sealItem(acct, id, version, value) {
  return sealBytes(acct, id, version, enc.encode(JSON.stringify(value)));
}

export async function openItem(acct, id, version, body) {
  return JSON.parse(new TextDecoder().decode(await openBytes(acct, id, version, body)));
}

/** A 4-digit code both screens show, so you can check they're talking to each other. */
export async function matchCode(binding, crypto = globalThis.crypto) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`seekto/match/${binding}`)));
  return String(((h[0] << 8) | h[1]) % 10000).padStart(4, "0");
}
