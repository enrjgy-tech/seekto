// Organize notes and turn them into study material, without any AI model:
// subject and topic detection, definitions, quizzes, answer checking and exports.
import { sentences } from "./dates.js";
import { tokens, STOP } from "./search.js";

const SUBJECTS = [
  ["Math", ["equation", "derivative", "integral", "algebra", "calculus", "theorem", "polynomial", "function", "graph", "matrix", "probability", "geometry", "fraction", "variable", "proof", "limit", "slope"]],
  ["Biology", ["cell", "protein", "dna", "gene", "organism", "evolution", "enzyme", "membrane", "photosynthesis", "species", "mitochondria", "ecosystem"]],
  ["Chemistry", ["molecule", "atom", "reaction", "electron", "bond", "acid", "base", "compound", "element", "mole", "ion", "solution", "periodic"]],
  ["Physics", ["force", "energy", "velocity", "momentum", "mass", "acceleration", "gravity", "wave", "electric", "magnetic", "newton", "quantum"]],
  ["History", ["war", "empire", "revolution", "century", "treaty", "president", "king", "colonial", "civilization", "dynasty", "independence"]],
  ["English", ["essay", "thesis", "novel", "poem", "author", "character", "theme", "metaphor", "narrative", "rhetoric", "paragraph", "literature"]],
  ["Computer Science", ["algorithm", "code", "loop", "array", "list", "function", "variable", "search", "sort", "program", "binary", "recursion", "data structure", "compiler"]],
  ["Economics", ["market", "supply", "demand", "price", "inflation", "economy", "gdp", "cost", "trade", "monetary", "fiscal"]],
  ["Psychology", ["behavior", "cognitive", "memory", "emotion", "brain", "perception", "conditioning", "personality"]],
];

/** Guess the subject of a note from its words. Returns a subject name or null. */
export function detectSubject(text) {
  const lower = ` ${String(text).toLowerCase()} `;
  let best = null;
  for (const [subject, words] of SUBJECTS) {
    let score = 0;
    for (const w of words) {
      const hits = lower.split(new RegExp(`[^a-z]${w}s?[^a-z]`)).length - 1;
      score += hits;
    }
    if (score >= 2 && (!best || score > best.score)) best = { subject, score };
  }
  return best ? best.subject : null;
}

const TOPIC_SKIP = new Set([...STOP, "okay", "yeah", "right", "going", "gonna", "really", "thing", "things", "something", "today", "lecture", "class", "know", "think", "like", "want", "look", "let", "make", "say", "said", "time", "first", "next", "also", "well", "actually", "basically", "here", "every", "each", "one", "two", "get", "see", "use", "need", "much", "more", "most", "way", "kind", "lot", "only", "even", "still", "into", "over", "back", "then", "than", "those", "these", "been", "being", "were", "would", "could", "should", "keep", "start", "end", "little"]);

function words(text) {
  return (String(text).toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !TOPIC_SKIP.has(w));
}

function titleCase(text) {
  return text.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** A short topic for a note: its most repeated two-word phrase, or its most repeated word. */
export function detectTopic(text) {
  const list = words(text);
  const pairs = new Map();
  for (let i = 0; i < list.length - 1; i++) {
    const key = `${list[i]} ${list[i + 1]}`;
    pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  const bestPair = [...pairs].sort((a, b) => b[1] - a[1])[0];
  if (bestPair && bestPair[1] >= 2) return titleCase(bestPair[0]);
  const singles = new Map();
  for (const w of list) singles.set(w, (singles.get(w) || 0) + 1);
  const bestWord = [...singles].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  return bestWord ? titleCase(bestWord[0]) : "Untitled";
}

const PRONOUN = /^(it|this|that|these|those|there|here|he|she|they|we|you|i|which|what|who|so|and|but|then|now|well|esto|eso|esta|este|ese|esa|él|ella|ellos|ellas|nosotros|ustedes|usted|que|qué|y|pero|entonces|bueno|hoy|aquí|ahí)(?![\p{L}])/iu;

/** Find definition sentences: "X is a Y", "X means Y", "X refers to Y", and in Spanish "X es un Y", "X significa Y". */
export function findDefinitions(text) {
  const out = [];
  const seen = new Set();
  for (const s of sentences(text)) {
    const clean = s.replace(/^(so|and|okay|now|remember|basically|entonces|bueno|recuerden|recuerda|o sea|básicamente),?\s+/i, "");
    const m =
      clean.match(/^(.{2,48}?)\s+(?:is|are)\s+((?:a|an|the|when|how|what)\b.{8,})$/i) ||
      clean.match(/^(.{2,48}?)\s+(?:means|refers to|is defined as|is called)\s+(.{8,})$/i) ||
      clean.match(/^(.{2,48}?)\s+(?:es|son)\s+((?:un|una|unos|unas|el|la|los|las|cuando|como|lo que)(?![\p{L}]).{8,})$/iu) ||
      clean.match(/^(.{2,48}?)\s+(?:significa|significan|se refiere a|se define como|quiere decir|se llama)\s+(.{8,})$/iu);
    if (!m) continue;
    const term = m[1].replace(/^(the|a|an|el|la|los|las|un|una)\s+/i, "").trim();
    const definition = m[2].replace(/[.!?]+$/, "").trim();
    if (PRONOUN.test(term) || term.split(/\s+/).length > 5 || /\d{3,}/.test(term)) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ term: term.charAt(0).toUpperCase() + term.slice(1), definition, sentence: s });
  }
  return out;
}

