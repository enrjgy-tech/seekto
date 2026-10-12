// Connect devices with a short code and keep them in sync.
//
// How it works:
// 1. Devices meet through a public message service (ntfy.sh by default, or your own server).
//    Only connection setup goes through it: who wants to connect and how to reach each other.
// 2. The devices then open a direct, encrypted WebRTC connection. Notes, recordings, the
//    calendar and assignments travel over that connection, never through the server.
// 3. A first pairing needs the 6-letter code and a tap on "Allow" on the device showing it.
//    Paired devices share a secret and reconnect on their own, proving the secret each time.
import { state, saveNote, saveEvent, saveProject, deleteNote, deleteEvent, deleteProject } from "./state.js";
import { all, put, get, audioIds } from "./store.js";
import { account } from "./cloud.js";
import {
  makeCode, normalizeCode, isValidCode, randomId, manifest, outgoing, incoming, frames, makeAssembler, deviceName, proof, channelBinding, matchCode, STORES,
} from "../engine/index.js";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }];
const BLOB_CHUNK = 16 * 1024;
const LS = { me: "seekto.device", paired: "seekto.paired" };

// ---------- This device and its paired devices ----------
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not available */ } }

export function me() {
  let d = read(LS.me, null);
  if (!d) { d = { id: randomId(16), name: deviceName(navigator.userAgent) }; write(LS.me, d); }
  return d;
}
export function renameMe(name) { const d = me(); d.name = name.trim() || d.name; write(LS.me, d); }
export function paired() { return read(LS.paired, []); }
function savePaired(list) { write(LS.paired, list); emit(); }
export function forget(id) { savePaired(paired().filter((p) => p.id !== id)); links.get(id)?.close(); }

// ---------- Status for the UI ----------
const links = new Map(); // deviceId -> Link
const listeners = new Set();
export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(); }
export function connected() { return [...links.values()].filter((l) => l.open).map((l) => l.peer); }

// ---------- Meeting point: ntfy-compatible publish/subscribe ----------
function server() { return (state.settings.signalServer || "https://ntfy.sh").replace(/\/+$/, ""); }

class Topic {
  constructor(name, onMessage, onError) {
    this.name = name;
    this.assemble = makeAssembler();
    this.ready = new Promise((resolve) => {
      this.es = new EventSource(`${server()}/${name}/sse`);
      this.es.addEventListener("open", () => resolve());
      this.es.onmessage = (e) => {
        let outer;
        try { outer = JSON.parse(e.data); } catch { return; }
        if (outer.event && outer.event !== "message") { if (outer.event === "open") resolve(); return; }
        let part;
        try { part = JSON.parse(outer.message); } catch { return; }
        const whole = this.assemble(part.m, part.i, part.n, part.d);
        if (whole === null) return;
        let msg;
        try { msg = JSON.parse(whole); } catch { return; }
        if (msg.from === me().id) return;
        onMessage(msg);
      };
      this.es.onerror = () => onError?.(new Error("Couldn't reach the connection server. Check your internet connection."));
      setTimeout(resolve, 4000);
    });
  }
  static async send(topic, msg) {
    for (const body of frames(JSON.stringify({ ...msg, from: me().id }), randomId(6))) {
      const res = await fetch(`${server()}/${topic}`, { method: "POST", body });
      if (!res.ok) throw new Error(res.status === 429 ? "The connection server is busy. Wait a minute and try again." : "Couldn't reach the connection server.");
    }
  }
  close() { this.es?.close(); }
}

// ---------- A direct connection to one device ----------
function iceDone(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const t = setTimeout(resolve, 5000);
    pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); resolve(); } });
  });
}

