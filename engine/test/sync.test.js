import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  makeCode, normalizeCode, isValidCode, randomId, manifest, outgoing, incoming, chunk, frames, makeAssembler, channelBinding, deviceName, proof,
} from "../src/sync.js";

test("makes readable 6-character codes and cleans typed ones", () => {
  let i = 0;
  const seq = [0, 0.1, 0.5, 0.9, 0.99, 0.3];
  const code = makeCode(() => seq[i++]);
  assert.equal(code.length, 6);
  assert.ok(isValidCode(code));
  assert.ok(!/[01OIL]/.test(makeCode()));
  assert.equal(normalizeCode(" abc-def "), "ABCDEF");
  assert.equal(normalizeCode("k7m 2p9"), "K7M2P9");
  assert.equal(normalizeCode("h0use1"), "HOUSEI");
  assert.ok(!isValidCode("ABC12"));
});

test("random ids are long and unique", () => {
  const a = randomId(16, webcrypto);
  assert.equal(a.length, 32);
  assert.notEqual(a, randomId(16, webcrypto));
});

const phone = {
  notes: [
    { id: "n1", title: "Bio", updatedAt: 200, audioId: "a1" },
    { id: "n2", title: "Math (edited on phone)", updatedAt: 300 },
  ],
  events: [{ id: "e1", title: "Quiz", date: "2026-10-16", updatedAt: 100 }],
  projects: [],
};
const laptop = {
  notes: [
    { id: "n2", title: "Math", updatedAt: 250 },
    { id: "n3", title: "History", updatedAt: 120 },
  ],
  events: [],
  projects: [{ id: "p1", title: "Essay", updatedAt: 90 }],
};

test("sends only what the other device lacks or has older, with needed audio", () => {
  const laptopManifest = manifest(laptop, [], []);
  const out = outgoing(phone, [], ["a1"], laptopManifest);
  assert.deepEqual(out.records.notes.map((n) => n.id), ["n1", "n2"]);
  assert.deepEqual(out.records.events.map((e) => e.id), ["e1"]);
  assert.deepEqual(out.audio, ["a1"]);
  const back = outgoing(laptop, [], [], manifest(phone, [], ["a1"]));
  assert.deepEqual(back.records.notes.map((n) => n.id), ["n3"]);
  assert.deepEqual(back.records.projects.map((p) => p.id), ["p1"]);
});

test("newest change wins when records arrive", () => {
  const res = incoming(laptop, [], outgoing(phone, [], [], manifest(laptop)));
  assert.deepEqual(res.put.map((p) => `${p.store}:${p.record.id}`), ["notes:n1", "notes:n2", "events:e1"]);
  const stale = incoming(phone, [], { records: { notes: [{ id: "n2", title: "old", updatedAt: 250 }] } });
  assert.deepEqual(stale.put, []);
});

test("deletions sync and don't come back", () => {
  const tomb = [{ id: "n3", store: "notes", at: 500 }];
  // Laptop deleted n3 at 500; phone has never seen n3.
  const laptopAfter = { ...laptop, notes: laptop.notes.filter((n) => n.id !== "n3") };
  const toPhone = outgoing(laptopAfter, tomb, [], manifest(phone, [], ["a1"]));
  assert.deepEqual(toPhone.deleted, tomb);
  // Phone had n3 from an earlier sync: it removes it.
  const phoneWithN3 = { ...phone, notes: [...phone.notes, { id: "n3", updatedAt: 120 }] };
  const res = incoming(phoneWithN3, [], toPhone);
  assert.deepEqual(res.remove, [{ store: "notes", id: "n3" }]);
  assert.deepEqual(res.tombstones, tomb);
  // The phone won't resend n3 to a laptop that deleted it.
  const resend = outgoing(phoneWithN3, [], [], manifest(laptopAfter, tomb));
  assert.ok(!resend.records.notes.some((n) => n.id === "n3"));
  // And an incoming copy of a record deleted here is ignored.
  assert.deepEqual(incoming(laptopAfter, tomb, { records: { notes: [{ id: "n3", updatedAt: 120 }] } }).put, []);
  // An edit made after the deletion wins over it.
  assert.equal(incoming(laptopAfter, tomb, { records: { notes: [{ id: "n3", updatedAt: 900 }] } }).put.length, 1);
});

test("splits and reassembles long messages in any order", () => {
  const text = "x".repeat(7000) + "end";
  const parts = chunk(text, 3000);
  assert.equal(parts.length, 3);
  const add = makeAssembler();
  assert.equal(add("m1", 2, 3, parts[2]), null);
  assert.equal(add("m1", 0, 3, parts[0]), null);
  assert.equal(add("m1", 1, 3, parts[1]), text);
});

test("names devices and proves a shared secret", async () => {
  assert.equal(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "iPhone");
  assert.equal(deviceName("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile"), "Android phone");
  assert.equal(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "Windows PC");
  assert.equal(deviceName("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)"), "Chromebook");
  const a = await proof("secret", "n1", webcrypto);
  assert.equal(a.length, 64);
  assert.equal(a, await proof("secret", "n1", webcrypto));
  assert.notEqual(a, await proof("secret", "n2", webcrypto));
});

test("frames stay under the server's size limit, even with escaping and accents", () => {
  const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\na=fingerprint:sha-256 AB:CD\r\n'.repeat(120);
  const text = JSON.stringify({ type: "offer", sdp, name: "Éloïse's \"iPhone\"".repeat(40) });
  const out = frames(text, "abc", 3800);
  const add = makeAssembler();
  let whole = null;
  for (const f of out) {
    assert.ok(new TextEncoder().encode(f).length <= 3800);
    const p = JSON.parse(f);
    whole = add(p.m, p.i, p.n, p.d) ?? whole;
  }
  assert.equal(whole, text);
});

test("proofs are bound to the connection and to who is proving", async () => {
  const offer = "v=0\r\na=fingerprint:sha-256 AA:11\r\n";
  const answer = "v=0\r\na=fingerprint:sha-256 BB:22\r\n";
  const channel = channelBinding(offer, answer);
  assert.equal(channel, channelBinding(answer, offer));
  const base = await proof("s", "n", webcrypto, { channel, prover: "dev-a" });
  assert.notEqual(base, await proof("s", "n", webcrypto, { channel, prover: "dev-b" }));
  assert.notEqual(base, await proof("s", "n", webcrypto, { channel: channelBinding(offer, "a=fingerprint:sha-256 CC:33"), prover: "dev-a" }));
  assert.notEqual(base, await proof("other", "n", webcrypto, { channel, prover: "dev-a" }));
});
