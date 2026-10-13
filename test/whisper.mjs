// Checks that private (on-device) transcription loads from this site alone: Transformers.js and
// its WebAssembly runtime come from site/vendor, the page's Content Security Policy allows them,
// and Seekto's own worker loads Whisper (tiny) and transcribes a short clip.
// Run after `npm run build && npm run vendor`; needs Hugging Face for the model download.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

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
  // 2. Seekto's worker loads Whisper and transcribes two seconds of a quiet tone
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const w = new Worker("./js/asr-worker.js", { type: "module" });
        const audio = new Float32Array(32000).map((_, i) => 0.01 * Math.sin(i / 8));
        const timer = setTimeout(() => resolve({ error: "timed out" }), 240000);
        w.onmessage = ({ data }) => {
          if (data.type === "ready")
            w.postMessage({ type: "run", model: "Xenova/whisper-tiny", audio, language: "english" });
          if (data.type === "result") {
            clearTimeout(timer);
            resolve({ ok: true, text: JSON.stringify(data.output).slice(0, 120) });
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
  );
  console.log(
    `${result.ok ? "ok  " : "FAIL"} Whisper runs in Seekto's worker${result.ok ? ` (${result.text})` : `: ${result.error}`}`,
  );
  failed ||= !result.ok;
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