class Link {
  constructor({ peer, initiator, sendSignal }) {
    this.peer = peer; // { id, name }
    this.open = false;
    this.peerAudio = new Set();
    this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.sendSignal = sendSignal;
    this.handlers = new Map();
    this.queue = []; // messages that arrived before anyone listened for them
    this.blob = null;
    this.opened = new Promise((resolve, reject) => { this.resolveOpen = resolve; this.rejectOpen = reject; });
    if (initiator) this.attach(this.pc.createDataChannel("seekto", { ordered: true }));
    else this.pc.ondatachannel = (e) => this.attach(e.channel);
    this.pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(this.pc.connectionState)) this.close();
    };
    this.timer = setTimeout(() => { if (!this.open) { this.rejectOpen(new Error("The devices couldn't reach each other. Try both on the same Wi-Fi.")); this.close(); } }, 30000);
  }
  async offer() {
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await iceDone(this.pc);
    await this.sendSignal({ type: "offer", sdp: this.pc.localDescription.sdp });
  }
  async answer(sdp) {
    await this.pc.setRemoteDescription({ type: "offer", sdp });
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await iceDone(this.pc);
    await this.sendSignal({ type: "answer", sdp: this.pc.localDescription.sdp });
  }
  async accept(sdp) { await this.pc.setRemoteDescription({ type: "answer", sdp }); }
  attach(dc) {
    this.dc = dc;
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = 256 * 1024;
    dc.onopen = () => { this.open = true; clearTimeout(this.timer); this.resolveOpen(); emit(); };
    dc.onclose = () => this.close();
    dc.onmessage = (e) => this.receive(e.data);
  }
  on(type, fn) {
    this.handlers.set(type, fn);
    const waiting = this.queue.filter((m) => m.type === type);
    this.queue = this.queue.filter((m) => m.type !== type);
    for (const m of waiting) fn(m);
  }
  dispatch(msg) {
    const fn = this.handlers.get(msg.type);
    if (fn) fn(msg);
    else if (this.queue.length < 200) this.queue.push(msg);
  }
  send(msg) { if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(msg)); }
  // Recordings go one at a time so their pieces never interleave.
  sendBlob(id, blob) {
    this.sending = (this.sending || Promise.resolve()).then(() => this.sendBlobNow(id, blob)).catch(() => {});
    return this.sending;
  }
  async sendBlobNow(id, blob) {
    if (this.peerAudio.has(id) || this.dc?.readyState !== "open") return;
    const buf = await blob.arrayBuffer();
    const parts = Math.ceil(buf.byteLength / BLOB_CHUNK) || 1;
    this.send({ type: "blob", id, size: buf.byteLength, mime: blob.type, parts });
    for (let i = 0; i < parts; i++) {
      if (this.dc.readyState !== "open") return;
      if (this.dc.bufferedAmount > 1024 * 1024) await new Promise((r) => (this.dc.onbufferedamountlow = r));
      this.dc.send(buf.slice(i * BLOB_CHUNK, (i + 1) * BLOB_CHUNK));
    }
    this.peerAudio.add(id);
  }
  receive(data) {
    if (data instanceof ArrayBuffer) {
      if (!this.blob) return;
      this.blob.chunks.push(data);
      if (this.blob.chunks.length === this.blob.parts) {
        const { id, mime, chunks } = this.blob;
        this.blob = null;
        this.dispatch({ type: "blob-done", id, blob: new Blob(chunks, { type: mime }) });
      }
      return;
    }
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.type === "blob") { this.blob = { ...msg, chunks: [] }; if (!msg.parts) { this.blob = null; this.dispatch({ type: "blob-done", id: msg.id, blob: new Blob([], { type: msg.mime }) }); } return; }
    if (msg.type === "blob-done") return; // only made locally
    this.dispatch(msg);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    clearTimeout(this.timer);
    try { this.dc?.close(); } catch { /* ignore */ }
    try { this.pc.close(); } catch { /* ignore */ }
    if (links.get(this.peer.id) === this) links.delete(this.peer.id);
    this.rejectOpen?.(new Error("Connection closed."));
    emit();
  }
}

// ---------- Syncing over an open link ----------
async function localData() {
  const [tombs, audio] = await Promise.all([all("deleted"), audioIds()]);
  return { data: { notes: state.notes, events: state.events, projects: state.projects }, tombs, audio };
}

const SAVE = { notes: saveNote, events: saveEvent, projects: saveProject };
const DELETE = { notes: deleteNote, events: deleteEvent, projects: deleteProject };

async function sendPayload(link, payload) {
  link.send({ type: "records", payload });
  for (const id of payload.audio || []) {
    const rec = await get("audio", id);
    if (rec?.blob) await link.sendBlob(id, rec.blob);
  }
}

