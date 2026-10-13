// Study notes from a transcript, without any AI model: the lines a student would write down
// (not the chat around them), the course vocabulary, and headings where the teacher changes topic.
// Measured on real lectures in engine/bench/README.md; nothing here claims to understand the lecture.
import { sentences } from "./dates.js";
import { COMMON_WORDS } from "./common-words.js";
import { STOP } from "./search.js";

const WORD = /[\p{L}][\p{L}'-]*/gu;
// words that never belong in a course phrase
const FUNCTION = new Set(
  "the a an and or but so if then than that this these those there here is are was were be been being have has had do does did can could will would shall should may might must not no yes very really just also only even still too more most much many some any all each every both few little lot lots kind sort way thing things something anything everything nothing one two three first second next last other another same different new old good bad big small long short high low right left okay ok well now today yesterday tomorrow going gonna get got go went come came like about over under into out up down off again back away here where when what which who whom whose why how because since while until unless though although yeah um uh hmm oh ah mean means say said says see saw look looks know knew think thought want wanted need needed let lets make made take took give gave put keep kept".split(
    " ",
  ),
);
// "[MUSIC]", "[LAUGHTER]", "(inaudible)": transcript tags, not speech
const TAGS = /\s*[[(](?:music|laughter|applause|pause|inaudible|crosstalk|noise|silence)[\])]/gi;
export const stripTags = (text) => String(text).replace(TAGS, " ").replace(/\s+/g, " ").trim();
const lower = (s) => s.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

// Words a lecturer uses when a line carries content worth keeping.
const CUE =
  /\b(?:important|remember|key|main|because|therefore|which means|results? in|leads? to|causes?|called|known as|means|defined?|definition|for example|in other words|the reason|as a result|so that|first|second|third|difference|compared|unlike|discovered|invented|found that|the idea|the point|equals?|proportional|depends? on|in general|the rule|property|principle|law|theorem|formula|importante|recuerden|porque|significa|se llama|por ejemplo|lembrem|porque|chamamos|por exemplo)\b/i;
// Words that mark classroom chat, logistics or a question to the room.
const CHAT =
  /\b(?:okay|ok|you know|i think|i mean|let me|let's|gonna|sorry|thank|thanks|clicker|handout|homework|slide|joke|funny|raise your hand|any questions|can you hear|microphone|see you|good morning|good afternoon|welcome|office hours|email|website|syllabus|quiz|exam|problem set|pset|by the way|anyway|all right|alright|yeah|yes|no\b|hm+|uh|um)\b/i;
const QUESTION = /\?\s*$/;
// A sentence shaped like a definition: "A natural monopoly is a market where...", "what we call X", "known as X"
const DEFINED =
  /^(?:(?:so|and|okay|now),?\s+)?(?:an?\s+|the\s+)?[\p{L}][\p{L}' -]{2,40}?\s+(?:is|are|means|refers to|es|son|significa|é|são)\s+(?:an?|the|one|where|when|what|how|basically|just|simply|essentially|un|una|el|la|um|uma)\b|\b(?:what (?:we|they|people|economists|biologists|chemists|physicists|psychologists|i) call|known as|so[- ]called|referred to as|the term|the word|is called|are called|we call|se llama|chamamos)\b/iu;
const STARTS_SOFT = /^(?:so|and|but|okay|ok|now|well|right|alright|all right|then|yeah|um|uh|oh)\b[,\s]*/i;
const NUMBERS = /\b\d{3,4}\b/;
const PRONOUN_START = /^(?:i|we|you|he|she|they|it|this|that|there|here)\b/i;

/** Course vocabulary: words and two-word phrases the lecture keeps coming back to and everyday
 * speech does not use. [{ term, count }], most frequent first. */
export function keyTerms(text, { max = 30 } = {}) {
  text = stripTags(text);
  const words = (String(text).match(WORD) || []).map((w) => w.toLowerCase());
  const ok = (w) => w.length >= 4 && !COMMON_WORDS.has(w) && !/^\d/.test(w) && !/'/.test(w);
  const uni = new Map();
  const bi = new Map();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (ok(w)) uni.set(w, (uni.get(w) || 0) + 1);
    const n = words[i + 1];
    // a two-word phrase may use an everyday word ("demand curve", "cell wall") but not a function word
    const okIn = (x) => x.length >= 3 && !STOP.has(x) && !/^\d/.test(x) && !/'/.test(x) && !FUNCTION.has(x);
    if (n && okIn(w) && okIn(n) && !/(?:ed|ing)$/.test(n) && !(COMMON_WORDS.has(n) && /s$/.test(n) && !/ss$/.test(n))) {
      const k = `${w} ${n}`;
      bi.set(k, (bi.get(k) || 0) + 1);
    }
  }
  const long = words.length > 1500;
  const min = long ? 3 : 2;
  const out = [];
  const inBigram = new Set();
  for (const [k, c] of bi)
    // two everyday words make a course phrase only when the lecture keeps saying them together ("demand curve")
    if (c >= min && (k.split(" ").some(ok) || c >= Math.max(3, min))) {
      out.push({ term: k, count: c });
      for (const w of k.split(" ")) inBigram.add(w);
    }
  for (const [w, c] of uni)
    if (c >= min && !(inBigram.has(w) && c <= (bi.get(w) || c))) out.push({ term: w, count: c });
  // a word that only appears inside a kept phrase adds nothing on its own
  const phrases = out.filter((x) => x.term.includes(" "));
  const kept = out.filter(
    (x) => x.term.includes(" ") || !phrases.some((p) => p.term.split(" ").includes(x.term) && p.count >= x.count),
  );
  return kept.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term)).slice(0, max);
}

