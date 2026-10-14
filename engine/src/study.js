// Organize notes and turn them into study material, without any AI model:
// subject and topic detection, definitions, quizzes, answer checking and exports.
import { COMMON_WORDS } from "./common-words.js";
import { sentences, findDates } from "./dates.js";
import { tokens, STOP } from "./search.js";

const SUBJECTS = [
  [
    "Math",
    [
      "equation",
      "derivative",
      "integral",
      "algebra",
      "calculus",
      "theorem",
      "polynomial",
      "function",
      "graph",
      "matrix",
      "probability",
      "geometry",
      "fraction",
      "variable",
      "proof",
      "limit",
      "slope",
    ],
  ],
  [
    "Biology",
    [
      "cell",
      "protein",
      "dna",
      "gene",
      "organism",
      "evolution",
      "enzyme",
      "membrane",
      "photosynthesis",
      "species",
      "mitochondria",
      "ecosystem",
    ],
  ],
  [
    "Chemistry",
    [
      "molecule",
      "atom",
      "reaction",
      "electron",
      "bond",
      "acid",
      "base",
      "compound",
      "element",
      "mole",
      "ion",
      "solution",
      "periodic",
    ],
  ],
  [
    "Physics",
    [
      "force",
      "energy",
      "velocity",
      "momentum",
      "mass",
      "acceleration",
      "gravity",
      "wave",
      "electric",
      "magnetic",
      "newton",
      "quantum",
    ],
  ],
  [
    "History",
    [
      "war",
      "empire",
      "revolution",
      "century",
      "treaty",
      "president",
      "king",
      "colonial",
      "civilization",
      "dynasty",
      "independence",
    ],
  ],
  [
    "English",
    [
      "essay",
      "thesis",
      "novel",
      "poem",
      "author",
      "character",
      "theme",
      "metaphor",
      "narrative",
      "rhetoric",
      "paragraph",
      "literature",
    ],
  ],
  [
    "Computer Science",
    [
      "algorithm",
      "code",
      "loop",
      "array",
      "list",
      "function",
      "variable",
      "search",
      "sort",
      "program",
      "binary",
      "recursion",
      "data structure",
      "compiler",
    ],
  ],
  [
    "Economics",
    ["market", "supply", "demand", "price", "inflation", "economy", "gdp", "cost", "trade", "monetary", "fiscal"],
  ],
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

const TOPIC_SKIP = new Set([
  ...STOP,
  "okay",
  "yeah",
  "right",
  "going",
  "gonna",
  "really",
  "thing",
  "things",
  "something",
  "today",
  "lecture",
  "class",
  "know",
  "think",
  "like",
  "want",
  "look",
  "let",
  "make",
  "say",
  "said",
  "time",
  "first",
  "next",
  "also",
  "well",
  "actually",
  "basically",
  "here",
  "every",
  "each",
  "one",
  "two",
  "get",
  "see",
  "use",
  "need",
  "much",
  "more",
  "most",
  "way",
  "kind",
  "lot",
  "only",
  "even",
  "still",
  "into",
  "over",
  "back",
  "then",
  "than",
  "those",
  "these",
  "been",
  "being",
  "were",
  "would",
  "could",
  "should",
  "keep",
  "start",
  "end",
  "little",
]);

function words(text) {
  return (
    String(text)
      .toLowerCase()
      .match(/[a-z][a-z'-]{2,}/g) || []
  ).filter((w) => !TOPIC_SKIP.has(w));
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

const PRONOUN =
  /^(no|yes|sí|si|não|sim|it|it's|this|that|that's|these|those|there|here|he|she|they|we|you|i|which|what|who|so|and|but|then|now|well|if|when|because|my|your|our|his|her|their|its|esto|eso|esta|este|ese|esa|él|ella|ellos|ellas|nosotros|ustedes|usted|que|qué|y|pero|entonces|bueno|hoy|aquí|ahí|mi|tu|su|nuestro|isso|isto|esse|essa|ele|eles|elas|nós|você|vocês|meu|minha|seu|sua|nosso|nossa|aqui|hoje|mas|então)(?![\p{L}'])/iu;
// Nouns that start sentences like definitions but aren't terms: "the answer is twelve"
const NOT_TERM =
  /^(?:answer|point|thing|things|problem|idea|question|part|reason|key|goal|plan|rule|trick|difference|main|important|hard|easy|first|second|last|next|best|worst|only|whole|same|other|class|lecture|chapter|section|unit|grade|grades|deadline|due date|homework|reading|test|quiz|exam|essay|paper|project|lab|final|midterm|syllabus|room|book|textbook|slide|slides|example|whole thing|short version|bottom line|catch|deal|story|goal|focus|topic|plan|schedule|today|tomorrow|tonight|week|weekend|semester|year|day|morning|afternoon|everyone|everybody|somebody|someone|nobody|people|guys|kids|class|teacher|professor|actually|therefore|thus|hence|however|yeah|yes|obviously|certainly|clearly|honestly|generally|typically|anyway|again|ok|okay|alright|or|and|why|how|what|when|where|who|which|even|since|though|not|so|well|now|then|here|there|right|message|insight|content|course|lesson|takeaway|upshot|respuesta|pregunta|problema|idea|clase|tema|examen|prueba|tarea|trabajo|prova|aula|resposta|pergunta|matéria|semana|hoje|amanhã|mañana)$/iu;
const EVENTISH =
  /(?<![\p{L}])(?:p[1-4]|av[1-4]|quiz|test|exam|midterm|final|essay|homework|assignment|deadline|due|lab report|examen|prueba|parcial|tarea|entrega|prova|teste|trabalho|seminário|relatório)(?![\p{L}])/iu;
const NUMBERISH =
  /^(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|a hundred|half|uno|dos|tres|um|dois|três)\b(?!-)/i;
// A term is a noun phrase. These aren't: a phrase that opens with a preposition or linking word
// ("On the x-axis", "Rather than a capitalist economy"), a comparative ("Higher price"), a vague
// subject ("Many of these people"), or a slide description ("Blue downward sloping line").
const TERM_NOT_NP = new RegExp(
  [
    "^(?:even|since|though|although|not|until|unless|because|after|before|during|as|whenever|however|on|in|at|by|for|with|from|to|of|into|over|under|about|than|rather|many|some|most|several|few|each|every|both|either|any|other|another|where|when|while|what|which|who|how|why|if|that|those|these|therefore|thus|hence|however|actually|yeah|yes|but|higher|lower|bigger|smaller|more|less|better|worse|greater|fewer|people|everyone|everybody|nobody|somebody|someone|students|kids|guys|pretty|very|really|quite|too)(?:\\s|'s\\b)",
    "^(?:everybody|everyone|someone|somebody|nobody|anybody|one)'s\\b",
    "^(?:first|second|third|fourth|fifth|last|next|final)\\s+and\\b",
    "^(?:first|second|third|fourth|fifth|last|next|final)\\s+(?:problem|question|point|reason|issue|step|thing|part|extreme|one)$",
    "^(?:blue|red|yellow|green|orange|purple|black|dotted|dashed|solid)\\b.*\\b(?:line|curve|bar|dot|arrow|box|area)$",
    "(?<![\\p{L}])(?:i|we|you|they|he|she|it|that|there|here|what|who|let)'(?:ll|d|ve|re|m|s)(?![\\p{L}])",
    "^(?:or|and|so|okay|ok|all|well|now|then|whether)\\s",
    // slide labels: "Step one", "Choice A", "Property 1", "Group B", "Figure 2"
    "^(?:step|choice|property|option|case|part|figure|fig|question|slide|page|problem|group|table|line|point|assumption|exercise|example)\\s+(?:\\d+|[a-z]|one|two|three|four|five|six|seven|eight|nine|ten|first|second)$",
    "^(?:key|big|main|entire|whole|following|only|basic|central|real|important|interesting|good|great|hard|easy|simple|same|other|next)\\s+(?:question|insight|point|takeaway|message|content|lesson|course|reason|answer|goal|idea|thing|issue|problem)\\b",
    // "The first part of this class", "The rest of the lecture"
    "^(?:first|second|third|last|next|rest|end|beginning|middle|start)\\s+(?:part\\s+)?of\\s+(?:this|the|our|that)\\b",
    "\\bof\\s+(?:this|the|our|that)\\s+(?:class|lecture|course|semester|week|term|session|talk|unit)$",
    "[?>]",
  ].join("|"),
  "iu",
);
// "Economics at its core": a possessive pronoun inside a phrase means it's a clause, not a term
const TERM_POSSESSIVE = /\s(?:its|their|our|my|your)\s/i;
const BAD_DEFINITION =
  /^(?:that(?!\s+\p{L}+\s+(?:where|when|which|that|in which|you))|because|why|not|so|going|gonna|due|on|in|at|for|really|very|pretty|too|hard|easy|tough|fine|okay|ok|important|tricky|done|over|here|there|next|coming|up|out|back|cancelled|canceled|the part (?:everyone|people|you|that everyone|where you)|the one|the hard|the easy|the best|the worst|the same|the answer is|the reason (?:is|why)|the problem is|the point is|the thing is|the key is|the main thing|the last|the first|the next|the deadline|the due date|a big|a lot|a good|a bad|a great|a hard|a tough|a pain|a problem|a bit(?! like)|a little(?! bit like)|(?:my|your|our|his|her|their)\s+(?:homework|job|task|responsibility|problem|grade|turn|choice|call|fault)|yours|mine|worth|about(?!\s+\w+ing\b)|like|also|still|always|never|probably|definitely|el (?:próximo|lunes|martes|miércoles|jueves|viernes)|muy|importante|para|na|no|pra|o mais|a mais|isso|difícil|fácil|high|low|everywhere|something(?!\s+(?:that|which|created|made|used))|anything|well|awesome|amazing|fun|nice|cool|lovely|fantastic|brilliant|terrible|incredible|chapter|unit|page|section|one of (?:the|them|these|those)|part of|as if|as though|it's|it is|they're|there's|we're|i'm|you're|(?:different|identical|reliant|dependent|independent|proportional|sensitive|responsible|available|aware)\s+(?:in|to|from|of|for|on|with|than)|happy|unhappy|sad|willing|able|likely|unlikely|possible|impossible|probable|incredibly|extremely|quite|fairly|totally|absolutely|highly|especially|relatively|considered|regarded|said to|thought to|supposed to|an?\s+(?:\w+\s+)?example|(?:we|you|i|they)\s+(?:would|could|should|might|know|think|see)|(?:should|would|could|do|does|did|will|shall|may|might|must)\s+(?:you|we|i|they|he|she|it)|what happens (?:if|when)|what (?:drives|causes|makes|leads)|(?:reasonably|completely|widely|somehow|clearly|obviously|literally|certainly|definitely|currently|already|recently|barely|nearly|mostly|partly|directly)|told|only|(?:provided|based|used|located|condemned|assigned|required|designed|expected|determined|influenced|caused|followed|made|given|set|done|seen|taken|shown|found)\s+(?:by|to|in|under|as|for|with|from|at|on)|(?:\w+ed|driven|given|taken|shown|known|chosen|written)\s+by\b|being|been|having|interested in|credited with|(?:greater|less|more|fewer|bigger|smaller|higher|lower|equal)\s+than|how to\b|another\s+(?:part|piece|portion|section|step|chapter|bit|one)\b|higher|lower|bigger|smaller|harder|easier|worse|better|more|less|great|huge|super|insane|wild|crazy|key|crucial|central|tested|on the test|in the|at the)\b/iu;
const LEAD =
  /^(?:so|and|okay|ok|now|remember|basically|right|alright|all right|well|um|uh|hm+|oh|ah|eh|hã|ahn|then|also|anyway|look|listen|guys|everyone|everybody|okay everyone|entonces|bueno|recuerden|recuerda|o sea|básicamente|pues|a ver|ojo|oigan|mira|miren|chicos|chicas|muchachos|chavos|ahorita|vale|então|gente|pessoal|galera|tipo|bom|olha|lembrem|lembra|tá|beleza)[,]?\s+/iu;
const FILLER =
  /,?\s*(?<![\p{L}])(?:um|uh|like|basically|you know|right|o sea|eh|hã|ahn|este|tipo|gente|pessoal|né|tá|¿sí\?|¿vale\?|¿no\?|a ver|in simple terms|simply put|put simply|in short|essentially|roughly|informally|técnicamente|digamos|para que quede claro|pra quem não lembra|pra ficar claro|for the record|if you remember)(?![\p{L}])\s*,/giu;

function cleanSentence(s) {
  let c = s.trim();
  // A restart in the middle ("These are based-- indifference curves are basically preference maps"): keep the restart
  c = c.replace(
    /^[^.?!]{0,40}\b(?:is|are|was|were|am|we|you|i|they|these|this|that|it)\b[^.?!-]{0,30}--\s*(?=[a-z])/i,
    "",
  );
  for (let i = 0; i < 4 && LEAD.test(c); i++) c = c.replace(LEAD, "");
  return c
    .replace(FILLER, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*(is|are|was|were|es|son|é|são)\s/i, " $1 ")
    .replace(/\s(is|are|es|son|é|são),\s/i, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function goodTerm(term) {
  const t = (
    /^a (?:priori|posteriori|fortiori)$/i.test(term.trim())
      ? term
      : term.replace(/^(the|a|an|el|la|los|las|un|una|o|os|as)\s+/i, "")
  )
    .replace(/[,:;]+$/, "")
    .trim();
  if (t.length < 2 || t.length > 48 || t.includes(",")) return null;
  if (PRONOUN.test(t) || NOT_TERM.test(t) || EVENTISH.test(t) || NUMBERISH.test(t)) return null;
  if (TERM_NOT_NP.test(t) || TERM_POSSESSIVE.test(t)) return null;
  // "Others say it", "Some people think": a clause, not a term
  if (
    /(?<![\p{L}])(?:it|they|we|you|i|he|she|say|says|said|think|thinks|argue|argues|believe|believes)(?![\p{L}'])/iu.test(
      t,
    ) &&
    t.split(/\s+/).length > 1
  )
    return null;
  if (
    t.split(/\s+/).length > 5 ||
    /\d{3,}/.test(t) ||
    findDates(t).length ||
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miércoles|jueves|viernes|segunda|terça|quarta|quinta|sexta)\b/i.test(
      t,
    )
  )
    return null;
  return t;
}

function goodDefinition(def) {
  const d = def
    .replace(/\s*(?:,\s*)?(?:right|okay|ok|¿sí|¿vale|¿no|né|tá|sabe|ok)\?*\s*$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (/\$\d/.test(d)) return null;
  if (/\b(?:is|are) called\b/i.test(d)) return null;
  if (d.split(/\s+/).length < 3 || BAD_DEFINITION.test(d) || (NUMBERISH.test(d) && d.split(/\s+/).length < 4))
    return null;
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

const VERBS =
  "compares|speeds|slows|lowers|raises|converts|turns|breaks|stores|carries|controls|produces|makes|allows|lets|shows|measures|describes|tells|represents|transports|holds|binds|blocks|takes|gives|uses|calls|returns|moves|keeps|protects|regulates|connects|separates|absorbs|releases|creates|changes|reduces|increases|predicts|explains";

/** Pull one definition out of a cleaned sentence: [term, definition] or null. */
function matchDefinition(c, next) {
  let m;
  // "ROI, return on investment, is ..."
  if (
    (m = c.match(
      /^([A-Z][A-Za-z]{1,6}),\s+(?!then\b|so\b|and\b|but\b|[a-z]+ing\b)([^,]{4,60}?),?\s+(?:is|are|means|es|é)\s+(.{6,})$/,
    ))
  )
    return [m[1], `${m[2]}: ${m[3]}`, true, "roi"];
  // "Osmosis, and people mix this up..., osmosis is specifically ..."
  if (
    (m = c.match(
      /^([^,]{2,40}),\s.*?,\s*([^,]{2,40}?)\s+(?:is|are|es|é)\s+(?:specifically|basically|just|simply|really)?\s*(.{6,})$/i,
    )) &&
    m[1].toLowerCase().replace(/^(the|a|an)\s+/, "") === m[2].toLowerCase().replace(/^(the|a|an)\s+/, "")
  )
    return [m[1], m[3], undefined, "aside-repeat"];
  // "X, X is ...": "a ratio, a ratio is just a comparison ..."
  if (
    (m = c.match(/^([^,]{2,40}),\s*(.{2,40}?)\s+(?:is|are|es|é)\s+(?:basically|just|simply|really)?\s*(.{6,})$/iu)) &&
    m[1].toLowerCase().replace(/^(the|a|an|el|la|un|una|o|a|um|uma)\s+/, "") ===
      m[2].toLowerCase().replace(/^(the|a|an|el|la|un|una|o|a|um|uma)\s+/, "")
  )
    return [m[1], m[3], undefined, "repeat"];
  // A short aside between the term and "is": "Recursion, and everyone groans here, is just a function ..."
  if (
    (m = c.match(
      /^([^,]{2,40}),\s*((?:and|in|at|as|if|or|which|anyway|y|o|e|como|por|pra|para|en|em|no|na)\s[^,]{2,40}?),?\s+(?:is|are|es|son|é|são)\s+(?:basically|just|simply|really|básicamente|basicamente)?\s*(.{6,})$/iu,
    )) &&
    m[2].split(/\s+/).length <= 6
  )
    return [m[1], m[3], undefined, "aside"];
  // "afterload, think of it as the resistance ..."
  if (
    (m = c.match(
      /^([^,]{2,40}),\s*(?:think of it as|think of (?:this|that) as|picture it as|piensen en (?:él|ella|eso) como|pensem nisso como)\s+(.{6,})$/iu,
    ))
  )
    return [m[1], m[2], undefined, "think-of"];
  // "... we start with elasticity, which is how much ...": the term comes right before ", which is"
  if (
    (m = c.match(
      /(?:^|\s)(?:with|on|about|have an?|have the|need an?|con|sobre|com|de)\s+([\p{L}]+(?: [\p{L}-]+){0,2}),\s*(?:which is|que es|que é|o que é)\s+(.{6,})$/iu,
    ))
  )
    return [m[1], m[2], undefined, "with-which-is"];
  // "Feudalism, the short version is ...", "the Columbian Exchange, that's the transfer of ..."
  if (
    (m = c.match(
      /^([^,]{2,40}),\s*(?:that's|that is|it's|it is|the short version is|which is|es|é|eso es|isso é|o que é|que es|que é|es decir)\s+(.{6,})$/i,
    ))
  )
    return [m[1], m[2], undefined, "thats"];
  // "Se llama inflación al aumento ...", "Chamamos de X o/a ..."
  if ((m = c.match(/^se llama\s+(.{2,40}?)\s+(?:al|a la|a los|a las|a)\s+(.{6,})$/i)))
    return [m[1], m[2], undefined, "se-llama"];
  if ((m = c.match(/^(?:chamamos(?: de)?|a gente chama(?: de)?)\s+(.{2,40}?)\s+(?:o|a|os|as)\s+(.{6,})$/i)))
    return [m[1], m[2], undefined, "chamamos"];
  // "Le llamamos inflación al aumento ...", "A esto le llamamos X: ..."
  if ((m = c.match(/^(?:y\s+)?le\s+llamamos\s+(.{2,40}?)\s+(?:al|a la|a los|a las|a)\s+(.{6,})$/i)))
    return [m[1], m[2], undefined, "le-llamamos"];
  if ((m = c.match(/^(?:a esto|a eso)\s+le\s+llamamos\s+(.{2,40}?)[,:]\s*(.{6,})$/i)))
    return [m[1], m[2], undefined, "a-esto"];
  // "There's something called sperm competition where she may want ..."
  if (
    (m = c.match(
      /^there(?:'s| is| are)\s+(?:something|a thing|a process|a phenomenon|a concept)\s+called\s+(.{2,40}?)[,]?\s+(?:where|in which|which is|that's)\s+(.{6,})$/i,
    ))
  )
    return [m[1], m[2], undefined, "theres-called"];
  // "We say a function is continuous if ..."
  if ((m = c.match(/^we say (?:that )?(?:a|an)\s+([a-z]+)\s+is\s+([a-z]+)\s+(if|when)\s+(.{6,})$/i)))
    return [`${m[2]} ${m[1]}`, `a ${m[1]} is ${m[2]} ${m[3]} ${m[4]}`, undefined, "we-say"];
  // "...means what we're going to call maximum surplus, which is the most stuff that gets produced"
  if (
    (m = c.match(
      /\b(?:we(?:'re going to|'ll| will)?|i)\s+call(?:\s+(?:it|this|that))?\s+(?:an?\s+|the\s+)?([^,]{2,40}?),\s*(?:which is|that's|that is|meaning)\s+(.{6,})$/i,
    ))
  )
    return [m[1], m[2], undefined, "we-call-which"];
  // "We call this opportunity cost" / "this is called X" / "known as X": the definition is next door
  if (
    (m = c.match(
      /^(?:we call (?:this|that|it)|(?:this|that|it)(?: is|'s) called|(?:this|that) is known as|lo llamamos|esto se llama|isso se chama|a gente chama isso de)\s+(.{2,40}?)[,.!?]*(?:\s*right\?*)?$/i,
    )) &&
    next
  )
    return [m[1], next, undefined, "we-call-next"];
  // "X is/are/was ...", "X means/refers to/stands for ..."
  if (
    (m = c.match(
      /^(.{2,48}?)\s+(?:means|refers to|is defined as|stands for|is called|significa|significan|se refiere a|se define como|quiere decir|quer dizer|se refere a|é definid[oa] como)\s+(.{6,})$/i,
    ))
  )
    return [m[1], m[2], undefined, "means"];
  if (
    (m = c.match(
      /^(.{2,48}?)\s+(tells (?:you|us)|lets (?:you|us)|allows (?:you|us) to|describes|measures)\s+(.{6,})$/i,
    ))
  )
    return [m[1], `${m[2]} ${m[3]}`, undefined, "tells"];
  if (
    (m = c.match(
      /^(.{2,48}?)\s+(?:is|are|was|were|es|son|era|fue|é|são|foi|era)\s+(?:basically|just|simply|really|specifically|essentially|actually|kind of|sort of|básicamente|simplemente|basicamente|simplesmente)?\s*(.{6,})$/iu,
    ))
  ) {
    // "Where the points meet is the market equilibrium": the clause describes, the short noun phrase is the term
    const named = /^where\b/i.test(m[1]) && m[2].match(/^the\s+(.{3,30})$/i);
    if (named && named[1].split(/\s+/).length <= 3)
      return [named[1].replace(/[.!?]+$/, ""), m[1], undefined, "where-is"];
    return [m[1], m[2], undefined, "is"];
  }
  // "A catalyst speeds up a reaction ..."
  if ((m = c.match(new RegExp(`^(?:a|an)\\s+([a-z][\\w -]{2,30}?)\\s+((?:${VERBS})\\s+.{6,})$`, "i"))))
    return [m[1], m[2], undefined, "a-verb"];
  return null;
}

const TERM_WORDS = "[\\p{L}][\\p{L}-]*(?: [\\p{L}-]+){0,2}";

/**
 * Definitions that sit in the middle of a sentence, or name a term and leave the meaning to the next sentence:
 * "there's going to be consumer preferences, which is what people want, and a budget constraint, which is what they can afford",
 * "a period known as the prebiotic world, where there were no living organisms", "that's what we call a heuristic, a simple way to think",
 * "it's what psychologists call automaticity." (+ next), "The first is completeness." (+ "What I mean by that is ...").
 * Returns [term, definition] pairs.
 */
function inlineDefinitions(c, next) {
  const out = [];
  const tidy = (d) => d.replace(/,\s*(?:because|so|but|and|right|okay)\b.*$/i, "");
  // "..., there's going to be X, which is Y, and ...", "things known as X, which are Y"
  for (const m of c.matchAll(
    new RegExp(
      `(?:^|[\\s,])(?:there(?:'s| is| are)(?: going to be| gonna be)?|(?:we|you)(?:'ll| will)? have|known as|called|things like)\\s+(?:an?\\s+|the\\s+)?(${TERM_WORDS}),\\s*which (?:is|are|tells us|tell us|says|describes|gives us|means)\\s+(.{6,}?)(?=,\\s+(?:and|but|so)\\b|[.?!]|$)`,
      "giu",
    ),
  ))
    out.push([m[1], m[2]]);
  // "a period of time known as the prebiotic world, where there were not living organisms"
  for (const m of c.matchAll(
    new RegExp(
      `\\b(?:known as|called|termed|named)\\s+(?:the\\s+|an?\\s+)?(${TERM_WORDS}),?\\s+((?:where|in which|that is)\\s+.{8,}?)(?=[.?!]|$)`,
      "giu",
    ),
  ))
    out.push([m[1], m[2]]);
  // "...they came up with this new model, the Rutherford model, where you had mostly empty space"
  for (const m of c.matchAll(
    new RegExp(
      `\\b(?:model|law|theory|principle|effect|rule|equation|experiment|method),\\s+(?:the\\s+)?(${TERM_WORDS}),\\s+((?:where|in which|which)\\s+.{8,}?)(?=[.?!]|$)`,
      "giu",
    ),
  ))
    out.push([m[1], m[2].replace(/^which\s+/i, "")]);
  // "The negatively charged particle got the name of the electron."
  const named = c.match(
    /^(?:the\s+)?([\p{L}-]+(?: [\p{L}-]+){1,3}) (?:got|was given|received|earned) the name (?:of )?(?:the\s+)?([\p{L}-]+(?: [\p{L}-]+)?)[.!?]*$/iu,
  );
  if (named) out.push([named[2], named[1]]);
  // "they're called condensation reactions, because as you form that bond, you kick out a molecule of water",
  // "known as amphipathic because they have a split personality"
  for (const m of c.matchAll(
    new RegExp(
      `\\b(?:called|known as|termed|named)\\s+(?:an?\\s+|the\\s+)?(${TERM_WORDS}),?\\s+(?:because|since|as)\\s+(.{8,}?)(?=[.?!]|$)`,
      "giu",
    ),
  ))
    out.push([m[1], m[2]]);
  // "micelles and lipid bilayers, which are the key boundary of cells"
  for (const m of c.matchAll(
    new RegExp(
      `\\b(?:and|or)\\s+(?!(?:[\\p{L}-]+\\s+)*(?:about|of|to|in|on|at|for|with|from|that|this|it|them|you|we|i)\\b)(${TERM_WORDS}),\\s*which (?:is|are)\\s+((?:the|an?|what|where|when|how)\\b.{4,}?)(?=,\\s+(?:and|but|so)\\b|[.?!]|$)`,
      "giu",
    ),
  ))
    out.push([m[1], m[2]]);
  // "that's what we call a heuristic, a simple way to think about it"
  const callBlock = `\\bwhat\\b[^.?!]{0,60}?\\b(?:call|called|known as)\\b[,\\s"]*(?:an?\\s+|the\\s+)?"?(${TERM_WORDS})"?`;
  let m = c.match(new RegExp(`${callBlock},\\s*((?:an?|the)\\s.{8,})$`, "iu"));
  if (m) out.push([m[1], tidy(m[2])]);
  // "it's what psychologists call automaticity." The next sentence says what it is.
  else if (next && (m = c.match(new RegExp(`${callBlock}[.!?"]*$`, "iu")))) out.push([m[1], next]);
  // "The first is completeness." / "..., which is transitivity."  then "What I mean by that is ..."
  if (next) {
    const means = next.match(
      /^(?:what i mean by (?:that|this) is|that means|this means|it means|which means)\s+(.{8,})$/i,
    );
    const first = c.match(
      /^(?:the )?(?:first|second|third|fourth|next|last)(?: (?:assumption|property|principle|rule|idea|concept|type|kind|one))? is (?:the )?([\p{L}-]+(?: [\p{L}-]+)?)[.]?$/iu,
    );
    if (first && means) out.push([first[1], means[1]]);
    const named = c.match(
      /\b(?:assumption|property|principle|concept|idea|term|rule|law|effect|theorem|model)\b.*,\s*which is\s+(?:the\s+)?([\p{L}-]+(?: [\p{L}-]+)?)[.]?$/iu,
    );
    if (named && !first && !/^(?:so|and|but|now|okay|ok)\b/i.test(next)) out.push([named[1], next]);
    // "...randomly assigned one to be in the four-caster group." + "That's a group that tells you how they would feel"
    const tail = c.match(/(?:\bthe|\ban?)\s+([\p{L}-]+(?: [\p{L}-]+)?)\.?$/iu);
    const head = tail && tail[1].split(" ").pop();
    if (
      head &&
      new RegExp(
        `^(?:that's|that is|those are|these are)\\s+an?\\s+${head}\\s+(?:that|who|which|where|of)\\b`,
        "i",
      ).test(next)
    )
      out.push([tail[1], next.replace(/^(?:that's|that is|those are|these are)\s+/i, "")]);
  }
  return out;
}

// How sure we are that a term and its definition really belong together (0 to 1). The evidence is
// things that can be checked: how the speaker introduced it (a marker such as "called", "known as",
// "means"), whether the term is course vocabulary or everyday talk, whether it comes up again, and
// whether the meaning reads like a meaning or like a sum. The weights below were fitted on definitions
// that were judged by hand in 23 real lectures (see engine/bench/README.md), not chosen by feel.
const MARKER =
  /\b(?:called|call|known as|termed|named|means|mean by|refers? to|defined as|definition|stands? for|we say|so[- ]called|se llama|llamamos|significa|chamamos|quer dizer)\b/i;
const MATHY =
  /\b(?:equals?|equal to|over|squared|cubed|times|plus|minus|divided|derivative|integral|\d+|sqrt)\b|[=+*/^]/gi;
const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function definitionFeatures(term, def, sentence, ctx) {
  const tw = term.trim().split(/\s+/);
  const dw = def.trim().split(/\s+/);
  const lw = (a) => a.map((w) => w.toLowerCase().replace(/[^\p{L}']/gu, "")).filter((w) => w.length >= 2);
  const termWords = lw(tw);
  const defWords = lw(dw);
  const uncommon = termWords.filter((w) => !COMMON_WORDS.has(w));
  const count = ctx.long ? ctx.count(term) : 2;
  const head = tw
    .at(-1)
    .toLowerCase()
    .replace(/[^\p{L}]/gu, "");
  return {
    marker: MARKER.test(sentence) ? 1 : 0,
    termWords: Math.min(tw.length, 4),
    termUncommon: termWords.length ? uncommon.length / termWords.length : 0,
    termAllCommon: termWords.length && !uncommon.length ? 1 : 0,
    termCount: Math.log1p(Math.min(count, 30)),
    termOnce: count <= 1 ? 1 : 0,
    termName: tw.length >= 2 && tw.every((w) => /^[A-Z]/.test(w)) ? 1 : 0,
    termShort: tw.length === 1 && term.length <= 3 && !/^[A-Z]{2,}$/.test(term) ? 1 : 0,
    termLen: Math.log(term.length),
    defWords: Math.log(dw.length),
    defArticle: /^(?:an?|the)\b/i.test(def) ? 1 : 0,
    defWhen: /^(?:when|where|how|what|whatever|whoever|something|someone|anything|one|those|used)\b/i.test(def) ? 1 : 0,
    defMathy: Math.min(((def.match(MATHY) || []).length / dw.length) * 4, 2),
    defPronounStart: /^(?:i|we|you|they|it|this|that|there|these|those|my|our|your)\b/i.test(def) ? 1 : 0,
    defCommon: defWords.length ? defWords.filter((w) => COMMON_WORDS.has(w)).length / defWords.length : 0,
    defHasTerm: head.length > 3 && new RegExp(`\\b${escapeRe(head)}`, "i").test(def) ? 1 : 0,
    defEndsMid: /\b(?:and|or|but|the|a|an|of|to|so|that|because|with)$/i.test(def.replace(/[.!?]+$/, "")) ? 1 : 0,
    defRepeat: /\b(\w{3,})\s+\1\b/i.test(def) ? 1 : 0,
    sentenceLen: Math.log(sentence.split(/\s+/).length),
    // a concept is said with a determiner elsewhere ("the demand curve", "a monopoly", "this model"): share of mentions
    termDet: ctx.long ? ctx.detShare(term) : 0.5,
    // a noun-looking last word (-tion, -ity, -ism, -ment, -ness, -ology, -ics, -ure, -ance)
    termNounSuffix: /(?:tion|sion|ity|ism|ment|ness|ology|ics|ure|ance|ence|ory|ism|ide|ase|ene|ane|ol)s?$/i.test(head)
      ? 1
      : 0,
    // said in a naming frame somewhere else in the talk ("called X", "X is defined", "the term X")
    termNamed: ctx.long ? ctx.named(term) : 0,
    // the meaning is a noun phrase with a relative clause: "a market where ...", "the process by which ..."
    defNounClause:
      /^(?:an?|the)\s+(?:\w+\s+){0,3}\w+\s+(?:that|which|where|when|who|whereby|by which|in which)\b/i.test(def)
        ? 1
        : 0,
    defIsFragment: /^(?:\w+\s+){0,2}\w+$/.test(def) ? 1 : 0,
    markerStrong:
      /\b(?:called|known as|termed|so[- ]called|the term|the word|defined as|definition|refer to as|referred to as)\b/i.test(
        sentence,
      )
        ? 1
        : 0,
    // talk, not a definition: the meaning speaks of "I", "we're going to", "my", past events, or things on the board
    defTalk: /\b(?:i|i'm|i'd|i've|i'll|my|we're|we'll|we've|we|our|you|your|us)\b/i.test(def) ? 1 : 0,
    defPast: /\b(?:was|were|did|had|started|set up|went|said|mentioned|talked|showed|saw)\b/i.test(def) ? 1 : 0,
    defHere:
      /\b(?:here|this one|that one|over there|on the board|this slide|just said|mentioned|earlier|last time)\b/i.test(
        def,
      )
        ? 1
        : 0,
    // a person or a place being described, not a concept: "Satoshi is the one who...", "Larry Summers is my advisor"
    termPerson:
      tw.length >= 1 &&
      tw.length <= 3 &&
      tw.every((w) => /^[A-Z][a-z]+$/.test(w)) &&
      !termWords.some((w) => COMMON_WORDS.has(w))
        ? 1
        : 0,
    termDeixis: /\b(?:here|this|that|these|those|new|other|another|same|next|first|second|big)\b/i.test(term) ? 1 : 0,
    termFirst: sentence
      .toLowerCase()
      .replace(/^[^\p{L}]+/u, "")
      .startsWith(term.toLowerCase().split(" ")[0])
      ? 1
      : 0,
  };
}
// Rules whose matches need extra evidence in a long transcript (see findDefinitions).
const WEAK_RULES = new Set(["is", "thats", "fragment", "roi", "tells", "other"]);
// Fitted by engine/bench/fit-definitions.py on judged definitions from real lectures.
const DEFINITION_MODEL = {
  bias: -5.6532,
  weights: {
    marker: 0.9985,
    termWords: 0.0066,
    termUncommon: 0.6629,
    termAllCommon: -0.485,
    termCount: 0.5636,
    termOnce: -0.1862,
    termName: -0.2177,
    termShort: -0.2186,
    termLen: 0.6978,
    defWords: 0.2391,
    defArticle: 1.0525,
    defWhen: 0.1739,
    defMathy: -0.5642,
    defPronounStart: -0.1149,
    defCommon: -0.035,
    defHasTerm: -0.2712,
    defEndsMid: 0.0904,
    defRepeat: -0.0385,
    sentenceLen: 0.203,
    termDet: 0.2361,
    termNounSuffix: -0.1929,
    termNamed: 0.5505,
    defNounClause: 0.4248,
    defIsFragment: -0.7095,
    markerStrong: 0.0183,
    defTalk: -0.275,
    defPast: -0.609,
    defHere: -0.5454,
    termPerson: -0.4238,
    termDeixis: -0.4901,
    termFirst: -0.0702,
  },
};
function definitionConfidence(term, def, sentence, ctx) {
  const f = definitionFeatures(term, def, sentence, ctx);
  let z = DEFINITION_MODEL.bias;
  const parts = [];
  for (const [k, w] of Object.entries(DEFINITION_MODEL.weights)) {
    const v = w * (f[k] ?? 0);
    z += v;
    if (Math.abs(v) >= 0.25) parts.push([k, v]);
  }
  parts.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return {
    confidence: +(1 / (1 + Math.exp(-z))).toFixed(3),
    why: parts.slice(0, 4).map(([k, v]) => `${v > 0 ? "+" : "-"} ${k}`),
    features: f,
  };
}

const CONTINUES =
  /^\W*(?:it|this|that|they|these|those|which|so|and|because|but|then|here|when|if|in other words|basically|meaning|for example|for instance|think of|such as)\b/i;
const SHIFT =
  /^\W*(?:let'?s|now let'?s|next|moving on|so what|what about|any questions|okay,? so let'?s|all right|alright|the next|the second|second|third|first)\b/i;
const contentWords = (str) =>
  str
    .toLowerCase()
    .split(/[^\p{L}']+/u)
    .filter((w) => w.length >= 4 && !COMMON_WORDS.has(w));

/** After a definition, keep reading while the talk stays on the same topic (it mentions the term or carries on
 * with "it / this / which / for example"), and stop at a topic change, a question or a new heading. At most
 * three sentences and about 60 words, so the explanation is complete but still a note. */
export function explanationAfter(following, term, def) {
  const tw = contentWords(term);
  const dw = new Set(contentWords(def));
  const more = [];
  let words = 0;
  for (const raw of following) {
    const n = cleanSentence(raw);
    if (!n || /\?$/.test(n) || SHIFT.test(n)) break;
    const lower = n.toLowerCase();
    if (lower.includes(def.toLowerCase().slice(0, 30)) || def.toLowerCase().includes(lower.slice(0, 30))) continue;
    const mentions = tw.some((w) => lower.includes(w));
    const shared = contentWords(n).filter((w) => dw.has(w)).length;
    if (!(mentions || shared >= 2 || (CONTINUES.test(n) && shared >= 1))) break;
    const len = n.split(/\s+/).length;
    if (len < 4 || words + len > 60) break;
    more.push(n);
    words += len;
    if (more.length === 3) break;
  }
  return more;
}

/** For "that's called X": the one or two sentences before it say what X is. If the next sentence comes back
 * to X, it belongs to the meaning too. Short fillers, questions and other naming lines are skipped. */
function meaningBefore(list, i, term) {
  const take = [];
  let words = 0;
  for (let k = i - 1; k >= 0 && take.length < 2; k--) {
    const c = cleanSentence(list[k]);
    const n = c.split(/\s+/).length;
    if (n < 4 || /\?$/.test(c) || /\b(?:called|known as|we call)\b/i.test(c)) {
      if (take.length) break;
      continue;
    }
    if (words + n > 50) break;
    take.unshift(c);
    words += n;
  }
  if (!take.length) return null;
  const after = list[i + 1] && cleanSentence(list[i + 1]);
  const tw = contentWords(term);
  if (after && after.split(/\s+/).length >= 4 && tw.some((w) => after.toLowerCase().includes(w)) && words < 50)
    take.push(after);
  return { definition: take.join(" "), sentence: [...take, list[i]].join(" ") };
}

/** Find definitions in notes or a transcript: [{ term, definition, sentence }]. Works on how people talk,
 * not only on "X is a Y": "so mitosis, basically, it's when ...", "we call this opportunity cost", "what is an API? It's ...".
 */
export function findDefinitions(text, { minConfidence = 0, features = false, gate = true } = {}) {
  const out = [];
  const seen = new Set();
  // a closing quote ends a sentence too: '... "attentional resources." We can pay ...'
  const list = sentences(text).flatMap((x) => x.split(/(?<=[.?!]["”])\s+(?=[A-Z])/));
  const lower = text.toLowerCase();
  const index = new Map();
  list.forEach((x, i) => index.has(x) || index.set(x, i));
  const following = (sentence, n) => {
    let i = index.get(sentence);
    if (i === undefined) i = list.findIndex((x) => sentence.startsWith(x));
    if (i < 0) return [];
    // a definition found across two or three sentences ends with the last of them
    let rest = sentence.slice(list[i].length).trim();
    while (rest && list[i + 1] && rest.startsWith(list[i + 1])) {
      rest = rest.slice(list[i + 1].length).trim();
      i++;
    }
    return list.slice(i + 1, i + 1 + n);
  };
  const ctx = {
    long: list.length >= 25,
    count: (term) => {
      const t = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return (lower.match(new RegExp(`(?<![\\p{L}])${t}(?:s|es)?(?![\\p{L}])`, "gu")) || []).length;
    },
    detShare: (term) => {
      const t = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const all = (lower.match(new RegExp(`(?<![\\p{L}])${t}(?:s|es)?(?![\\p{L}])`, "gu")) || []).length;
      if (!all) return 0;
      const det = (
        lower.match(
          new RegExp(
            `\\b(?:the|a|an|this|that|these|those|of|called|as|its|their|our|your|my)\\s+${t}(?:s|es)?(?![\\p{L}])`,
            "gu",
          ),
        ) || []
      ).length;
      return det / all;
    },
    named: (term) => {
      const t = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        `\\b(?:called|known as|termed|the term|the word|so-called|so called|what we call|refer to as|referred to as|define|defined)\\s+(?:an?\\s+|the\\s+)?"?${t}(?:s|es)?(?![\\p{L}])`,
        "u",
      ).test(lower)
        ? 1
        : 0;
    },
  };
  const push = (term, def, sentence, keepCase, rule = "other") => {
    const t = goodTerm(term);
    const d = t && goodDefinition(def);
    if (!t || !d) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const { confidence, why, features: feat } = definitionConfidence(t, d, sentence, ctx);
    if (confidence < minConfidence) return;
    // In a whole lecture, a bare "X is Y" is usually talk, not a definition (16% real when judged by hand on
    // 23 lectures). Keep it only when X is course vocabulary and Y is a noun phrase; the other shapes
    // ("called X, which is", "what we call X", "X means") stand on their own.
    if (
      gate &&
      ctx.long &&
      WEAK_RULES.has(rule) &&
      !(
        (feat.termNamed || (feat.termUncommon >= 0.5 && feat.termCount >= Math.log1p(2))) &&
        (feat.defArticle || feat.defNounClause || feat.defWhen) &&
        feat.defMathy < 0.5
      )
    )
      return;
    out.push({
      term: keepCase || /^[A-Z]{2,}/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1),
      definition: d,
      sentence,
      confidence,
      why,
      more: explanationAfter(following(sentence, 6), t, d),
      ...(features ? { features: feat, rule } : {}),
    });
  };
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const c = cleanSentence(s);
    const next = list[i + 1] && cleanSentence(list[i + 1]);
    // "What is an API? It's a contract ..." and "Okay, classical conditioning. That's learning by association."
    const mean =
      c.match(/^what do (?:i|we) mean by\s+(?:an?\s+(?!priori|posteriori|fortiori)|the\s+)?(.{2,40}?)\?$/i) ||
      c.match(/^¿?qu[ée] (?:quiero decir|queremos decir|significa)\s+(?:con\s+)?(.{2,40}?)\?$/iu) ||
      c.match(/^o que (?:eu )?quero dizer com\s+(.{2,40}?)\?$/iu);
    if (mean && next && next.split(/\s+/).length >= 4) {
      push(mean[1], next.replace(/^(?:it's|it is|that's|es|é)\s+/i, ""), `${s} ${list[i + 1]}`, undefined, "mean");
      i++;
      continue;
    }
    const q =
      c.match(/^what(?:'s| is| are)\s+(?:an?\s+|the\s+)?(.{2,40}?)\?$/i) ||
      c.match(/^qu[ée]\s+es\s+(?:un|una|el|la)?\s*(.{2,40}?)\?$/i) ||
      c.match(/^o que (?:é|são)\s+(?:um|uma|o|a)?\s*(.{2,40}?)\?$/i);
    let frag = !q && c.match(/^([\p{L}][\p{L}' -]{1,40})[.:]$/u);
    if (frag && /\s(?:is|are|was|were|has|have|had)\s/i.test(frag[1])) frag = null;
    // "Textbook is April." is a short sentence, not a heading
    const answer =
      next &&
      next.match(
        /^(?:it's|it is|that's|that is|they're|they are|those are|these are|this is|es|son|é|são|isso é|eso es)\s+(?:basically\s+|básicamente\s+|basicamente\s+)?(.{6,})$/i,
      );
    if ((q || (frag && frag[1].split(/\s+/).length <= 4)) && answer) {
      push((q || frag)[1], answer[1], `${s} ${list[i + 1]}`, undefined, q ? "question" : "fragment");
      i++;
      continue;
    }
    // "The other extreme is what's called the command economy." The next sentence says what it is
    // (skipping a repeat of the same line, which Whisper sometimes makes).
    const called = c.match(
      /\b(?:is|are|it's|that's|have|has|get|got)\s+what(?:'s| is| are)\s+(?:called|known as)\s+(?:the\s+|an?\s+)?(.{2,40}?)[.!?]*$/i,
    );
    if (called) {
      const follow = [list[i + 1], list[i + 2]]
        .map(
          (x) =>
            x &&
            cleanSentence(x)
              .replace(/^(?:in (?:this|that) case|here|so|then),?\s+/i, "")
              .replace(new RegExp(`^in (?:an?|the) ${called[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},\\s+`, "i"), ""),
        )
        .find((x) => x && !/\b(?:called|we call|known as)\b/i.test(x));
      if (follow) push(called[1], follow, s, undefined, "called-next");
      continue;
    }
    for (const [t, d] of inlineDefinitions(c, next)) push(t, d, s, undefined, "inline");
    let m = matchDefinition(c, next);
    // "Dealers are mixing the fentanyl in", "The red protein is marking cells": something happening, not a meaning.
    // (A bare concept can be defined by what it does: "Encryption is scrambling data so only...")
    if (
      m &&
      /^(?!nothing|something|anything|everything)[a-z]{3,}ing\b/i.test(m[1]) &&
      (/^(?:the|these|those|this|that|my|your|our|their)\s/i.test(c) || /\b(?:are|were)\s+[a-z]{3,}ing\b/i.test(c))
    )
      m = null;
    // "And that's called the flat case." names what was just said: the meaning is the sentence or two before
    // (and the next sentence too, when it comes back to the term).
    if (m?.[3] === "we-call-next") {
      const back = meaningBefore(list, i, m[0]);
      if (back) {
        push(m[0], back.definition, back.sentence, m[2], "named-back");
        continue;
      }
    }
    if (m) push(m[0], m[1], s, m[2], m[3]);
    // "Positive analysis is the study of the way things are, while normative analysis is the study of the way things should be"
    const other = c.match(/,\s*(?:while|whereas)\s+([\p{L}][\p{L} -]{2,30}?)\s+(?:is|are)\s+(.{6,})$/iu);
    if (m && other) push(other[1], other[2], s, undefined, "while");
  }
  return out;
}

// Nouns anyone could guess from the sentence around them.
const COMMON_NOUNS = new Set(
  "people person historians scientists researchers experts scholars critics students teachers children others someone everyone anyone things thing example examples reason reasons way ways year years time times question questions problem problems answer answers result results number numbers part parts group groups country countries place places world idea ideas kind kinds type types lot lots side sides point points case cases fact facts process system systems change changes level levels area areas form forms work works life lives person's".split(
    " ",
  ),
);

// Words that make poor fill-in-the-blank answers: classroom talk, not course content.
const BLANK_SKIP = new Set(
  "chapter chapters today tomorrow everyone class lesson lecture week weeks review quiz test exam homework page pages section unit tema clase examen semana hoy".split(
    " ",
  ),
);

/** A small seeded random number generator, so a quiz can be shuffled the same way twice. */
function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle a copy of a list. Pass a seed for the same order every time. */
export function shuffle(list, seed = Date.now()) {
  const rand = seeded(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
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
/** Practice questions from notes [{ title, topic, text, definitions? }]. */
export function makeQuiz(notes, { count = 10, flip = false, seed = Date.now() } = {}) {
  const defs = [];
  const usedTerms = new Set();
  // A note can bring its own definitions (the ones the student accepted); otherwise they are found in its text
  const found = notes.map((note) => (Array.isArray(note.definitions) ? note.definitions : findDefinitions(note.text)));
  notes.forEach((note, n) => {
    found[n].forEach((d, i) => {
      usedTerms.add(d.term.toLowerCase());
      const asTerm = (i % 2 === 0) !== flip;
      defs.push(
        asTerm
          ? { kind: "term", prompt: d.definition, answer: d.term, source: note.title }
          : { kind: "define", prompt: d.term, answer: d.definition, source: note.title },
      );
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
    const proper = new RegExp(`[^.!?]\\s${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}(?![\\p{L}])`, "u").test(
      text,
    );
    const lower = new RegExp(`(?<![\\p{L}])${w.toLowerCase()}(?![\\p{L}])`, "u").test(text);
    return proper && !lower ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase();
  };
  const stem = (w) => w.toLowerCase().replace(/e?s$/, "").replace(/e$/, "");
  const plural = (w) =>
    /s$/i.test(w.trim().split(/\s+/).pop()) && !/(?:ss|us|is|ys)$/i.test(w.trim().split(/\s+/).pop());
  const capital = (w) => /^\p{Lu}/u.test(w);
  const verbish = (w) => /(?:ed|ing)$/i.test(w);
  const pick = (answer, pool, sameShape) => {
    const shaped = sameShape
      ? pool.filter(
          (w) => plural(w) === plural(answer) && capital(w) === capital(answer) && verbish(w) === verbish(answer),
        )
      : pool;
    const alike = shaped.filter(
      (w, i) => stem(w) !== stem(answer) && shaped.findIndex((x) => stem(x) === stem(w)) === i,
    );
    return alike.length >= 3 ? shuffle([answer, ...shuffle(alike, seed + ++k).slice(0, 3)], seed + ++k) : undefined;
  };
  const terms = allDefs.map((d) => d.term);
  let asTerm = 0;
  for (const q of defs) {
    if (q.kind === "define")
      q.choices = pick(
        q.answer,
        allDefs.map((d) => d.definition),
        false,
      );
    // Every other "which term means…" is multiple choice; the rest are typed, which helps recall
    else if (asTerm++ % 2 === 0) q.choices = pick(q.answer, terms, true);
  }
  const words = [...new Set([...blanks.map((b) => b.answer), ...terms.filter((t) => !/\s/.test(t))].map(shown))];
  for (const q of blanks) {
    q.answer = shown(q.answer);
    q.choices = pick(
      q.answer,
      words.filter((w) => !q.prompt.toLowerCase().includes(w.toLowerCase())),
      true,
    );
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
const LOGISTICS =
  /(?<![\p{L}])(?:due|quiz|test|exam|homework|deadline|syllabus|office hours|examen|tarea|entrega|prova|trabalho|lição de casa)(?![\p{L}])/iu;
const SMALL_TALK =
  /^(?:okay|ok|so|alright|right|hi|hello|good morning|bueno|hola|então|gente|pessoal|thanks|thank you)\b/i;

/** Fill-in-the-blank questions from a lesson's key sentences: blank a defined term, a topic word,
 * or failing those the sentence's most telling word (a long word the lesson repeats). */
function keySentenceBlanks(notes, found, usedTerms, want, seed) {
  const out = [];
  notes.forEach((note, n) => {
    const topicWords = new Set(tokens(note.topic || detectTopic(note.text)));
    const definitionSentences = new Set(found[n].map((d) => d.sentence));
    const counts = new Map();
    for (const w of String(note.text)
      .toLowerCase()
      .match(/[\p{L}][\p{L}'-]{4,}/gu) || [])
      counts.set(w, (counts.get(w) || 0) + 1);
    const candidates = [];
    const list = sentences(note.text);
    for (const [n, s] of list.entries()) {
      if (s.length < 30 || s.length > 220 || definitionSentences.has(s) || SMALL_TALK.test(s) || /\?$/.test(s))
        continue;
      if (LOGISTICS.test(s) || findDates(s).length) continue;
      const parts = s.split(/(\s+)/);
      const word = (p) =>
        p
          .trim()
          .replace(/[^\p{L}'-]/gu, "")
          .toLowerCase();
      // Not a word anyone could guess from the sentence: no stock nouns ("historians", "people") and
      // nothing right after a quantifier ("a lot of _____")
      const content = (p, i) =>
        i > 0 &&
        word(p).length >= 4 &&
        !BLANK_SKIP.has(word(p)) &&
        !STOP.has(word(p)) &&
        !COMMON_NOUNS.has(word(p)) &&
        !/^(?:many|some|most|few|several|all|other|these|those)$/i.test(word(parts[i - 2] || "")) &&
        !/^(?:lot|lots|bunch|number|couple) of$/i.test(`${word(parts[i - 4] || "")} ${word(parts[i - 2] || "")}`);
      const termStems = new Set([...usedTerms].map((w) => w.replace(/e?s$/, "").replace(/e$/, "")));
      let idx = parts.findIndex(
        (p, i) => i > 0 && (usedTerms.has(word(p)) || termStems.has(word(p).replace(/e?s$/, "").replace(/e$/, ""))),
      );
      let strength = 3;
      if (idx < 0) {
        idx = parts.findIndex((p, i) => content(p, i) && topicWords.has(tokens(p)[0]));
        strength = 2;
      }
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
          if (sc > score) {
            score = sc;
            best = i;
          }
        });
        idx = best;
        strength = 1;
      }
      if (idx < 0) continue;
      const answer = parts[idx].replace(/[^\p{L}\d'-]/gu, "");
      if (answer.length < 3) continue;
      parts[idx] = parts[idx].replace(answer, "_____");
      // A sentence that leans on the one before ("The _____ became the symbol of that period") gets it
      // as context, so the question can be answered without the notes open
      const before = list[n - 1];
      const leans =
        /^(?:the|this|that|these|those|it|they|he|she|his|her|their|its|then|so|but|and|el|la|los|las|esto|eso|o|a|os|as|isso|ele|ela)\b/i.test(
          s,
        );
      const context =
        strength < 3 &&
        leans &&
        before &&
        before.length < 200 &&
        !LOGISTICS.test(before) &&
        !findDates(before).length &&
        !before.toLowerCase().includes(answer.toLowerCase())
          ? `${before} `
          : "";
      candidates.push({ q: { kind: "blank", prompt: context + parts.join(""), answer, source: note.title }, strength });
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
  const day = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  const gap = day(testISO) - day(todayISO);
  if (gap < 2) return [];
  const offsets = gap >= 8 ? [7, 3, 1] : gap >= 5 ? [4, 2, 1] : gap >= 3 ? [2, 1] : [1];
  return offsets
    .filter((o) => o < gap)
    .map((o) => {
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

const clean = (s) =>
  String(s)
    .replace(/[\t\n\r]+/g, " ")
    .trim();

/** Export questions for other study sites. Formats: anki, quizlet, csv, gift (Moodle), text. */
export function exportQuiz(questions, format) {
  switch (format) {
    case "anki":
    case "quizlet":
      return questions.map((q) => `${clean(q.prompt)}\t${clean(q.answer)}`).join("\n");
    case "csv":
      return [
        "question,answer",
        ...questions.map((q) => `"${clean(q.prompt).replace(/"/g, '""')}","${clean(q.answer).replace(/"/g, '""')}"`),
      ].join("\n");
    case "gift":
      return questions
        .map((q, i) => {
          const esc = (x) => clean(x).replace(/([~=#{}:])/g, "\\$1");
          const body = q.choices?.length
            ? q.choices.map((c) => `${c === q.answer ? "=" : "~"}${esc(c)}`).join(" ")
            : `=${esc(q.answer)}`;
          return `::Q${i + 1}:: ${esc(q.prompt)} {${body}}`;
        })
        .join("\n\n");
    default:
      return questions.map((q, i) => `${i + 1}. ${clean(q.prompt)}\n   Answer: ${clean(q.answer)}`).join("\n\n");
  }
}