function startSync(link) {
  link.on("manifest", async (msg) => {
    const { data, tombs, audio } = await localData();
    for (const id of msg.manifest.audio || []) link.peerAudio.add(id);
    await sendPayload(link, outgoing(data, tombs, audio, msg.manifest));
    link.send({ type: "sent" });
  });
  // Apply incoming changes one batch at a time, in the order they arrived.
  let chain = Promise.resolve();
  link.on("records", (msg) => { chain = chain.then(() => applyRecords(link, msg)).catch(() => {}); });
  link.on("blob-done", ({ id, blob }) => {
    chain = chain.then(async () => {
      await put("audio", { id, blob });
      link.peerAudio.add(id);
      window.dispatchEvent(new CustomEvent("seekto:synced", { detail: { from: link.peer.name, count: 0, audio: true } }));
    }).catch(() => {});
  });
  link.on("sent", () => {
    const list = paired().map((p) => (p.id === link.peer.id ? { ...p, lastSync: Date.now() } : p));
    savePaired(list);
  });
  link.on("account-request", async () => {
    const a = account();
    if (!a?.key) return link.send({ type: "account-deny", reason: `${me().name} doesn't have an account set up.` });
    const code = await linkCode(link);
    let answered = false;
    const respond = (ok) => {
      if (answered) return;
      answered = true;
      link.send(ok ? { type: "account-grant", account: { key: a.key, url: a.url, apiKey: a.apiKey } } : { type: "account-deny", reason: `${me().name} said no.` });
    };
    window.dispatchEvent(new CustomEvent("seekto:account-request", { detail: { name: link.peer.name, code, respond } }));
  });
  localData().then(({ data, tombs, audio }) => link.send({ type: "manifest", manifest: manifest(data, tombs, audio) }));
}

async function applyRecords(link, msg) {
  const { data, tombs } = await localData();
  const plan = incoming(data, tombs, msg.payload);
  for (const { store, record } of plan.put) await SAVE[store](record, { remote: true });
  for (const { store, id } of plan.remove) await DELETE[store](id, { remote: true });
  for (const t of plan.tombstones) {
    await put("deleted", t);
    window.dispatchEvent(new CustomEvent("seekto:changed", { detail: { deleted: t, from: "peer" } }));
  }
  const count = plan.put.length + plan.remove.length;
  if (count) window.dispatchEvent(new CustomEvent("seekto:synced", { detail: { from: link.peer.name, count } }));
}

// The 4-digit code both ends of a connection show, from the connection's own fingerprints.
function linkCode(link) {
  return matchCode(channelBinding(link.pc.localDescription?.sdp, link.pc.remoteDescription?.sdp));
}

/**
 * Ask a connected device for its account (key and storage). Returns { code, result }: show the
 * code, and `result` resolves with { key, url, apiKey } once the other device taps Allow.
 */
export async function requestAccount(peerId) {
  const link = links.get(peerId);
  if (!link?.open || !link.authed) throw new Error("That device isn't connected right now. Open Seekto on it and try again.");
  const code = await linkCode(link);
  const result = new Promise((resolve, reject) => {
    link.on("account-grant", (m) => resolve(m.account));
    link.on("account-deny", (m) => reject(new Error(m.reason || "The other device said no.")));
    setTimeout(() => reject(new Error("No answer from the other device.")), 120000);
  });
  link.send({ type: "account-request" });
  return { code, result };
}

// Live changes go to every open link.
window.addEventListener("seekto:changed", async (e) => {
  const { store, record, deleted, from } = e.detail;
  if (from === "peer") return; // came from a device; don't echo it back
  for (const link of links.values()) {
    if (!link.open || !link.authed) continue;
    if (deleted) { link.send({ type: "records", payload: { records: {}, deleted: [deleted] } }); continue; }
    const payload = { records: { [store]: [record] }, deleted: [], audio: [] };
    if (store === "notes" && record.audioId && !link.peerAudio.has(record.audioId)) payload.audio = [record.audioId];
    await sendPayload(link, payload);
  }
});

function register(link) {
  links.get(link.peer.id)?.close();
  links.set(link.peer.id, link);
  emit();
}