/**
 * Make quiz questions from notes ({ title, text }).
 * Definitions give two-way questions; other key sentences give fill-in-the-blank questions.
 */
export function makeQuiz(notes, { count = 10 } = {}) {
  const questions = [];
  for (const note of notes) {
    for (const d of findDefinitions(note.text)) {
      questions.push({ kind: "term", prompt: d.definition, answer: d.term, source: note.title });
      questions.push({ kind: "define", prompt: d.term, answer: d.definition, source: note.title });
    }
  }
  if (questions.length < count) {
    for (const note of notes) {
      const topicWords = new Set(tokens(note.topic || detectTopic(note.text)));
      for (const s of sentences(note.text)) {
        if (s.length < 40 || s.length > 220) continue;
        const parts = s.split(/(\s+)/);
        const idx = parts.findIndex((p) => p.trim() && topicWords.has(tokens(p)[0]));
        if (idx < 0) continue;
        const answer = parts[idx].replace(/[^\w'-]/g, "");
        parts[idx] = parts[idx].replace(answer, "_____");
        questions.push({ kind: "blank", prompt: parts.join(""), answer, source: note.title });
        if (questions.length >= count * 2) break;
      }
    }
  }
  // Interleave kinds so a quiz doesn't start with ten of the same type.
  const byKind = ["term", "define", "blank"].map((k) => questions.filter((q) => q.kind === k));
  const mixed = [];
  while (mixed.length < count && byKind.some((l) => l.length)) for (const l of byKind) if (l.length && mixed.length < count) mixed.push(l.shift());
  return mixed;
}

function norm(text) {
  return tokens(text).join(" ");
}

/** Is a typed or spoken answer close enough? Exact for short answers, word overlap for long ones. */
export function checkAnswer(given, expected) {
  const a = norm(given);
  const b = norm(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const want = b.split(" ");
  if (want.length <= 3) {
    // Allow one small typo per short answer.
    return distance(a, b) <= Math.max(1, Math.floor(b.length / 6));
  }
  const have = new Set(a.split(" "));
  const hit = want.filter((w) => have.has(w)).length;
  return hit / want.length >= 0.6;
}

function distance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

const clean = (s) => String(s).replace(/[\t\n\r]+/g, " ").trim();

/** Export questions for other study sites. Formats: anki, quizlet, csv, gift (Moodle), text. */
export function exportQuiz(questions, format) {
  switch (format) {
    case "anki":
    case "quizlet":
      return questions.map((q) => `${clean(q.prompt)}\t${clean(q.answer)}`).join("\n");
    case "csv":
      return ["question,answer", ...questions.map((q) => `"${clean(q.prompt).replace(/"/g, '""')}","${clean(q.answer).replace(/"/g, '""')}"`)].join("\n");
    case "gift":
      return questions.map((q, i) => `::Q${i + 1}:: ${clean(q.prompt).replace(/([~=#{}:])/g, "\\$1")} {=${clean(q.answer).replace(/([~=#{}:])/g, "\\$1")}}`).join("\n\n");
    default:
      return questions.map((q, i) => `${i + 1}. ${clean(q.prompt)}\n   Answer: ${clean(q.answer)}`).join("\n\n");
  }
}
