// Checks that private (on-device) transcription loads from this site alone: Transformers.js and
// its WebAssembly runtime come from site/vendor, the page's Content Security Policy allows them,
// and Seekto's own worker loads Whisper (tiny) and transcribes speech. With SPEECH_WAV set to a
// recording of "The chemistry quiz is on Friday." (CI makes one with espeak-ng), it checks the words
// come back and that the engine puts the quiz on the calendar: sound to calendar, end to end.
// Run after `npm run build && npm run vendor`; needs Hugging Face for the model download.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { readFileSync } from "node:fs";
import { findEvents } from "../engine/src/index.js";

/** A 16-bit PCM WAV file -> 16 kHz mono samples (plain linear resampling is fine for a test). */
function wavTo16k(path) {
  const b = readFileSync(path);
  let rate = 16000;
  let channels = 1;
  let at = 12;
  let data = null;
  while (at + 8 <= b.length) {
    const id = b.toString("ascii", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "fmt ") {
      channels = b.readUInt16LE(at + 10);
      rate = b.readUInt32LE(at + 12);
    }
    if (id === "data") data = b.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2);
  }
  const frames = Math.floor(data.length / 2 / channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) mono[i] = data.readInt16LE(i * 2 * channels) / 32768;
  const out = new Float32Array(Math.floor((frames * 16000) / rate));
  for (let i = 0; i < out.length; i++) {
    const x = (i * rate) / 16000;
    const j = Math.floor(x);
    out[i] = mono[j] + ((mono[Math.min(j + 1, frames - 1)] - mono[j]) * (x - j) || 0);
  }
  return out;
}
const speech = process.env.SPEECH_WAV ? Array.from(wavTo16k(process.env.SPEECH_WAV)) : null;

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const root = new URL("../site/", import.meta.url).pathname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = join(root, path.endsWith("/") ? path + "index.html" : path);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const origin = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
let failed = false;
try {
  const page = await browser.newPage();
  const outside = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin && /\.(m?js|wasm)$/.test(u.pathname)) outside.push(r.url());
  });
  const blocked = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) blocked.push(m.text());
  });
  await page.goto(origin + "/");
  // 1. The page itself may import the library (the CSP allows it)
  const lib = await page.evaluate(async () => typeof (await import("./vendor/transformers/transformers.js")).pipeline);
  console.log(`${lib === "function" ? "ok  " : "FAIL"} the page can load Transformers.js from this site`);
  failed ||= lib !== "function";
  // 2. Seekto's worker loads Whisper and transcribes the speech (or, without a recording, a quiet tone)
  const result = await page.evaluate(
    (samples) =>
      new Promise((resolve) => {
        const w = new Worker("./js/asr-worker.js", { type: "module" });
        const audio = samples
          ? Float32Array.from(samples)
          : new Float32Array(32000).map((_, i) => 0.01 * Math.sin(i / 8));
        const timer = setTimeout(() => resolve({ error: "timed out" }), 240000);
        w.onmessage = ({ data }) => {
          if (data.type === "ready")
            w.postMessage({ type: "run", model: "Xenova/whisper-tiny", audio, language: "english" });
          if (data.type === "result") {
            clearTimeout(timer);
            resolve({ ok: true, text: String(data.output?.text ?? "") });
          }
          if (data.type === "error") {
            clearTimeout(timer);
            resolve({ error: data.message });
          }
        };
        w.onerror = (e) => {
          clearTimeout(timer);
          resolve({ error: e.message || "worker failed" });
        };
        w.postMessage({ type: "load", model: "Xenova/whisper-tiny" });
      }),
    speech,
  );
  console.log(
    `${result.ok ? "ok  " : "FAIL"} Whisper runs in Seekto's worker${result.ok ? `: "${result.text.trim()}"` : `: ${result.error}`}`,
  );
  failed ||= !result.ok;
  if (speech && result.ok) {
    const heard = /quiz/i.test(result.text) && /friday/i.test(result.text);
    console.log(`${heard ? "ok  " : "FAIL"} the spoken words come back ("quiz", "Friday")`);
    const events = findEvents(result.text, { ref: new Date(2026, 9, 12, 12), locale: "en-US" });
    const onCalendar = events.some((e) => e.date === "2026-10-16" && e.type === "test");
    console.log(
      `${onCalendar ? "ok  " : "FAIL"} sound to calendar: ${JSON.stringify(events.map((e) => [e.date, e.title]))}`,
    );
    failed ||= !heard || !onCalendar;
  }
  console.log(
    `${outside.length ? "FAIL" : "ok  "} no script or WebAssembly from another server${outside.length ? `: ${outside.join(", ")}` : ""}`,
  );
  console.log(
    `${blocked.length ? "FAIL" : "ok  "} nothing blocked by the Content Security Policy${blocked.length ? `: ${blocked[0]}` : ""}`,
  );
  failed ||= outside.length > 0 || blocked.length > 0;
} catch (err) {
  console.log("FAIL", err.message);
  failed = true;
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
