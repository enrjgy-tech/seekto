// Shape coverage: every way people phrase "X means Y" that we know of, each filled with several terms.
// Prints the shapes the finder misses or gets the wrong way round. Run: node engine/bench/shapes.mjs [--show]
import { findDefinitions } from "../src/index.js";

// term / meaning pairs (the meaning reads as a noun phrase, an "is when" clause and a verb phrase)
const PAIRS = [
  {
    x: "photosynthesis",
    np: "the process plants use to turn light into sugar",
    cl: "when plants turn light into sugar",
    vp: "turn light into sugar",
  },
  {
    x: "opportunity cost",
    np: "the value of the next best thing you give up",
    cl: "when you give up the next best option",
    vp: "give up the next best option",
  },
  {
    x: "recursion",
    np: "a function that calls itself on a smaller problem",
    cl: "when a function calls itself on a smaller problem",
    vp: "call a function from inside itself",
  },
];
const S = []; // [family, template, mode]; {X} term, {Y} meaning; Y chosen by mode: np | cl | vp
const add = (family, mode, ...ts) => ts.forEach((t) => S.push([family, t, mode]));
// copula
add(
  "copula",
  "np",
  "{X} is {Y}.",
  "So {X} is {Y}.",
  "{X} are {Y}.",
  "{X} is basically {Y}.",
  "{X} is essentially {Y}.",
  "{X} is just {Y}.",
  "{X} is really {Y}.",
  "{X} is simply {Y}.",
  "Okay, {X}, it's {Y}.",
  "{X} is nothing more than {Y}.",
  "A {X} is {Y}.",
  "The {X} is {Y}.",
  "{X} is going to be {Y} that we use a lot.",
);
add(
  "copula-clause",
  "cl",
  "{X} is {Y}.",
  "{X} is basically {Y}.",
  "{X} is what happens {Y}.",
  "{X} happens {Y}.",
  "{X} occurs {Y}.",
  "{X}: that's {Y}.",
);
add("kind-of", "np", "{X} is a kind of {Y}.", "{X} is a type of {Y}.", "{X} is one form of {Y}.");
// meaning verbs
add(
  "means",
  "np",
  "{X} means {Y}.",
  "{X} refers to {Y}.",
  "{X} denotes {Y}.",
  "{X} stands for {Y}.",
  "{X} represents {Y}.",
  "{X} signifies {Y}.",
  "{X} is short for {Y}.",
  "{X} is shorthand for {Y}.",
  "{X} is synonymous with {Y}.",
  "{X} is equivalent to {Y}.",
  "{X} is defined as {Y}.",
  "{X} can be defined as {Y}.",
  "{X} can be thought of as {Y}.",
  "{X} is said to be {Y}.",
  "{X} is understood as {Y}.",
  "{X} is considered {Y}.",
);
add("means-vp", "vp", "{X} means to {Y}.", "To {X} is to {Y}.", "To {X} means to {Y}.");
add(
  "describes",
  "np",
  "{X} describes {Y}.",
  "{X} is the process of {Y}.",
  "{X} is the act of {Y}.",
  "{X} is the study of {Y}.",
  "{X} is the idea of {Y}.",
  "The idea of {X} is {Y}.",
  "The whole point of {X} is {Y}.",
  "The concept of {X} is {Y}.",
  "The term {X} means {Y}.",
  "The word {X} means {Y}.",
  "The definition of {X} is {Y}.",
  "The meaning of {X} is {Y}.",
  "{X} refers to {Y}.",
);
// naming forward
add(
  "call-forward",
  "np",
  "We call {Y} {X}.",
  "We call this {X}: {Y}.",
  "We call it {X}, which is {Y}.",
  "{Y} is what we call {X}.",
  "It's what we call {X}: {Y}.",
  "{X}, as we call it, is {Y}.",
  "What we call {X} is {Y}.",
  "What's known as {X} is {Y}.",
  "What I mean by {X} is {Y}.",
  "What do we mean by {X}? {Y}.",
  "By {X} we mean {Y}.",
  "By {X}, I mean {Y}.",
  "When I say {X}, I mean {Y}.",
  "When we say {X}, we mean {Y}.",
  "We refer to {Y} as {X}.",
  "We define {X} to be {Y}.",
  "Let's define {X} as {Y}.",
  "Let {X} denote {Y}.",
  "Define {X}: {Y}.",
  "We say that {X} is {Y}.",
  "The so-called {X} is {Y}.",
  "Technically, {X} is {Y}.",
  "Formally, {X} is {Y}.",
  "In other words, {X} is {Y}.",
  "{X}, that is, {Y}.",
  "{X}, i.e., {Y}.",
  "{X}, in other words, {Y}.",
  "{X} - {Y}.",
  "{X}: {Y}.",
  "{X} = {Y}.",
);
// naming backward
add(
  "call-backward",
  "np",
  "{Y} is called {X}.",
  "{Y} is known as {X}.",
  "{Y} is referred to as {X}.",
  "{Y} is termed {X}.",
  "{Y} is also called {X}.",
  "{Y} is better known as {X}.",
  "{Y}, called {X}, matters a lot.",
  "{Y}, which we call {X}, matters a lot.",
  "{Y} is the definition of {X}.",
  "{Y} is what {X} means.",
  "{Y} is what we mean by {X}.",
  "{Y}, or {X}, matters a lot.",
  "{Y} ({X}) matters a lot.",
  "{Y} is named {X}.",
);
// question-answer
add(
  "question",
  "np",
  "What is {X}? {X} is {Y}.",
  "What is {X}? It's {Y}.",
  "What's {X}? It's {Y}.",
  "What is {X}? That's {Y}.",
  "So what is {X}? Well, it's {Y}.",
  "What does {X} mean? It means {Y}.",
  "How do we define {X}? As {Y}.",
  "What exactly is {X}? Basically, {Y}.",
);
// appositive / aside
add(
  "appositive",
  "np",
  "{X}, which is {Y}, comes up a lot.",
  "{X}, the thing that is {Y}, comes up a lot.",
  "We start with {X}, which is {Y}.",
  "Today it's {X}, which is {Y}.",
  "{X}, and everyone groans here, is {Y}.",
  "{X}, think of it as {Y}.",
  "{X}, that's {Y}.",
  "{X}, it's {Y}.",
  "{X}, basically, is {Y}.",
);
// conditional
add("conditional", "cl", "{X} is {Y}.", "We say something is {X} if {Y}.");
// multi-sentence
add(
  "two-sentence",
  "np",
  "{X}. It's {Y}.",
  "{X}. That's {Y}.",
  "{X}. This is {Y}.",
  "{X}. Basically, {Y}.",
  "{X}. Which is {Y}.",
  "{Y}. That's called {X}.",
  "{Y}. We call that {X}.",
  "{Y}. It's called {X}.",
  "{Y}. This is called {X}.",
  "{Y}. And that's what we call {X}.",
  "{Y}. That's {X}.",
  "{Y}. This is what {X} means.",
);
add(
  "naming-words",
  "np",
  "{X} is the name for {Y}.",
  "{X} is the word for {Y}.",
  "{X} is the term for {Y}.",
  "{X} is a term used to describe {Y}.",
  "{X} is the name we give to {Y}.",
  "{X}, which basically means {Y}.",
  "{X}, which stands for {Y}.",
);
add("used-to", "vp", "{X} is a way to {Y}.", "{X} is a method to {Y}.", "{X} is used to {Y}.");
// negatives: sentences that look like these shapes but define nothing
const NEG = [
  "The meeting is on Friday in the main hall.",
  "I think it is going to be a long day.",
  "That means we should start now.",
  "She is my advisor and a good friend.",
  "This is the part I wanted to talk about.",
  "It's called a day, let's go home.",
  "We call that a win for the team.",
  "What is going on with the projector?",
  "The answer is 42 and the area is going to be pi r squared.",
  "Monday is the first day of the week for most people.",
  "Okay so this is where we're going next.",
  "Here is the problem set and the deadline is on the board.",
  "He was the first one to arrive today.",
  "That is what I meant to say earlier.",
  "The test is going to be hard but fair.",
  "Thanks, that's all for today.",
  "A good place to start is the first chapter.",
  "My favorite thing is when the class gets quiet.",
  "This is a long one so bear with me.",
  "The reason is that I ran out of time.",
  "Our goal is to finish by noon.",
  "The hardest part is the proof at the end.",
  "Everyone is welcome to stay after class.",
  "Next week is going to be busy for everybody.",
  "The first thing is to read the instructions twice.",
  "Yesterday was the first day of the strike.",
  "The best way to learn is to practice a lot.",
  "It means a lot to me that you came.",
  "The paper is due on the 21st.",
  "Professor Lee is the one who wrote the textbook.",
  "Lunch is at noon in the cafeteria.",
  "Her answer was a little off.",
  "That's a good question.",
  "The one on the left is yours.",
  "So what happens next?",
  "We call that a day.",
  "Everybody has a plan until they get punched.",
  "So the idea is to finish early and go home.",
  "It is what it is.",
  "The solution is to try again tomorrow.",
  "My point is that nobody read the chapter.",
];
const fill = (t, p, mode) =>
  t
    .replace(/\{X\}/g, p.x)
    .replace(/\{Y\}/g, p[mode])
    .replace(/(^|[.?!] )([a-z])/g, (_, a, c) => a + c.toUpperCase());
