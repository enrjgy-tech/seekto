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
  // Nothing repeats: a name of two or more words said mid-sentence ("the French Revolution")
  const named = String(text).match(/(?<=[a-z,;]\s+(?:the\s+)?)(?:[A-Z][a-z]+\s+){1,3}[A-Z][a-z]+/);
  if (named) return named[0];
  const singles = new Map();
  for (const w of list) singles.set(w, (singles.get(w) || 0) + 1);
  const bestWord = [...singles].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  return bestWord ? titleCase(bestWord[0]) : "Untitled";
}

const PRONOUN = /^(no|yes|sí|si|não|sim|it|it's|this|that|that's|these|those|there|here|he|she|they|we|you|i|which|what|who|so|and|but|then|now|well|if|when|because|my|your|our|his|her|their|its|esto|eso|esta|este|ese|esa|él|ella|ellos|ellas|nosotros|ustedes|usted|que|qué|y|pero|entonces|bueno|hoy|aquí|ahí|mi|tu|su|nuestro|isso|isto|esse|essa|ele|eles|elas|nós|você|vocês|meu|minha|seu|sua|nosso|nossa|aqui|hoje|mas|então)(?![\p{L}'])/iu;
// Nouns that start sentences like definitions but aren't terms: "the answer is twelve"
const NOT_TERM = /^(?:answer|point|thing|things|problem|idea|question|part|reason|key|goal|plan|rule|trick|difference|main|important|hard|easy|first|second|last|next|best|worst|only|whole|same|other|class|lecture|chapter|section|unit|grade|grades|deadline|due date|homework|reading|test|quiz|exam|essay|paper|project|lab|final|midterm|syllabus|room|book|textbook|slide|slides|example|whole thing|short version|bottom line|catch|deal|story|goal|focus|topic|plan|schedule|today|tomorrow|tonight|week|weekend|semester|year|day|morning|afternoon|everyone|everybody|somebody|someone|nobody|people|guys|kids|class|teacher|professor|respuesta|pregunta|problema|idea|clase|tema|examen|prueba|tarea|trabajo|prova|aula|resposta|pergunta|matéria|semana|hoje|amanhã|mañana)$/iu;
const EVENTISH = /(?<![\p{L}])(?:p[1-4]|av[1-4]|quiz|test|exam|midterm|final|essay|homework|assignment|deadline|due|lab report|examen|prueba|parcial|tarea|entrega|prova|teste|trabalho|seminário|relatório)(?![\p{L}])/iu;
const NUMBERISH = /^(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a hundred|half|uno|dos|tres|um|dois|três)\b/i;
const BAD_DEFINITION = /^(?:that(?!\s+\p{L}+\s+(?:where|when|which|that|in which|you))|because|why|not|so|going|gonna|due|on|in|at|for|really|very|pretty|too|hard|easy|tough|fine|okay|ok|important|tricky|done|over|here|there|next|coming|up|out|back|cancelled|canceled|the part (?:everyone|people|you|that everyone|where you)|the one|the hard|the easy|the best|the worst|the same|the answer is|the reason (?:is|why)|the problem is|the point is|the thing is|the key is|the main thing|the last|the first|the next|the deadline|the due date|a big|a lot|a good|a bad|a great|a hard|a tough|a pain|a problem|a bit|a little|my|your|our|his|her|their|yours|mine|worth|about|like|also|still|always|never|probably|definitely|el (?:próximo|lunes|martes|miércoles|jueves|viernes)|muy|importante|para|na|no|pra|o mais|a mais|isso|difícil|fácil|high|low|everywhere|something(?!\s+(?:that|which|created|made|used))|anything|well|awesome|amazing|fun|nice|cool|lovely|fantastic|brilliant|terrible|incredible|chapter|unit|page|section|one of the|part of|higher|lower|bigger|smaller|harder|easier|worse|better|more|less|great|huge|super|insane|wild|crazy|key|crucial|central|tested|on the test|in the|at the)\b/iu;
const LEAD = /^(?:so|and|okay|ok|now|remember|basically|right|alright|all right|well|um|uh|hm+|oh|ah|eh|hã|ahn|then|also|anyway|look|listen|guys|everyone|everybody|okay everyone|entonces|bueno|recuerden|recuerda|o sea|básicamente|pues|a ver|ojo|oigan|mira|miren|chicos|chicas|muchachos|chavos|ahorita|vale|então|gente|pessoal|galera|tipo|bom|olha|lembrem|lembra|tá|beleza)[,]?\s+/iu;
const FILLER = /,?\s*(?<![\p{L}])(?:um|uh|like|basically|you know|right|o sea|eh|hã|ahn|este|tipo|gente|pessoal|né|tá|¿sí\?|¿vale\?|¿no\?|a ver|in simple terms|simply put|put simply|in short|essentially|roughly|informally|técnicamente|digamos|para que quede claro|pra quem não lembra|pra ficar claro|for the record|if you remember)(?![\p{L}])\s*,/giu;

function cleanSentence(s) {
  let c = s.trim();
  for (let i = 0; i < 4 && LEAD.test(c); i++) c = c.replace(LEAD, "");
  return c.replace(FILLER, ",").replace(/,\s*,/g, ",").replace(/,\s*(is|are|was|were|es|son|é|são)\s/i, " $1 ").replace(/\s(is|are|es|son|é|são),\s/i, " $1 ").replace(/\s+/g, " ").trim();
}

function goodTerm(term) {
  const t = (/^a (?:priori|posteriori|fortiori)$/i.test(term.trim()) ? term : term.replace(/^(the|a|an|el|la|los|las|un|una|o|os|as)\s+/i, "")).replace(/[,:;]+$/, "").trim();
  if (t.length < 2 || t.length > 48 || t.includes(",")) return null;
  if (PRONOUN.test(t) || NOT_TERM.test(t) || EVENTISH.test(t) || NUMBERISH.test(t)) return null;
  // "Others say it", "Some people think": a clause, not a term
  if (/(?<![\p{L}])(?:it|they|we|you|i|he|she|say|says|said|think|thinks|argue|argues|believe|believes)(?![\p{L}'])/iu.test(t) && t.split(/\s+/).length > 1) return null;
  if (t.split(/\s+/).length > 5 || /\d{3,}/.test(t) || findDates(t).length || /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miércoles|jueves|viernes|segunda|terça|quarta|quinta|sexta)\b/i.test(t)) return null;
  return t;
}

function goodDefinition(def) {
  const d = def.replace(/\s*(?:,\s*)?(?:right|okay|ok|¿sí|¿vale|¿no|né|tá|sabe|ok)\?*\s*$/i, "").replace(/[.!?]+$/, "").trim();
  if (d.split(/\s+/).length < 3 || BAD_DEFINITION.test(d) || NUMBERISH.test(d) && d.split(/\s+/).length < 4) return null;
  // "The exhibition is next week, ...", "Picture day is Thursday, so dress nice": a date, not a meaning
  if (findDates(d).some((x) => x.index === 0)) return null;
  if (findDates(d).length && EVENTISH.test(d)) {
    // "Sepsis is the body's response ..., and you'll need it for the quiz on Thursday": keep the part before
    const parts = d.split(/,\s+/);
    while (parts.length > 1 && (findDates(parts.at(-1)).length || EVENTISH.test(parts.at(-1)))) parts.pop();
    const kept = parts.join(", ");
    if (kept === d || kept.split(/\s+/).length < 4 || (findDates(kept).length && EVENTISH.test(kept))) return null;
    return kept;
  }
  return d;
}

const VERBS = "compares|speeds|slows|lowers|raises|converts|turns|breaks|stores|carries|controls|produces|makes|allows|lets|shows|measures|describes|tells|represents|transports|holds|binds|blocks|takes|gives|uses|calls|returns|moves|keeps|protects|regulates|connects|separates|absorbs|releases|creates|changes|reduces|increases|predicts|explains";

/** Pull one definition out of a cleaned sentence: [term, definition] or null. */
function matchDefinition(c, next) {
  let m;
  // "ROI, return on investment, is ..."
  if ((m = c.match(/^([A-Z][A-Za-z]{1,6}),\s*([^,]{4,60}?),?\s+(?:is|are|means|es|é)\s+(.{6,})$/))) return [m[1], `${m[2]}: ${m[3]}`, true];
  // "Osmosis, and people mix this up..., osmosis is specifically ..."
  if ((m = c.match(/^([^,]{2,40}),\s.*?,\s*([^,]{2,40}?)\s+(?:is|are|es|é)\s+(?:specifically|basically|just|simply|really)?\s*(.{6,})$/i)) && m[1].toLowerCase().replace(/^(the|a|an)\s+/, "") === m[2].toLowerCase().replace(/^(the|a|an)\s+/, "")) return [m[1], m[3]];
  // "X, X is ...": "a ratio, a ratio is just a comparison ..."
  if ((m = c.match(/^([^,]{2,40}),\s*(.{2,40}?)\s+(?:is|are|es|é)\s+(?:basically|just|simply|really)?\s*(.{6,})$/iu)) && m[1].toLowerCase().replace(/^(the|a|an|el|la|un|una|o|a|um|uma)\s+/, "") === m[2].toLowerCase().replace(/^(the|a|an|el|la|un|una|o|a|um|uma)\s+/, "")) return [m[1], m[3]];
  // A short aside between the term and "is": "Recursion, and everyone groans here, is just a function ..."
  if ((m = c.match(/^([^,]{2,40}),\s*((?:and|in|at|as|if|or|which|anyway|y|o|e|como|por|pra|para|en|em|no|na)\s[^,]{2,40}?),?\s+(?:is|are|es|son|é|são)\s+(?:basically|just|simply|really|básicamente|basicamente)?\s*(.{6,})$/iu)) && m[2].split(/\s+/).length <= 6) return [m[1], m[3]];
  // "afterload, think of it as the resistance ..."
  if ((m = c.match(/^([^,]{2,40}),\s*(?:think of it as|think of (?:this|that) as|picture it as|piensen en (?:él|ella|eso) como|pensem nisso como)\s+(.{6,})$/iu))) return [m[1], m[2]];
  // "... we start with elasticity, which is how much ...": the term comes right before ", which is"
  if ((m = c.match(/(?:^|\s)(?:with|on|about|con|sobre|com|de)\s+([\p{L}][\p{L} -]{1,30}?),\s*(?:which is|que es|que é|o que é)\s+(.{6,})$/iu))) return [m[1], m[2]];
  // "Feudalism, the short version is ...", "the Columbian Exchange, that's the transfer of ..."
  if ((m = c.match(/^([^,]{2,40}),\s*(?:that's|that is|it's|it is|the short version is|which is|es|é|eso es|isso é|o que é|que es|que é|es decir)\s+(.{6,})$/i))) return [m[1], m[2]];
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
    const mean = c.match(/^what do (?:i|we) mean by\s+(?:an?\s+(?!priori|posteriori|fortiori)|the\s+)?(.{2,40}?)\?$/i) || c.match(/^¿?qu[ée] (?:quiero decir|queremos decir|significa)\s+(?:con\s+)?(.{2,40}?)\?$/iu) || c.match(/^o que (?:eu )?quero dizer com\s+(.{2,40}?)\?$/iu);
    if (mean && next && next.split(/\s+/).length >= 4) { push(mean[1], next.replace(/^(?:it's|it is|that's|es|é)\s+/i, ""), `${s} ${list[i + 1]}`); i++; continue; }
    const q = c.match(/^what(?:'s| is| are)\s+(?:an?\s+|the\s+)?(.{2,40}?)\?$/i) || c.match(/^qu[ée]\s+es\s+(?:un|una|el|la)?\s*(.{2,40}?)\?$/i) || c.match(/^o que (?:é|são)\s+(?:um|uma|o|a)?\s*(.{2,40}?)\?$/i);
    const frag = !q && c.match(/^([\p{L}][\p{L}' -]{1,40})[.:]$/u);
    const answer = next && next.match(/^(?:it's|it is|that's|that is|they're|they are|this is|es|son|é|são|isso é|eso es)\s+(?:basically\s+|básicamente\s+|basicamente\s+)?(.{6,})$/i);
    if ((q || (frag && frag[1].split(/\s+/).length <= 4)) && answer) { push((q || frag)[1], answer[1], `${s} ${list[i + 1]}`); i++; continue; }
    const m = matchDefinition(c, next);
    if (m) push(m[0], m[1], s, m[2]);
  }
  return out;
}

// Nouns anyone could guess from the sentence around them.
const COMMON_NOUNS = new Set("people person historians scientists researchers experts scholars critics students teachers children others someone everyone anyone things thing example examples reason reasons way ways year years time times question questions problem problems answer answers result results number numbers part parts group groups country countries place places world idea ideas kind kinds type types lot lots side sides point points case cases fact facts process system systems change changes level levels area areas form forms work works life lives person's".split(" "));

// Words that make poor fill-in-the-blank answers: classroom talk, not course content.
const BLANK_SKIP = new Set("chapter chapters today tomorrow everyone class lesson lecture week weeks review quiz test exam homework page pages section unit tema clase examen semana hoy".split(" "));

/** A small seeded random number generator, so a quiz can be shuffled the same way twice. */
function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Shuffle a copy of a list. Pass a seed for the same order every time. */
export function shuffle(list, seed = Date.now()) {
  const rand = seeded(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/**
 * Make quiz questions from notes ({ title, text }).
 * Each definition gives one question, alternating "which term means..." and "what does X mean?"
 * (flip: true swaps them, for a second round). Key sentences give fill-in-the-blank questions, so a
 * lesson with few explained terms still makes a real test. Where there are enough other answers to
 * choose from, "what does X mean?" and blanks are multiple choice (`choices`, which include the answer).
 * Questions are shuffled; pass a seed to get the same order again.
 */
export function makeQuiz(notes, { count = 10, flip = false, seed = Date.now() } = {}) {
  const defs = [];
  const usedTerms = new Set();
  const found = notes.map((note) => findDefinitions(note.text));
  notes.forEach((note, n) => {
    found[n].forEach((d, i) => {
      usedTerms.add(d.term.toLowerCase());
      const asTerm = (i % 2 === 0) !== flip;
      defs.push(asTerm ? { kind: "term", prompt: d.definition, answer: d.term, source: note.title } : { kind: "define", prompt: d.term, answer: d.definition, source: note.title });
    });
  });
  const allDefs = found.flat();
  const blanks = keySentenceBlanks(notes, found, usedTerms, Math.max(count - defs.length, 3), seed);
  // Multiple choice needs three wrong options that look like the right one: the same kind of
  // answer (definitions with definitions, terms with terms), plural with plural, and capitalised
  // only if the answer is, so the form of an option never gives it away.
  let k = 0;
  const text = notes.map((n) => n.text).join(" ");
  const shown = (w) => {
    const proper = new RegExp(`[^.!?]\\s${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}(?![\\p{L}])`, "u").test(text);
    const lower = new RegExp(`(?<![\\p{L}])${w.toLowerCase()}(?![\\p{L}])`, "u").test(text);
    return proper && !lower ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase();
  };
  const stem = (w) => w.toLowerCase().replace(/e?s$/, "").replace(/e$/, "");
  const plural = (w) => /s$/i.test(w.trim().split(/\s+/).pop()) && !/(?:ss|us|is|ys)$/i.test(w.trim().split(/\s+/).pop());
  const capital = (w) => /^\p{Lu}/u.test(w);
  const verbish = (w) => /(?:ed|ing)$/i.test(w);
  const pick = (answer, pool, sameShape) => {
    const shaped = sameShape ? pool.filter((w) => plural(w) === plural(answer) && capital(w) === capital(answer) && verbish(w) === verbish(answer)) : pool;
    const alike = shaped.filter((w, i) => stem(w) !== stem(answer) && shaped.findIndex((x) => stem(x) === stem(w)) === i);
    return alike.length >= 3 ? shuffle([answer, ...shuffle(alike, seed + ++k).slice(0, 3)], seed + ++k) : undefined;
  };
  const terms = allDefs.map((d) => d.term);
  let asTerm = 0;
  for (const q of defs) {
    if (q.kind === "define") q.choices = pick(q.answer, allDefs.map((d) => d.definition), false);
    // Every other "which term means…" is multiple choice; the rest are typed, which helps recall
    else if (asTerm++ % 2 === 0) q.choices = pick(q.answer, terms, true);
  }
  const words = [...new Set([...blanks.map((b) => b.answer), ...terms.filter((t) => !/\s/.test(t))].map(shown))];
  for (const q of blanks) {
    q.answer = shown(q.answer);
    q.choices = pick(q.answer, words.filter((w) => !q.prompt.toLowerCase().includes(w.toLowerCase())), true);
  }
  for (const q of [...defs, ...blanks]) if (!q.choices) delete q.choices;
  // Definitions first in priority, then blanks; shuffle what's kept so the order isn't predictable,
  // but open on a multiple-choice question when there is one (an easy first tap on a phone).
  const picked = shuffle([...shuffle(defs, seed), ...shuffle(blanks, seed + 1)].slice(0, count), seed + 2);
  const first = picked.findIndex((q) => q.choices);
  if (first > 0) picked.unshift(...picked.splice(first, 1));
  return picked;
}

// Sentences about class logistics ("the quiz is on Friday") make poor questions.
const LOGISTICS = /(?<![\p{L}])(?:due|quiz|test|exam|homework|deadline|syllabus|office hours|examen|tarea|entrega|prova|trabalho|lição de casa)(?![\p{L}])/iu;
const SMALL_TALK = /^(?:okay|ok|so|alright|right|hi|hello|good morning|bueno|hola|então|gente|pessoal|thanks|thank you)\b/i;

/** Fill-in-the-blank questions from a lesson's key sentences: blank a defined term, a topic word,
 * or failing those the sentence's most telling word (a long word the lesson repeats). */
function keySentenceBlanks(notes, found, usedTerms, want, seed) {
  const out = [];
  notes.forEach((note, n) => {
    const topicWords = new Set(tokens(note.topic || detectTopic(note.text)));
    const definitionSentences = new Set(found[n].map((d) => d.sentence));
    const counts = new Map();
    for (const w of String(note.text).toLowerCase().match(/[\p{L}][\p{L}'-]{4,}/gu) || []) counts.set(w, (counts.get(w) || 0) + 1);
    const candidates = [];
    for (const s of sentences(note.text)) {
      if (s.length < 30 || s.length > 220 || definitionSentences.has(s) || SMALL_TALK.test(s) || /\?$/.test(s)) continue;
      if (LOGISTICS.test(s) || findDates(s).length) continue;
      const parts = s.split(/(\s+)/);
      const word = (p) => p.trim().replace(/[^\p{L}'-]/gu, "").toLowerCase();
      // Not a word anyone could guess from the sentence: no stock nouns ("historians", "people") and
      // nothing right after a quantifier ("a lot of _____")
      const content = (p, i) => i > 0 && word(p).length >= 4 && !BLANK_SKIP.has(word(p)) && !STOP.has(word(p)) && !COMMON_NOUNS.has(word(p)) && !/^(?:many|some|most|few|several|all|other|these|those)$/i.test(word(parts[i - 2] || "")) && !/^(?:lot|lots|bunch|number|couple) of$/i.test(`${word(parts[i - 4] || "")} ${word(parts[i - 2] || "")}`);
      const termStems = new Set([...usedTerms].map((w) => w.replace(/e?s$/, "").replace(/e$/, "")));
      let idx = parts.findIndex((p, i) => i > 0 && (usedTerms.has(word(p)) || termStems.has(word(p).replace(/e?s$/, "").replace(/e$/, ""))));
      let strength = 3;
      if (idx < 0) { idx = parts.findIndex((p, i) => content(p, i) && topicWords.has(tokens(p)[0])); strength = 2; }
      if (idx < 0) {
        // The most telling word: repeated in the lesson and long, not the first word of the sentence
        let best = -1;
        let score = 0;
        parts.forEach((p, i) => {
          if (!content(p, i) || word(p).length < 6) return;
          // Only a word the lesson repeats, a name, or a long technical-looking word
          const proper = /^\p{Lu}/u.test(p.trim()) && i > 0;
          if ((counts.get(word(p)) || 1) < 2 && !proper && word(p).length < 9) return;
          const sc = (counts.get(word(p)) || 1) * 2 + word(p).length / 4;
          if (sc > score) { score = sc; best = i; }
        });
        idx = best;
        strength = 1;
      }
      if (idx < 0) continue;
      const answer = parts[idx].replace(/[^\p{L}\d'-]/gu, "");
      if (answer.length < 3) continue;
      parts[idx] = parts[idx].replace(answer, "_____");
      candidates.push({ q: { kind: "blank", prompt: parts.join(""), answer, source: note.title }, strength });
    }
    // Strongest blanks first; weaker ones only fill the test up
    candidates.sort((a, b) => b.strength - a.strength);
    // One question per answer word, so the test doesn't ask for "terror" three times
    const asked = new Set();
    for (const c of candidates) {
      const key = c.q.answer.toLowerCase();
      if (asked.has(key) || !(c.strength >= 2 || out.length < want)) continue;
      asked.add(key);
      out.push(c.q);
    }
  });
  return shuffle(out, seed + 5);
}

/**
 * Spaced reviews before a test: a few short practice sessions, closer together near the day.
 * Returns ISO dates strictly after today and before the test (up to three).
 */
export function reviewPlan(testISO, todayISO) {
  const day = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const gap = day(testISO) - day(todayISO);
  if (gap < 2) return [];
  const offsets = gap >= 8 ? [7, 3, 1] : gap >= 5 ? [4, 2, 1] : gap >= 3 ? [2, 1] : [1];
  return offsets.filter((o) => o < gap).map((o) => {
    const d = new Date((day(testISO) - o) * 86400000);
    return d.toISOString().slice(0, 10);
  });
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
      return questions.map((q, i) => {
        const esc = (x) => clean(x).replace(/([~=#{}:])/g, "\\$1");
        const body = q.choices?.length ? q.choices.map((c) => `${c === q.answer ? "=" : "~"}${esc(c)}`).join(" ") : `=${esc(q.answer)}`;
        return `::Q${i + 1}:: ${esc(q.prompt)} {${body}}`;
      }).join("\n\n");
    default:
      return questions.map((q, i) => `${i + 1}. ${clean(q.prompt)}\n   Answer: ${clean(q.answer)}`).join("\n\n");
  }
}