// ---------- Pairing with a code ----------
/**
 * Show a code on this device. Calls ui.onCode(code), ui.onRequest({ name }) -> Promise<boolean>,
 * ui.onPaired(peer), ui.onError(err). Returns a cancel function.
 */
export function hostPairing(ui) {
  const code = makeCode();
  const topicName = `seekto-pair-${code}`;
  let link = null;
  let done = false;
  let asking = false;
  let answered = false;
  const denied = new Set();
  const topic = new Topic(topicName, async (msg) => {
    if (done) return;
    if (msg.type === "hello" && !link && !asking && !denied.has(msg.from)) {
      asking = true;
      const ok = await ui.onRequest({ name: msg.name });
      asking = false;
      if (done) return;
      if (!ok) { denied.add(msg.from); Topic.send(topicName, { type: "denied", to: msg.from }); return; }
      const peer = { id: msg.from, name: msg.name };
      link = new Link({ peer, initiator: false, sendSignal: (m) => Topic.send(topicName, { ...m, to: peer.id }) });
      Topic.send(topicName, { type: "welcome", to: peer.id, name: me().name });
      link.opened.then(() => {
        const secret = randomId(24);
        link.send({ type: "pair", secret, id: me().id, name: me().name });
        link.on("paired", () => {
          done = true;
          savePaired([...paired().filter((p) => p.id !== peer.id), { ...peer, secret, lastSync: null }]);
          link.authed = true;
          register(link);
          startSync(link);
          topic.close();
          ui.onPaired(peer);
        });
      }).catch((err) => ui.onError(err));
    } else if (msg.type === "offer" && link && !answered && msg.to === me().id && msg.from === link.peer.id) {
      answered = true;
      link.answer(msg.sdp).catch((err) => ui.onError(err));
    }
  }, (err) => ui.onError(err));
  topic.ready.then(() => ui.onCode(code));
  const expiry = setTimeout(() => { if (!done) { topic.close(); ui.onError(new Error("The code expired. Make a new one.")); } }, 10 * 60 * 1000);
  return () => { done = true; clearTimeout(expiry); topic.close(); if (link && !link.authed) link.close(); };
}

/** Enter a code shown on another device. ui: onWaiting(), onPaired(peer), onError(err). Returns cancel. */
export function joinPairing(input, ui) {
  const code = normalizeCode(input);
  if (!isValidCode(code)) { ui.onError(new Error("Codes are 6 letters and numbers, like K7M2P9.")); return () => {}; }
  const topicName = `seekto-pair-${code}`;
  let link = null;
  let done = false;
  let helloTimer = null;
  const topic = new Topic(topicName, async (msg) => {
    if (done || msg.to !== me().id) return;
    if (msg.type === "denied") { done = true; topic.close(); clearInterval(helloTimer); ui.onError(new Error("The other device said no.")); }
    if (msg.type === "welcome" && !link) {
      clearInterval(helloTimer);
      const peer = { id: msg.from, name: msg.name };
      link = new Link({ peer, initiator: true, sendSignal: (m) => Topic.send(topicName, { ...m, to: peer.id }) });
      link.on("pair", (m) => {
        done = true;
        savePaired([...paired().filter((p) => p.id !== peer.id), { ...peer, name: m.name, secret: m.secret, lastSync: null }]);
        link.send({ type: "paired" });
        link.authed = true;
        register(link);
        startSync(link);
        topic.close();
        ui.onPaired(peer);
      });
      link.opened.catch((err) => ui.onError(err));
      link.offer().catch((err) => ui.onError(err));
    }
    if (msg.type === "answer" && link && msg.from === link.peer.id && !link.pc.remoteDescription) link.accept(msg.sdp).catch((err) => ui.onError(err));
  }, (err) => ui.onError(err));
  topic.ready.then(() => {
    const hello = () => Topic.send(topicName, { type: "hello", name: me().name });
    hello();
    helloTimer = setInterval(hello, 4000);
    ui.onWaiting?.();
    setTimeout(() => { if (!link && !done) { clearInterval(helloTimer); topic.close(); ui.onError(new Error("No device answered. Check the code and that the other device is showing it.")); } }, 90000);
  });
  return () => { done = true; clearInterval(helloTimer); topic.close(); if (link && !link.authed) link.close(); };
}

