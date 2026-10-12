// Rank transcript lines against a question with BM25, entirely in the browser.
// Each caption line is one document, so an answer starts on the line that says it.

const STOP = new Set(
  ("a an and are as at be but by can do does for from has have how i if in is it its me my of on or so " +
    "that the then there this to was we what when where which who why will with you your about into than " +
    "they them our just very also").split(" ")
);

/** Light stemming: enough to match "sorted" with "sorting", "items" with "item". */
export function stem(word) {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function tokens(text) {
  return (String(text).toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOP.has(w)).map(stem);
}

function counts(list) {
  const map = new Map();
  for (const item of list) map.set(item, (map.get(item) || 0) + 1);
  return map;
}

/** Build a search index from cues ({ start, end, text }). */
export function buildIndex(cues) {
  const docs = cues.map((cue, i) => {
    const words = tokens(cue.text);
    const context = cues.slice(i, i + 2).map((c) => c.text).join(" ");
    return { i, start: cue.start, text: cue.text, context, tf: counts(words), length: words.length };
  });
  const df = new Map();
  for (const doc of docs) for (const word of doc.tf.keys()) df.set(word, (df.get(word) || 0) + 1);
  const avg = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, docs.length);
  return { docs, df, avg, n: docs.length };
}

/**
 * Return up to `limit` moments that answer the question, best first.
 * Moments closer than `gap` seconds to a better one are skipped.
 */
export function search(index, question, { limit = 3, gap = 20, k1 = 1.2, b = 0.75, neighbour = 0.3 } = {}) {
  if (!index || !index.n) return [];
  const terms = [...new Set(tokens(question))];
  const { docs, df, avg, n } = index;
  const own = docs.map((doc) => {
    let score = 0;
    for (const term of terms) {
      const f = doc.tf.get(term);
      if (!f) continue;
      const idf = Math.log(1 + (n - df.get(term) + 0.5) / (df.get(term) + 0.5));
      score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * doc.length) / avg));
    }
    return score;
  });
  const ranked = docs
    .map((doc, i) => ({ doc, own: own[i], score: own[i] + neighbour * ((own[i - 1] || 0) + (own[i + 1] || 0)) }))
    .filter((r) => r.own > 0)
    .sort((x, y) => y.score - x.score);
  const out = [];
  for (const r of ranked) {
    if (out.every((o) => Math.abs(o.start - r.doc.start) > gap)) {
      out.push({ start: r.doc.start, text: r.doc.text, context: r.doc.context, score: r.score, terms });
    }
    if (out.length === limit) break;
  }
  return out;
}

export { STOP };