/** Score every sentence for "would a student write this down": course vocabulary, teaching
 * cues, a sentence that stands on its own, and not chat. Returns [{ index, text, score, why }]. */
export function scoreSentences(text, { terms } = {}) {
  text = stripTags(text);
  const list = sentences(text);
  const vocab = new Set((terms || keyTerms(text, { max: 60 })).map((t) => t.term));
  const single = new Set([...vocab].flatMap((t) => t.split(" ")));
  return list.map((s, index) => {
    const why = [];
    const ws = (s.match(WORD) || []).map((w) => w.toLowerCase());
    let score = 0;
    if (ws.length < 6) {
      why.push("too short");
      return { index, text: s, score: -5, why };
    }
    if (ws.length > 50) {
      score -= 1;
      why.push("very long");
    }
    const hits = ws.filter((w) => single.has(w)).length;
    const rare = ws.filter((w) => !single.has(w) && w.length >= 6 && !COMMON_WORDS.has(w)).length;
    const share = hits / ws.length;
    score += Math.min(share * 10, 4) + Math.min(rare * 0.5, 1.5);
    if (hits) why.push(`${hits} course words`);
    if (rare) why.push(`${rare} rare words`);
    if (DEFINED.test(s)) {
      score += 2;
      why.push("shaped like a definition");
    }
    if (CUE.test(s)) {
      score += 1.5;
      why.push("teaching cue");
    }
    if (CHAT.test(s)) {
      score -= 1.5;
      why.push("classroom chat");
    }
    if (QUESTION.test(s)) {
      score -= 2.5;
      why.push("a question");
    }
    const clean = s.replace(STARTS_SOFT, "");
    if (PRONOUN_START.test(clean) && !/\b(?:is|are|means|called)\b/i.test(clean)) {
      score -= 0.6;
      why.push("about us, not the subject");
    }
    if (!hits && !rare) {
      score -= 1;
      why.push("no course words");
    }
    if (ws.length < 9) {
      score -= 0.8;
      why.push("short");
    }
    if (/^(?:because|if|when|which|that|unless|although|so that|whereas)\b/i.test(clean)) {
      score -= 0.7;
      why.push("half a sentence");
    }
    if (/\b(?:I|I'm|I've|I'd|my|me|we used to|imagine that|imagine you|say you|suppose you|let's say)\b/.test(s)) {
      score -= 0.7;
      why.push("a story or an aside");
    }
    if (NUMBERS.test(s)) {
      score += 0.4;
      why.push("has a year or figure");
    }
    if (/\s--\s|--$/.test(s) || /\b(\w{3,})\s+\1\b/i.test(s)) {
      score -= 0.8;
      why.push("broken speech");
    }
    return { index, text: s, score: +score.toFixed(2), why };
  });
}