// ---------- Reconnecting to paired devices ----------
// Each device listens on its own private topic, named after its long random id.
// The device with the smaller id starts the connection; the other can ask it to with a "ping".
let inbox = null;
const pending = new Map(); // peerId -> Link being set up

// Both sides prove they hold the shared secret. Each proof covers this connection's
// fingerprints and the prover's id, so it can't be replayed, relayed or reflected.
function authenticate(link, secret) {
  return new Promise((resolve, reject) => {
    const nonce = randomId(12);
    const channel = channelBinding(link.pc.localDescription?.sdp, link.pc.remoteDescription?.sdp);
    let theirsOk = false;
    let mineSent = false;
    const finish = () => { if (theirsOk && mineSent) resolve(); };
    const fail = (message) => { reject(new Error(message)); link.close(); };
    link.on("challenge", async (m) => {
      if (!m.nonce || m.nonce === nonce) return fail("That device couldn't prove it's paired.");
      link.send({ type: "proof", value: await proof(secret, m.nonce, crypto, { channel, prover: me().id }) });
      mineSent = true;
      finish();
    });
    link.on("proof", async (m) => {
      if (m.value === (await proof(secret, nonce, crypto, { channel, prover: link.peer.id }))) { theirsOk = true; finish(); } else fail("That device couldn't prove it's paired.");
    });
    link.send({ type: "challenge", nonce });
    setTimeout(() => reject(new Error("Pairing check timed out.")), 15000);
  });
}

async function connectTo(peer) {
  if (links.get(peer.id)?.open || pending.has(peer.id)) return;
  const topicName = `seekto-dev-${peer.id}`;
  const link = new Link({ peer, initiator: true, sendSignal: (m) => Topic.send(topicName, { ...m, to: peer.id }) });
  pending.set(peer.id, link);
  try {
    await link.offer();
    await link.opened;
    await authenticate(link, peer.secret);
    link.authed = true;
    register(link);
    startSync(link);
  } catch {
    link.close();
  } finally {
    pending.delete(peer.id);
  }
}

function startInbox() {
  inbox?.close();
  inbox = new Topic(`seekto-dev-${me().id}`, async (msg) => {
    if (msg.to !== me().id) return;
    const peer = paired().find((p) => p.id === msg.from);
    if (!peer) return;
    if (msg.type === "ping") { if (me().id < peer.id) connectTo(peer); return; }
    if (msg.type === "offer") {
      if (links.get(peer.id)?.open) links.get(peer.id).close();
      const link = new Link({ peer, initiator: false, sendSignal: (m) => Topic.send(`seekto-dev-${peer.id}`, { ...m, to: peer.id }) });
      try {
        await link.answer(msg.sdp);
        await link.opened;
        await authenticate(link, peer.secret);
        link.authed = true;
        register(link);
        startSync(link);
      } catch {
        link.close();
      }
      return;
    }
    if (msg.type === "answer") { const l = pending.get(peer.id); if (l && !l.pc.remoteDescription) l.accept(msg.sdp).catch(() => l.close()); }
  });
}

/** Reach out to every paired device that isn't connected. */
export function reconnectAll() {
  for (const peer of paired()) {
    if (links.get(peer.id)?.open) continue;
    if (me().id < peer.id) connectTo(peer);
    else Topic.send(`seekto-dev-${peer.id}`, { type: "ping", to: peer.id });
  }
}

/** Start listening for paired devices. Safe to call more than once. */
export function startDevices() {
  if (!paired().length) return;
  if (!inbox) startInbox();
  reconnectAll();
}

let keepAlive = null;
export function initDevices() {
  if (!("RTCPeerConnection" in window) || !("EventSource" in window)) return;
  startDevices();
  clearInterval(keepAlive);
  keepAlive = setInterval(() => { if (document.visibilityState === "visible" && paired().length) { if (!inbox) startInbox(); reconnectAll(); } }, 45000);
  onStatus(() => { if (paired().length && !inbox) startInbox(); });
}

export { STORES };
