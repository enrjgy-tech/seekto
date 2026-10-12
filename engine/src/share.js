// Share a practice test as a link. The questions are compressed into the part of the link
// after "#", which browsers never send to any server, so a shared test isn't stored anywhere.

const LIMIT = 120_000; // characters of JSON once unpacked
const MAX_QUESTIONS = 200;
const KINDS = new Set(["term", "define", "blank", "ai"]);

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
function toBase64Url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(text) {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
const str = (v, max) => String(v ?? "").slice(0, max);

/** Clean a shared test: only known fields, sane lengths. Throws if nothing usable is left. */
export function cleanShared(value) {
  if (!value || typeof value !== "object") throw new Error("This link doesn't contain a practice test.");
  const questions = (Array.isArray(value.q) ? value.q : [])
    .filter((q) => q && KINDS.has(q.k) && q.p && q.a)
    .slice(0, MAX_QUESTIONS)
    .map((q) => ({ kind: q.k, prompt: str(q.p, 600), answer: str(q.a, 400) }));
  if (!questions.length) throw new Error("This link doesn't contain a practice test.");
  return { title: str(value.t, 120) || "Practice test", questions };
}

/** Questions ({ kind, prompt, answer }) and a title -> the part of a link after "#s=". */
export async function encodeShare({ title, questions }) {
  const value = { v: 1, t: str(title, 120), q: questions.slice(0, MAX_QUESTIONS).map((q) => ({ k: q.kind, p: str(q.prompt, 600), a: str(q.answer, 400) })) };
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream("deflate-raw")));
}

/** The reverse of encodeShare. Throws a friendly error on anything broken or too large. */
export async function decodeShare(text) {
  let json;
  try {
    const bytes = await pipe(fromBase64Url(String(text)), new DecompressionStream("deflate-raw"));
    if (bytes.length > LIMIT) throw new Error("too large");
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("This link is broken or incomplete. Ask for it again.");
  }
  return cleanShared(json);
}

/** Turn a shared test into note text that Seekto's own quiz can use again. */
export function sharedToText({ questions }) {
  const lines = [];
  const seen = new Set();
  for (const q of questions) {
    let line = null;
    if (q.kind === "term") line = `${q.answer} means ${q.prompt.replace(/[.!?]+$/, "")}.`;
    else if (q.kind === "define") line = `${q.prompt} means ${q.answer.replace(/[.!?]+$/, "")}.`;
    else if (q.kind === "blank") line = q.prompt.replace(/_{3,}/, q.answer);
    else line = `${q.prompt.replace(/[?.!\s]+$/, "")}: ${q.answer}`;
    const key = line?.toLowerCase();
    if (line && !seen.has(key)) { seen.add(key); lines.push(line); }
  }
  return lines.join("\n");
}