/** The lines worth keeping: about `share` of the sentences (never fewer than `min`, never more
 * than `max`), in the order they were said. Each line is cleaned of a leading "so" or "okay". */
export function keySentences(text, { share = 0.1, min = 5, max = 60, terms } = {}) {
  const scored = scoreSentences(text, { terms });
  const usable = scored.filter((x) => x.score > 0);
  const n = Math.min(max, Math.max(min, Math.round(scored.length * share)));
  const seen = new Set();
  const top = [];
  for (const x of [...usable].sort((a, b) => b.score - a.score)) {
    const key = lower(x.text)
      .replace(/[^\p{L} ]/gu, "")
      .split(" ")
      .slice(0, 8)
      .join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    top.push(x);
    if (top.length >= n) break;
  }
  return top.sort((a, b) => a.index - b.index).map((x) => ({ ...x, text: tidy(x.text) }));
}

function tidy(s) {
  const c = s.replace(STARTS_SOFT, "").replace(STARTS_SOFT, "").trim();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

const SHIFT =
  /^(?:so|okay|ok|now|alright|all right|and|then)?[,\s]*(?:today|now|next|first|then)?[,\s]*(?:let's|let us|we're going to|we are going to|we'll|we will|i want to|i'd like to|i'm going to|i am going to|next|the next thing is|now)\s+(?:now\s+)?(?:talk about|move on to|turn to|look at|start with|discuss|get to|go to|think about|introduce|cover|consider|focus on|spend some time on)\s+(?:the\s+|a\s+|an\s+|some\s+|this\s+|these\s+|our\s+)?(.{3,60}?)[.!?,]?$/i;
const TOPIC_LINE = /^(?:(?:so|okay|now|next),?\s+)?([A-Z][\p{L}-]*(?: [\p{L}-]+){0,3})[.:]$/u;

/** Where the teacher changes topic ("Let's talk about supply", "Now, the Rutherford model."):
 * [{ index, title }], at least `gap` sentences apart. */
export function sections(text, { gap = 12, terms } = {}) {
  text = stripTags(text);
  const list = sentences(text);
  const vocab = new Set((terms || keyTerms(text, { max: 60 })).map((t) => t.term));
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i].trim();
    let title = null;
    const m = s.match(SHIFT);
    if (m) title = m[1].replace(/\b(?:today|now|here|a little bit|a bit|briefly)\b/gi, "").trim();
    else {
      const t = s.match(TOPIC_LINE);
      if (t && t[1].split(" ").some((w) => vocab.has(w.toLowerCase()))) title = t[1];
    }
    if (!title || title.split(/\s+/).length > 6 || /\b(?:you|we|i|it|this|that)\b/i.test(title)) continue;
    if (
      !title
        .toLowerCase()
        .split(/\s+/)
        .some((w) => vocab.has(w) || [...vocab].some((v) => v.split(" ").includes(w)))
    )
      continue;
    title = title.replace(/[,;:]+$/, "").trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (out.length && i - out[out.length - 1].index < gap) continue;
    if (out.some((o) => o.title.toLowerCase() === title.toLowerCase())) continue;
    out.push({ index: i, title });
  }
  return out;
}

/** Study notes: sections with headings, each holding the key lines said in it. Lines carry the
 * course words they contain so a page can highlight them. */
export function studyNotes(text, opts = {}) {
  text = stripTags(text);
  const terms = keyTerms(text, { max: 60 });
  const lines = keySentences(text, { ...opts, terms });
  const heads = sections(text, { terms });
  const groups = [];
  let cur = { title: null, index: 0, lines: [] };
  let h = 0;
  for (const line of lines) {
    while (h < heads.length && heads[h].index <= line.index) {
      if (cur.lines.length || cur.title) groups.push(cur);
      cur = { title: heads[h].title, index: heads[h].index, lines: [] };
      h++;
    }
    cur.lines.push({
      ...line,
      terms: terms.filter((t) => new RegExp(`\\b${t.term}`, "i").test(line.text)).map((t) => t.term),
    });
  }
  if (cur.lines.length || cur.title) groups.push(cur);
  while (h < heads.length) (groups.push({ title: heads[h].title, index: heads[h].index, lines: [] }), h++);
  return { terms: terms.slice(0, 30), sections: groups.filter((g) => g.lines.length) };
}