const show = process.argv.includes("--show");
const same = (a, b) => (a || "").toLowerCase().includes(b.split(" ")[0].toLowerCase());
const byFamily = {};
const miss = [];
for (const [family, t, mode] of S) {
  let ok = 0,
    bad = 0;
  for (const p of PAIRS) {
    const text = fill(t, p, mode) + " Okay.";
    const d = findDefinitions(text);
    const hit = d.find(
      (x) =>
        same(x.term, p.x) &&
        x.definition.toLowerCase().includes(p[mode].split(" ").slice(-2).join(" ").toLowerCase().replace(/[.,]/g, "")),
    );
    if (hit) ok++;
    else {
      bad++;
      miss.push(
        `${family} | ${fill(t, p, mode)}  ->  ${d[0] ? d[0].term + " :: " + d[0].definition.slice(0, 40) : "(nothing)"}`,
      );
    }
  }
  (byFamily[family] ||= { ok: 0, n: 0 }).ok += ok;
  byFamily[family].n += ok + bad;
}
let tot = 0,
  hit = 0;
for (const [f, v] of Object.entries(byFamily)) {
  console.log(f.padEnd(16), `${v.ok}/${v.n}`);
  tot += v.n;
  hit += v.ok;
}
console.log(`shapes caught: ${hit}/${tot} (${Math.round((100 * hit) / tot)}%)`);
const falseHits = NEG.filter((n) => findDefinitions(n + " Okay.").length);
console.log(`non-definitions wrongly offered: ${falseHits.length}/${NEG.length}`);
falseHits.forEach((n) => console.log("   FALSE:", n));
if (show) miss.forEach((m) => console.log("  MISS", m));
