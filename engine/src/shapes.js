// The ways people phrase "X means Y", one row each. A row is [name, regex, how to read the match].
// Add a row here to teach Seekto a new phrasing, then add the sentence to engine/bench/shapes.mjs.
// "term" and "meaning" are the two named groups every row must have (the order in the sentence can be either).
import { COMMON_WORDS } from "./common-words.js";
const T = "(?:(?:an?|the)\\s+)?(?<term>[\\p{L}][\\p{L}0-9'’-]*(?:\\s+[\\p{L}0-9'’-]+){0,3}?)";
const SYM =
  "(?<term>[A-Za-z]|[A-Z][a-z]?\\d|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|rho|omega|pi|tau|phi|psi|eta|kappa|[α-ωΑ-Ω])";
const MEASURE =
  "(?:rate|constant|amount|force|energy|price|quantity|quotient|coefficient|charge|mass|velocity|temperature|pressure|volume|concentration|radius|angle|distance|time|length|width|height|speed|probability|variance|mean|total|cost|demand|supply|elasticity|income|wage|interest|growth|frequency|wavelength|momentum|acceleration|current|voltage|resistance|capacity|density|weight|work|power|entropy|enthalpy|elasticity|slope|intercept|variable|parameter|function|number of)";
const D = "(?<meaning>.{6,})";
const END = "[.!?]*$";
const AS_BEFORE = "(?:so |and |okay,? |well,? |now,? |right,? )?";
const SAY =
  "(?:we|i|you|they|people|scientists|mathematicians|economists|psychologists|biologists|chemists|physicists|engineers|programmers)";

// a leading adverb does not change what a sentence says: "Technically, X is Y"
export const SHAPE_LEAD =
  /^(?:technically|formally|essentially|basically|simply put|put simply|strictly speaking|roughly speaking|in other words|in short|in simple terms|in plain english|to put it simply|more precisely|specifically|generally|usually|typically|really|actually|so|well|okay|ok|now|right|and),?\s+/i;

