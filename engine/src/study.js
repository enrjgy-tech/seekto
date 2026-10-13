// Organize notes and turn them into study material, without any AI model:
// subject and topic detection, definitions, quizzes, answer checking and exports.
import { sentences, findDates } from "./dates.js";
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

const PRONOUN = /^(no|yes|sí|si|não|sim|it|it's|this|that|that's|these|those|there|here|he|she|they|we|you|i|which|what|who|so|and|but|then|now|well|if|when|because|my|your|our|his|her|their|its|esto|eso|esta|este|ese|esa|él|ella|ellos|ellas|nosotros|ustedes|usted|que|qué|y|pero|entonces|bueno|hoy|aquí|ahí|mi|tu|su|nuestro|isso|isto|esse|essa|ele|eles|elas|nós|você|vocês|meu|minha|seu|sua|nosso|nossa|aqui|hoje|mas|então)(?![\p{L}'])/iu;
// Nouns that start sentences like definitions but aren't terms: "the answer is twelve"
const NOT_TERM = /^(?:answer|point|thing|things|problem|idea|question|part|reason|key|goal|plan|rule|trick|difference|main|important|hard|easy|first|second|last|next|best|worst|only|whole|same|other|class|lecture|chapter|section|unit|grade|grades|deadline|due date|homework|reading|test|quiz|exam|essay|paper|project|lab|final|midterm|syllabus|room|book|textbook|slide|slides|example|short version|bottom line|catch|deal|story|goal|focus|topic|plan|schedule|today|tomorrow|tonight|week|weekend|semester|year|day|morning|afternoon|everyone|everybody|somebody|someone|nobody|people|guys|kids|class|teacher|professor|respuesta|pregunta|problema|idea|clase|tema|examen|prueba|tarea|trabajo|prova|aula|resposta|pergunta|matéria|semana|hoje|amanhã|mañana)$/iu;
const EVENTISH = /(?<![\p{L}])(?:quiz|test|exam|midterm|final|essay|homework|assignment|deadline|due|lab report|examen|prueba|parcial|tarea|entrega|prova|teste|trabalho|seminário|relatório)(?![\p{L}])/iu;
const NUMBERISH = /^(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a hundred|half|uno|dos|tres|um|dois|três)\b/i;
const BAD_DEFINITION = /^(?:that|because|why|not|so|going|gonna|due|on|in|at|for|really|very|pretty|too|hard|easy|tough|fine|okay|ok|important|tricky|done|over|here|there|next|coming|up|out|back|cancelled|canceled|the part|the one|the hard|the easy|the best|the worst|the same|the answer|the reason|the problem|the point|the thing|the key|the main|the last|the first|the next|the deadline|the due date|a big|a lot|a good|a bad|a great|a hard|a tough|a pain|a problem|a bit|a little|my|your|our|his|her|their|yours|mine|worth|about|like|also|still|always|never|probably|definitely|el (?:próximo|lunes|martes|miércoles|jueves|viernes)|muy|importante|para|na|no|pra|o mais|a mais|isso|difícil|fácil|high|low|everywhere|something|anything|chapter|unit|page|section|one of the|part of|higher|lower|bigger|smaller|harder|easier|worse|better|more|less|great|huge|super|insane|wild|crazy|key|crucial|central|tested|on the test|in the|at the)\b/iu;
const LEAD = /^(?:so|and|okay|ok|now|remember|basically|right|alright|all right|well|um|uh|then|also|anyway|entonces|bueno|recuerden|recuerda|o sea|básicamente|pues|então|gente|tipo|bom|olha|lembrem|lembra)[,]?\s+/i;
const FILLER = /,?\s*\b(?:um|uh|like|basically|you know|right|o sea|eh|este|tipo|gente|né|tá|in simple terms|simply put|put simply|in short|essentially|roughly|informally|técnicamente|digamos)\b\s*,/giu;

function cleanSentence(s) {
  let c = s.trim();
  for (let i = 0; i < 4 && LEAD.test(c); i++) c = c.replace(LEAD, "");
  return c.replace(FILLER, ",").replace(/,\s*,/g, ",").replace(/,\s*(is|are|was|were|es|son|é|são)\s/i, " $1 ").replace(/\s(is|are|es|son|é|são),\s/i, " $1 ").replace(/\s+/g, " ").trim();
}

function goodTerm(term) {
  const t = term.replace(/^(the|a|an|el|la|los|las|un|una|o|os|as)\s+/i, "").replace(/[,:;]+$/, "").trim();
  if (t.length < 2 || t.length > 48 || t.includes(",")) return null;
  if (PRONOUN.test(t) || NOT_TERM.test(t) || EVENTISH.test(t) || NUMBERISH.test(t)) return null;
  if (t.split(/\s+/).length > 5 || /\d{3,}/.test(t) || findDates(t).length || /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miércoles|jueves|viernes|segunda|terça|quarta|quinta|sexta)\b/i.test(t)) return null;
  return t;
}

function goodDefinition(def) {
  const d = def.replace(/\s*(?:,\s*)?(?:right|okay|ok|¿sí|¿vale|¿no|né|tá|sabe|ok)\?*\s*$/i, "").replace(/[.!?]+$/, "").trim();
  if (d.split(/\s+/).length < 3 || BAD_DEFINITION.test(d) || NUMBERISH.test(d) && d.split(/\s+/).length < 4) return null;
  if (findDates(d).length && EVENTISH.test(d)) return null;
  return d;
}

const VERBS = "speeds|slows|lowers|raises|converts|turns|breaks|stores|carries|controls|produces|makes|allows|lets|shows|measures|describes|tells|represents|transports|holds|binds|blocks|takes|gives|uses|calls|returns|moves|keeps|protects|regulates|connects|separates|absorbs|releases|creates|changes|reduces|increases|predicts|explains";

/** Pull one definition out of a cleaned sentence: [term, definition] or null. */
function matchDefinition(c, next) {
  let m;
  // "ROI, return on investment, is ..."
  if ((m = c.match(/^([A-Z][A-Za-z]{1,6}),\s*([^,]{4,60}?),?\s+(?:is|are|means|es|é)\s+(.{6,})$/))) return [m[1], `${m[2]}: ${m[3]}`, true];
  // "Osmosis, and people mix this up..., osmosis is specifically ..."
  if ((m = c.match(/^([^,]{2,40}),\s.*?,\s*([^,]{2,40}?)\s+(?:is|are|es|é)\s+(?:specifically|basically|just|simply|really)?\s*(.{6,})$/i)) && m[1].toLowerCase().replace(/^(the|a|an)\s+/, "") === m[2].toLowerCase().replace(/^(the|a|an)\s+/, "")) return [m[1], m[3]];
  // "Feudalism, the short version is ...", "the Columbian Exchange, that's the transfer of ..."
  if ((m = c.match(/^([^,]{2,40}),\s*(?:that's|that is|it's|it is|the short version is|which is|es|é|eso es|isso é|o que é|es decir)\s+(.{6,})$/i))) return [m[1], m[2]];
  // "Se llama inflación al aumento ...", "Chamamos de X o/a ..."
  if ((m = c.match(/^se llama\s+(.{2,40}?)\s+(?:al|a la|a los|a las|a)\s+(.{6,})$/i))) return [m[1], m[2]];
  if ((m = c.match(/^(?:chamamos(?: de)?|a gente chama(?: de)?)\s+(.{2,40}?)\s+(?:o|a|os|as)\s+(.{6,})$/i))) return [m[1], m[2]];
  // "We say a function is continuous if ..."
  if ((m = c.match(/^we say (?:that )?(?:a|an)\s+([a-z]+)\s+is\s+([a-z]+)\s+(if|when)\s+(.{6,})$/i))) return [`${m[2]} ${m[1]}`, `a ${m[1]} is ${m[2]} ${m[3]} ${m[4]}`];
  // "We call this opportunity cost" / "this is called X" / "known as X": the definition is next door
  if ((m = c.match(/^(?:we call (?:this|that|it)|(?:this|that|it)(?: is|'s) called|(?:this|that) is known as|lo llamamos|esto se llama|isso se chama|a gente chama isso de)\s+(.{2,40}?)[,.!?]*(?:\s*right\?*)?$/i)) && next) return [m[1], next];
  // "X is/are/was ...", "X means/refers to/stands for ..."
  if ((m = c.match(/^(.{2,48}?)\s+(?:means|refers to|is defined as|stands for|is called|significa|significan|se refiere a|se define como|quiere decir|quer dizer|se refere a|é definid[oa] como)\s+(.{6,})$/i))) return [m[1], m[2]];
  if ((m = c.match(/^(.{2,48}?)\s+(tells (?:you|us)|lets (?:you|us)|allows (?:you|us) to|describes|measures)\s+(.{6,})$/i))) return [m[1], `${m[2]} ${m[3]}`];
  if ((m = c.match(/^(.{2,48}?)\s+(?:is|are|was|were|es|son|era|fue|é|são|foi|era)\s+(?:basically|just|simply|really|specifically|essentially|actually|kind of|sort of|básicamente|simplemente|basicamente|simplesmente)?\s*(.{6,})$/iu))) return [m[1], m[2]];
  // "A catalyst speeds up a reaction ..."
  if ((m = c.match(new RegExp(`^(?:a|an)\\s+([a-z][\\w -]{2,30}?)\\s+((?:${VERBS})\\s+.{6,})$`, "i")))) return [m[1], m[2]];
  return null;
}

/** Find definitions in notes or a transcript: [{ term, definition, sentence }]. Works on how people talk,
 * not only on "X is a Y": "so mitosis, basically, it's when ...", "we call this opportunity cost", "what is an API? It's ...".
 */
export function findDefinitions(text) {
  const out = [];
  const seen = new Set();
  const list = sentences(text);
  const push = (term, def, sentence, keepCase) => {
    const t = goodTerm(term);
    const d = t && goodDefinition(def);
    if (!t || !d) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ term: keepCase || /^[A-Z]{2,}/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1), definition: d, sentence });
  };
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const c = cleanSentence(s);
    const next = list[i + 1] && cleanSentence(list[i + 1]);
    // "What is an API? It's a contract ..." and "Okay, classical conditioning. That's learning by association."
    const q = c.match(/^what(?:'s| is| are)\s+(?:an?\s+|the\s+)?(.{2,40}?)\?$/i) || c.match(/^qu[ée]\s+es\s+(?:un|una|el|la)?\s*(.{2,40}?)\?$/i) || c.match(/^o que (?:é|são)\s+(?:um|uma|o|a)?\s*(.{2,40}?)\?$/i);
    const frag = !q && c.match(/^([\p{L}][\p{L}' -]{1,40})[.:]$/u);
    const answer = next && next.match(/^(?:it's|it is|that's|that is|they're|they are|this is|es|son|é|são|isso é|eso es)\s+(?:basically\s+|básicamente\s+|basicamente\s+)?(.{6,})$/i);
    if ((q || (frag && frag[1].split(/\s+/).length <= 4)) && answer) { push((q || frag)[1], answer[1], `${s} ${list[i + 1]}`); i++; continue; }
    const m = matchDefinition(c, next);
    if (m) push(m[0], m[1], s, m[2]);
  }
  return out;
}

// Words that make poor fill-in-the-blank answers: classroom talk, not course content.
const BLANK_SKIP = new Set("chapter chapters today tomorrow everyone class lesson lecture week weeks review quiz test exam homework page pages section unit tema clase examen semana hoy".split(" "));

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
        if (/^(okay|ok|so|alright|right|hi|hello|good morning|bueno|hola)\b/i.test(s) || /\?$/.test(s)) continue;
        // Class logistics ("the quiz is on Friday") make poor questions.
        if (/\b(due|quiz|test|exam|homework|deadline|examen|tarea|entrega)\b/i.test(s) || findDates(s).length) continue;
        const idx = parts.findIndex((p) => {
          const w = p.trim().replace(/[^\p{L}'-]/gu, "").toLowerCase();
          return w.length >= 4 && !BLANK_SKIP.has(w) && topicWords.has(tokens(p)[0]);
        });
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
