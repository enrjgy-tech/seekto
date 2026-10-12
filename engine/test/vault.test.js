import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  makeAccountKey, normalizeAccountKey, formatAccountKey, isValidAccountKey, deriveAccount, itemId, sealItem, openItem, sealBytes, openBytes, matchCode,
} from "../src/index.js";

const rand = (n) => webcrypto.getRandomValues(new Uint8Array(n));

test("account keys are 24 readable characters with a check character", () => {
  const key = makeAccountKey(rand);
  assert.match(key, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){5}$/);
  assert.ok(!/[01ILO]/.test(key));
  assert.ok(isValidAccountKey(key));
  assert.ok(isValidAccountKey(key.toLowerCase().replace(/-/g, " ")));
  assert.equal(formatAccountKey(normalizeAccountKey(key)), key);
  // one wrong character is caught
  const k = normalizeAccountKey(key);
  const swap = k[5] === "A" ? "B" : "A";
  assert.ok(!isValidAccountKey(k.slice(0, 5) + swap + k.slice(6)));
  assert.ok(!isValidAccountKey(k.slice(0, 23)));
  assert.notEqual(makeAccountKey(rand), key);
});

test("the same key always gives the same account, and a different key a different one", async () => {
  const key = makeAccountKey(rand);
  const a = await deriveAccount(key, webcrypto);
  const b = await deriveAccount(key.toLowerCase(), webcrypto);
  assert.match(a.accountId, /^[0-9a-f]{32}$/);
  assert.match(a.writeToken, /^[0-9a-f]{64}$/);
  assert.equal(a.accountId, b.accountId);
  assert.equal(a.writeToken, b.writeToken);
  assert.notEqual(a.accountId, a.writeToken.slice(0, 32));
  const c = await deriveAccount(makeAccountKey(rand), webcrypto);
  assert.notEqual(a.accountId, c.accountId);
  await assert.rejects(deriveAccount("AAAA-BBBB", webcrypto), /isn't right/);
});

test("item ids are opaque and stable", async () => {
  const a = await deriveAccount(makeAccountKey(rand), webcrypto);
  const id = await itemId(a, "notes", "note-123");
  assert.match(id, /^[0-9a-f]{40}$/);
  assert.equal(id, await itemId(a, "notes", "note-123"));
  assert.notEqual(id, await itemId(a, "events", "note-123"));
  assert.ok(!id.includes("note"));
});

test("items decrypt only with the right key, id and version", async () => {
  const key = makeAccountKey(rand);
  const a = await deriveAccount(key, webcrypto);
  const id = await itemId(a, "notes", "n1");
  const note = { id: "n1", title: "Cells", text: "Mitosis means one cell dividing into two." };
  const body = await sealItem(a, id, 1700000000000, { store: "notes", record: note });
  assert.ok(!body.includes("Mitosis"));
  assert.deepEqual(await openItem(a, id, 1700000000000, body), { store: "notes", record: note });
  // an old version passed off as new, or one item swapped for another, fails
  await assert.rejects(openItem(a, id, 1700000000001, body), /integrity/);
  await assert.rejects(openItem(a, await itemId(a, "notes", "n2"), 1700000000000, body), /integrity/);
  // another account can't read it
  const other = await deriveAccount(makeAccountKey(rand), webcrypto);
  await assert.rejects(openItem(other, id, 1700000000000, body), /integrity/);
  // two seals of the same thing look different
  assert.notEqual(body, await sealItem(a, id, 1700000000000, { store: "notes", record: note }));
});

test("recording bytes round-trip", async () => {
  const a = await deriveAccount(makeAccountKey(rand), webcrypto);
  const bytes = new Uint8Array(300000).map((_, i) => i % 251);
  const body = await sealBytes(a, "p", 2, bytes);
  assert.deepEqual(await openBytes(a, "p", 2, body), bytes);
});

test("both screens get the same 4-digit match code", async () => {
  const code = await matchCode("AA:11|BB:22", webcrypto);
  assert.match(code, /^\d{4}$/);
  assert.equal(code, await matchCode("AA:11|BB:22", webcrypto));
  assert.notEqual(code, await matchCode("AA:11|CC:33", webcrypto));
});