const ROWS = [
  // forward naming
  [
    "we-call-colon",
    `^${AS_BEFORE}${SAY}(?:'ll| will| can| could)? call (?:this|that|it|these|those|them)?\\s*${T}\\s*(?:[,:;–—-]|\\s)\\s*(?:which is |that is |meaning |that means |and that is |and that's )?${D}${END}`,
    "forward",
    /^(?:we|i|you)\b.*\bcall (?:this|that|it)\b/i,
  ],
  [
    "we-call-meaning-first",
    `^${SAY} call (?!this\\b|that\\b|it\\b|these\\b|those\\b|them\\b)(?<meaning>(?:\\S+\\s+){4,}?)(?:a |an |the )?(?<term>[\\p{L}-]+(?: [\\p{L}-]+){0,2})${END}`,
    "meaning-first",
  ],
  [
    "what-we-call",
    `^(?:what|whatever) (?:${SAY}|people) (?:call|mean by|refer to as|term|label) ${T}\\s+(?:is|are|means?|refers? to)\\s+${D}${END}`,
  ],
  [
    "its-what-we-call",
    `^(?:it's|it is|that's|that is|this is) (?:exactly |just )?(?:what|how) (?:${SAY}|people) (?:call|mean by|refer to as|term|label) ${T}\\s*[:,–—-]\\s*(?:which is |that is )?${D}${END}`,
  ],
  ["whats-called", `^what(?:'s| is| are) (?:called|known as|termed|named) ${T}\\s+(?:is|are|means?)\\s+${D}${END}`],
  [
    "what-i-mean",
    `^what (?:i|we) (?:mean|meant) by (?:(?:them|it|this|that|these|those) being )?${T}\\s+(?:is|are|means?)\\s+(?:that\\s+)?${D}${END}`,
  ],
  ["by-we-mean", `^by ${T},?\\s+(?:${SAY}) (?:just |simply |only |really )?(?:mean|meant|refer to)\\s+${D}${END}`],
  [
    "when-i-say",
    `^when (?:${SAY}) say ${T},?\\s+(?:${SAY}) (?:just |simply |only |really )?(?:mean|meant)\\s+${D}${END}`,
  ],
  [
    "meaning-is-what-we-call",
    `^(?<meaning>.{12,}?)\\s+(?:is|are)\\s+(?:exactly |just |precisely )?(?:what|how) (?:${SAY}|people) (?:call|mean by|refer to as|term|label)\\s+${T}${END}`,
    "meaning-first",
  ],
  [
    "meaning-is-what-term-means",
    `^(?<meaning>.{12,}?)\\s+(?:is|are)\\s+(?:exactly |just |precisely )?(?:what|how) ${T}\\s+(?:means|is|refers to|stands for)${END}`,
    "meaning-first",
  ],
  [
    "we-refer-to-as",
    `^${SAY} (?:refer to|describe|label|name|term) (?<meaning>.{8,}?)\\s+as\\s+${T}${END}`,
    "meaning-first",
  ],
  [
    "we-define",
    `^${AS_BEFORE}(?:${SAY}|let's|let us)(?: will| can| could| shall)? (?:define|say that|say) ${T}\\s+(?:as|to be|is|are)\\s+${D}${END}`,
    undefined,
    /^(?:we|let's|let us|i)\b.*\b(?:define|say)\b/i,
  ],
  ["define-colon", `^define ${T}\\s*[:,–—-]?\\s+(?:as\\s+)?${D}${END}`],
  ["let-denote", `^let ${T}\\s+(?:denote|represent|stand for|be)\\s+${D}${END}`],
  [
    "can-be-defined",
    `^${T}\\s+(?:can|could|may) (?:be|also be) (?:defined|thought of|described|seen|viewed|understood|read|interpreted) as\\s+${D}${END}`,
  ],
  ["so-called", `^the so[- ]called ${T}\\s+(?:is|are)\\s+${D}${END}`],
  // meaning verbs
  [
    "said-to-be",
    `^${T}\\s+(?:is|are)\\s+(?:said to be|considered|considered to be|understood as|understood to be|regarded as|seen as|viewed as|taken to be|short for|shorthand for|an abbreviation (?:of|for)|an acronym for|synonymous with|equivalent to|another word for|another name for|a fancy word for|a fancy name for)\\s+${D}${END}`,
  ],
  ["denotes", `^${T}\\s+(?:denotes|signifies|represents|implies|designates|connotes)\\s+${D}${END}`],
  ["means-to", `^(?:to )?${T}\\s+(?:means|is) to\\s+${D}${END}`, "verb"],
  [
    "happens-when",
    `^${T}\\s+(?:happens|occurs|arises|results|takes place|is triggered)\\s+(?<meaning>(?:when|if|whenever|once|as soon as)\\s.{6,})${END}`,
  ],
  [
    "the-term",
    `^the (?:idea|concept|notion|term|word|principle|definition|meaning|phrase|expression|name) (?:of|behind|for) ${T}\\s+(?:is|means|refers to|are|denotes)\\s+${D}${END}`,
  ],
  [
    "is-the-process",
    `^${T}\\s+(?:is|are)\\s+(?<meaning>the (?:process|act|study|science|art|practice|method|idea|concept|measure|amount|number|ratio|rate|degree|ability|tendency|property|quality|state|condition) (?:of|by which|that|in which|where|for)\\s.{4,})${END}`,
  ],
  // appositive / glossary punctuation
  [
    "i-e",
    `^${T}\\s*,\\s*(?:i\\.e\\.|ie|that is|in other words|meaning|or in other words|namely|which means|which is to say),?\\s+${D}${END}`,
  ],
  [
    "colon-glossary",
    `^(?<term>[\\p{L}][\\p{L}0-9'’-]*(?:\\s+[\\p{L}0-9'’-]+){0,3}?)\\s*[:=–—]\\s*(?<meaning>(?:an?|the|when|where|how|what|one|something|any|every|each|those|it|they|to)\\s.{6,})${END}`,
  ],
  [
    "dash-glossary",
    `^(?<term>[\\p{L}][\\p{L}0-9'’-]*(?:\\s+[\\p{L}0-9'’-]+){0,3}?)\\s+[-–—]\\s+(?<meaning>(?:an?|the|when|where|how|what|one|something|any|every|each|those|it|they|to)\\s.{6,})${END}`,
  ],
  // meaning first
  [
    "named-by-also",
    `^(?<meaning>.{12,160}?),?\\s+(?:which |that )?(?:is|are)\\s+(?:also |better |often |commonly |sometimes |usually )?(?:called|known as|termed|referred to as|named|labeled|labelled)\\s+${T}${END}`,
    "meaning-first",
  ],
  [
    "called-aside",
    `^(?<meaning>(?:\\S+\\s+){4,}?\\S+?),\\s+(?:which (?:${SAY}) call|which is (?:called|known as)|also called|also known as|called|known as|termed)\\s+${T}\\s*(?:,|$)`,
    "meaning-first",
  ],
  [
    "conditional-we-say",
    `^${SAY} say (?:that )?(?:something|an? [\\p{L}]+|it) is ${T}\\s+(?:if|when)\\s+(?<meaning>.{6,})${END}`,
  ],
  ["is-what-happens", `^${T}\\s+is what happens\\s+(?<meaning>(?:when|if|whenever)\\s.{6,})${END}`],
  [
    "name-for",
    `^${T}\\s+(?:is|are)\\s+(?:the|a|an)\\s+(?:name|word|term|label|phrase|expression|symbol|notation|abbreviation)\\s+(?:we give (?:to |for )?|we use (?:for |to describe |to refer to )?|used (?:for|to describe|to refer to)|for|that means|that describes|that refers to|given to)\\s*${D}${END}`,
  ],
  [
    "stands-for-aside",
    `^${T}\\s*,\\s*which\\s+(?:basically |just |essentially |simply )?(?:stands for|means|is short for|refers to|is an abbreviation for)\\s+${D}${END}`,
  ],
  [
    "is-used-to",
    `^${T}\\s+(?:is|are)\\s+(?<meaning>(?:used|what we use|how we|what you use|how you|a tool|a method|a technique|a way) (?:to|for|of|that)\\s.{6,})${END}`,
  ],
  [
    "which-aside",
    `(?:^|[\\s,])(?:about|at|with|have|has|had|got|of|for|call|consider|introduce|define|between)\\s+(?:an?\\s+|the\\s+)?(?<term>[\\p{L}][\\p{L}'’-]*(?:\\s+[\\p{L}'’-]+){0,2}),\\s*which\\s+(?:is|are)\\s+(?:basically |just |essentially )?(?<meaning>(?:defined as|known as|called|the (?:amount|number|set|process|study|measure|ratio|rate|sum|total|idea|concept|way|name|value|price|quantity|ability|degree|collection|part|type|kind|form)(?: of)?|an? (?:measure|type|kind|form|set|process|method|way|term|word|name|number|rate)(?: of)?)\\s.{4,}?)(?=[.?!]|$)`,
  ],
  [
    "that-means",
    `\\b(?:know|knew|knowing|say|said|remember|recall|learned|noted?|see|seen) that\\s+${T}\\s+means\\s+(?<meaning>.+?)(?=\\s+and\\s+[\\p{L}]+\\s+means|[.!?]*$)`,
  ],
  // symbols: one letter (or a Greek name) standing for a quantity
  [
    "sym-stands-for",
    `^(?:(?:and|so|just|remember|remember that|note that|recall that|keep in mind that) )*(?:the )?(?:(?:capital|lowercase|little|big|small|upper case|lower case) |letter |symbol )?${SYM}\\s+(?:stands for|is short for|represents|denotes|is shorthand for|is the symbol for|is the letter for)\\s+${D}${END}`,
  ],
  [
    "sym-is-quantity",
    `^(?:(?:and|so|here|now|recall|remember) )*(?:the )?(?:(?:capital|lowercase|little|big|small) |letter |symbol )?${SYM}\\s+(?:is|are|means)\\s+(?<meaning>(?:the|our|your|a|an)\\s+(?:\\S+\\s+){0,3}?${MEASURE}\\b.*)${END}`,
  ],
  ["sym-let", `^let ${SYM}\\s+(?:be|denote|represent|stand for|equal)\\s+${D}${END}`],
  [
    "sym-where",
    `^(?:where|here|and|with|and here|and where|and with)\\s+${SYM}\\s+(?:is|are|represents|denotes|stands for)\\s+(?!\\d)${D}${END}`,
  ],
  // implied facts: "The president is elected for four years" says what a president is, by one property
  [
    "fact-passive",
    `^${T}\\s+(?:is|are)\\s+(?<meaning>(?:elected|appointed|chosen|selected|paid|taxed|required|limited|capped|renewed|held|measured)\\s+(?:for|every|each|once|to|by|at|within|up to)\\s+.{3,})${END}`,
  ],
  [
    "fact-lasts",
    `^${T}\\s+(?<meaning>(?:lasts?|runs? for|spans?|takes?|covers?)\\s+(?:about |around |roughly |exactly |up to |at least |at most |only )?(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|a hundred)\\s+(?:years?|months?|days?|weeks?|hours?|minutes?|seconds?|terms?|cycles?|generations?|semesters?))${END}`,
  ],
  [
    "fact-has-count",
    `^${T}\\s+(?:has|have|consists of|contains|is made up of|is composed of)\\s+(?<meaning>(?:exactly |only )?(?:\\d+|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|a hundred)\\s+(?:[\\p{L}-]+\\s+){0,2}[\\p{L}-]+)${END}`,
  ],
  [
    "it-means-youre",
    `^(?<meaning>(?:when|if|once)\\s+(?:you|we|it)\\s+(?:have|has|see|get|write|say)\\s+.{2,40}?),\\s+(?:it|that|this)\\s+means\\s+(?:you're|you are|it's|it is|we're|we are)\\s+${T}(?:,\\s+(?:because|since|as)\\s+.{8,}?)?${END}`,
  ],
  [
    "is-what-we-call-define",
    `^.{3,}?\\s+(?:is|are)\\s+(?:what|how) ${SAY} call ${T},\\s+(?:which|that)\\s+${SAY}\\s+(?:define|describe)\\s+(?:it\\s+)?as,?\\s+(?:we define .{3,40}?\\s+as\\s+)?${D}${END}`,
  ],
  [
    "what-we-call-dash",
    `^.{0,60}?\\b(?:what|something|things) ${SAY} call ${T}\\s*(?:(?:--|—|–),?\\s*(?:that |which )?|,\\s*(?:that|which) )${D}${END}`,
  ],
  [
    "its-a-known-as",
    `^(?:it's|it is|this is|that's|that is|these are|those are|they are|they're)\\s+(?<meaning>(?:an?|the)\\s+.{4,}?)\\s+(?:known as|called|named|termed)\\s+${T}${END}`,
    "meaning-first",
  ],
  ["we-define-symbol", `^${AS_BEFORE}${SAY} define ${T}(?:,\\s+[\\p{L}]{1,12})?\\s+as\\s+${D}${END}`],
  ["is-what-means", `^(?<meaning>.{12,}?)\\s+is what ${T}\\s+(?:means|is)${END}`, "meaning-first"],
];
const NOT_TERM_HEAD =
  /^(?:note|reminder|example|examples|answer|answers|homework|question|questions|step|steps|hint|tip|tips|warning|important|remember|todo|summary|solution|problem|exercise|chapter|section|page|slide|figure|table|case|option|part|item|next|first|second|third|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|agenda|topic|goal|objective|task|action|decision|update|announcement|quiz|exam|test)\b/i;
const PRON =
  /^(?:i|we|you|he|she|it|they|this|that|these|those|there|here|what|who|which|one|everyone|someone|nobody|anything|something|nothing)$/i;

// "A set is called open if every point has a neighbourhood inside it", "A function is continuous if ...":
// the name is the adjective plus the noun ("open set"), the meaning is the whole sentence.
const ADJ_IF =
  /^(?:an?|the) (?<noun>[\p{L}-]{3,}(?: [\p{L}-]{3,})?) (?:is|are) (?:called |said to be |defined to be |known as |termed )?(?<adj>[\p{L}-]{3,}) (?:if|iff|when|whenever|provided that|exactly when)\s+(?<rest>.{8,}?)[.!?]*$/iu;

/** Read one cleaned sentence with the shape table: [term, meaning, keepCase, rule] or null. */
export function shapeDefinition(sentence) {
  const c = sentence.replace(SHAPE_LEAD, "").replace(SHAPE_LEAD, "").trim();
  if (/\?$/.test(c)) return null; // a question asks; it does not define
  const adj = ADJ_IF.exec(c)?.groups;
  if (
    adj &&
    !/^(?:a|an|the|this|that|not|only|also|just|very|really|always|usually)$/i.test(adj.adj) &&
    !PRON.test(adj.noun)
  )
    return [`${adj.adj} ${adj.noun}`, c.replace(/[.!?]+$/, ""), undefined, "adj-if"];
  for (const [name, source, order, guard] of ROWS) {
    if (guard && !guard.test(c)) continue;
    const m = new RegExp(source, "iu").exec(c);
    if (!m?.groups) continue;
    let { term, meaning } = m.groups;
    term = term.trim().replace(/[.,;:]+$/, "");
    meaning = meaning.trim();
    // "We call the value of the next best thing you give up opportunity cost": the name is the last word or two
    if (order === "tail") {
      const words = `${meaning} ${term}`.trim().split(/\s+/);
      const FUNC = /^(?:up|of|to|in|on|at|for|with|from|by|the|a|an|and|or|that|which|is|are|as|into|out|off|over)$/i;
      const two = words.slice(-2);
      const take =
        words.length > 6 && two.every((w) => !COMMON_WORDS.has(w.toLowerCase()))
          ? 2
          : FUNC.test(words.at(-3) || "") && words.length > 6
            ? 2
            : 1;
      term = words.slice(-take).join(" ");
      meaning = words.slice(0, -take).join(" ");
      order = "meaning-first";
    }
    // a meaning that starts with "this" or "what he did" points at something said elsewhere; it is not a meaning
    if (
      order === "meaning-first" &&
      /^(?:so |and |but |basically,? )*(?:(?:what|it|he|she|they|there|here|which|we|i|you)\b|(?:this|that|these|those)\s+(?:is|was|are|were|'s)\b)/i.test(
        meaning,
      )
    )
      continue;
    if (/^(?:what-we-call|what-i-mean|by-we-mean|when-i-say)$/.test(name))
      meaning = meaning.replace(/^that\s+(?:basically\s+)?/i, "");
    term = term.replace(/^(?:them|it|this|that|these|those) being\s+/i, "");
    if (order === "verb") term = term.replace(/^to\s+/i, "");
    if (/\b(?:is|are|was|were|what|which|that|how|when|where|who|do|does|did|if)\b/i.test(term)) continue;
    if (!term || PRON.test(term) || NOT_TERM_HEAD.test(term) || term.split(/\s+/).length > 4) continue;
    if (/^(?:to|how)\s/i.test(meaning) && /^(?:solution|plan|point|answer|trick|key|idea|goal)$/i.test(term)) continue;
    return [term, meaning, undefined, name];
  }
  return null;
}
