// Browser smoke test for the main path a stranger takes: the first screen plays the sample class,
// the practice test it ends on has as many questions as it says, a classmate opens the shared link on
// a phone, and pasting notes adds dates. Run after `npm run build`:
//   npm i --no-save playwright && npx playwright install chromium && node test/smoke.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const root = new URL("../site/", import.meta.url).pathname;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = join(root, path.endsWith("/") ? path + "index.html" : path);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const origin = `http://localhost:${server.address().port}`;

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };
const browser = await chromium.launch();
const errors = [];
const watch = (page, name) => {
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
};

// Answers for the English sample class, so the test scores like a student who studied.
const DEFS = { mitosis: "one cell dividing into two identical daughter cells", chromosome: "a long strand of DNA wrapped around proteins", centromere: "the point where the two copies of a chromosome are held together", meiosis: "the kind of division that makes sperm and egg cells, with half the chromosomes", cytokinesis: "the final step, when the cytoplasm splits into two cells" };
async function answerAll(page, { miss = 0 } = {}) {
  for (let k = 0; k < 15 && (await page.locator(".qcard").count()); k++) {
    const prompt = (await page.locator(".qcard .prompt").textContent()).replace(/blank/g, "").trim();
    const term = Object.keys(DEFS).find((d) => prompt.toLowerCase().startsWith(DEFS[d].slice(0, 20).toLowerCase()));
    const answer = k < miss ? "" : term || DEFS[prompt.toLowerCase()] || "";
    if (await page.locator(".choice").count()) {
      const options = await page.locator(".choice").allTextContents();
      const n = answer ? options.findIndex((o) => o.slice(1).trim().toLowerCase() === answer.toLowerCase()) : -1;
      if (n >= 0) await page.click(`[data-choice="${n}"]`); else await page.click("[data-skip]");
    } else if (answer) { await page.fill("#quizAnswer", answer); await page.click("[data-answer] .btn"); } else await page.click("[data-skip]");
    if (await page.locator("[data-mine]").count()) await page.click(`[data-mine="${answer ? 1 : 0}"]`);
    else await page.click("[data-next]");
  }
}

try {
  // 1. First screen on a laptop
  const desk = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "en-US", permissions: ["clipboard-read", "clipboard-write"] });
  const p = await desk.newPage();
  watch(p, "laptop");
  await p.addInitScript(() => (window.seektoDemoPace = 0.05));
  await p.goto(origin + "/");
  await p.waitForSelector("#hTest:not([hidden])", { timeout: 30000 });
  const said = Number(await p.textContent("#hQn"));
  check((await p.locator(".dcell.has").count()) >= 2, "sample dates land on the first-screen calendar");
  await p.click("[data-take]");
  await p.waitForSelector(".qcard");
  const total = Number((await p.textContent(".overlay .mono [aria-hidden]")).split("/")[1]);
  check(said === total && total > 0, `first screen says ${said} questions and the test has ${total}`);
  check((await p.locator(".choice").count()) > 0 || (await p.locator("#quizAnswer").count()) > 0, "question shows options or an answer box");
  await answerAll(p, { miss: 1 });
  await p.waitForSelector(".score");
  await p.click("[data-challenge]");
  await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  const link = clip.slice(clip.indexOf("http")).replace(/^https?:\/\/[^/#]+\/?[^#]*/, origin + "/");
  check(/#s=/.test(link), "challenge link copied");

  // 2. A classmate opens the link on a phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, locale: "en-US" });
  const q = await phone.newPage();
  watch(q, "phone");
  await q.goto(link);
  await q.waitForSelector(".qcard");
  check(/Your classmate got \d+ of \d+/.test(await q.textContent(".shared-head")), "shared test shows the classmate's score");
  check(!(await q.isVisible(".tabbar")), "shared test opens without the app around it");
  await answerAll(q, { miss: 2 });
  await q.waitForSelector(".score");
  check(true, "classmate finishes the shared test");

  // 3. Paste notes
  await p.keyboard.press("Escape");
  await p.goto(origin + "/#home");
  await p.click("[data-paste]");
  await p.fill("#pasteText", "The essay is due the 21st. Photosynthesis is how plants turn light into sugar.");
  await p.click("#pasteGo");
  await p.waitForSelector("#pasteOut .event");
  check(/1 date added/.test(await p.textContent("#pasteOut")), "pasted notes put a date on the calendar");

  // 4. Spanish interface
  const es = await browser.newContext({ locale: "es-ES" });
  const e = await es.newPage();
  watch(e, "es");
  await e.goto(origin + "/");
  await e.waitForSelector(".home-head");
  check(/Graba una clase/.test(await e.textContent(".home")), "first screen in Spanish");

  check(!errors.length, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
} catch (err) {
  console.log("FAIL", err.message);
  failed++;
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
