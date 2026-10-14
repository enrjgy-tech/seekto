// How people really talk: corrections, reschedules, cancellations, past mentions, ordinals,
// day-first dates and Portuguese. Many of these came from reviewers who tried to break the engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findEvents,
  findDefinitions,
  findActionItems,
  keyTerms,
  keySentences,
  sections,
  studyNotes,
} from "../src/index.js";

const ref = new Date(2026, 9, 12, 12); // Monday, October 12, 2026
const dates = (text, opts = {}) => findEvents(text, { ref, ...opts }).map((e) => e.date);

test("relative days", () => {
  assert.deepEqual(dates("The test is a week from tomorrow."), ["2026-10-20"]);
  assert.deepEqual(dates("Your midterm is two weeks from today."), ["2026-10-26"]);
  assert.deepEqual(dates("So the quiz is the day after tomorrow."), ["2026-10-14"]);
  assert.deepEqual(dates("The essay is due in 3 days."), ["2026-10-15"]);
  assert.deepEqual(dates("Your final reflection is due next week."), ["2026-10-19"]);
  assert.deepEqual(dates("Get the worksheet done by the end of the week."), ["2026-10-16"]);
});

test("weekdays: this, next, next week's, the one after that", () => {
  assert.deepEqual(dates("Exam next week on Thursday."), ["2026-10-22"]);
  assert.deepEqual(dates("Next week's quiz is on Wednesday, not Tuesday like it says in the syllabus."), [
    "2026-10-21",
  ]);
  assert.deepEqual(dates("There's a quiz on Tuesday, then the chapter test the Tuesday after that."), [
    "2026-10-13",
    "2026-10-20",
  ]);
  assert.deepEqual(dates("Read chapter 6 for Wednesday."), ["2026-10-14"]);
  assert.deepEqual(dates("The lab internals are on Thursday and Friday."), ["2026-10-15", "2026-10-16"]);
  // "next Friday" said on a Friday is a week later, not two
  assert.deepEqual(
    findEvents("Midterm two is next Friday at 9am.", { ref: new Date(2026, 10, 13, 12) }).map((e) => e.date),
    ["2026-11-20"],
  );
});

test("ordinals and numbers", () => {
  assert.deepEqual(dates("Homework is due the 3rd."), ["2026-11-03"]);
  assert.deepEqual(dates("The test is gonna be on the 20th."), ["2026-10-20"]);
  assert.deepEqual(dates("Exam on Tuesday the 20th."), ["2026-10-20"]);
  assert.deepEqual(dates("Read the 3rd chapter for the quiz."), []);
  assert.deepEqual(dates("Viva voce for the project will be on 4th and 5th November."), ["2026-11-04", "2026-11-05"]);
  // Day first when the first number can't be a month, or outside the US
  assert.deepEqual(dates("Exam is on 20/10."), ["2026-10-20"]);
  assert.deepEqual(dates("The lab write-up deadline is 6/11.", { locale: "en-GB" }), ["2026-11-06"]);
  assert.deepEqual(dates("The lab write-up deadline is 11/6."), ["2026-11-06"]);
});

test("a weekday with a day number, British phrasing, spelled-out ordinals", () => {
  assert.deepEqual(dates("Bueno chavos, el primer parcial es el jueves 22.", { locale: "es-MX" }), ["2026-10-22"]);
  assert.deepEqual(dates("Entréguenme el ensayo a más tardar el viernes 23.", { locale: "es-MX" }), ["2026-10-23"]);
  assert.deepEqual(dates("A prova é na quinta 22.", { locale: "pt-BR" }), ["2026-10-22"]);
  assert.deepEqual(dates("The quiz is Thursday 22.", { locale: "en-GB" }), ["2026-10-22"]);
  assert.deepEqual(dates("Queda para la otra semana, el examen, el miércoles.", { locale: "es-MX" }), ["2026-10-21"]);
  assert.deepEqual(dates("Your essay is due Friday week.", { locale: "en-GB" }), ["2026-10-23"]);
  assert.deepEqual(dates("The test is a fortnight today.", { locale: "en-GB" }), ["2026-10-26"]);
  assert.deepEqual(dates("The mock is a week on Thursday.", { locale: "en-GB" }), ["2026-10-22"]);
  assert.deepEqual(dates("Homework is due the twenty first."), ["2026-10-21"]);
  assert.deepEqual(dates("The essay is due by midnight on the twentieth."), ["2026-10-20"]);
  assert.deepEqual(dates("The paper is due November third."), ["2026-11-03"]);
  // Not dates
  assert.deepEqual(dates("The quiz on Friday has 20 questions."), ["2026-10-16"]);
  assert.deepEqual(dates("Read the third chapter for the quiz."), []);
  assert.equal(findEvents("Homework: finish questions 1 to 5, due Monday.", { ref })[0].title, "Homework due");
});

test("end of the month, dates relative to another, long counts, 'now'", () => {
  assert.deepEqual(dates("Your care plans are due end of the month."), ["2026-10-31"]);
  assert.deepEqual(dates("La tarea hay que entregarla a fin de mes.", { locale: "es" }), ["2026-10-31"]);
  assert.deepEqual(dates("La entrega del TP es dentro de quince días.", { locale: "es" }), ["2026-10-27"]);
  assert.deepEqual(dates("O trabalho é pra daqui a quinze dias.", { locale: "pt-BR" }), ["2026-10-27"]);
  assert.deepEqual(
    dates("Bom, a P2 vai ser no dia vinte e dois de outubro, e a substitutiva uma semana depois.", { locale: "pt-BR" }),
    ["2026-10-22", "2026-10-29"],
  );
  assert.deepEqual(dates("Your presentations are the 20th, and the slides are due the day before."), [
    "2026-10-20",
    "2026-10-19",
  ]);
  assert.deepEqual(dates("Isso vai cair na prova final, que é dia catorze.", { locale: "pt-BR" }), ["2026-10-14"]);
  assert.deepEqual(dates("The pharm exam got moved. It was gonna be on the 20th and now it's on the 27th."), [
    "2026-10-27",
  ]);
  assert.deepEqual(dates("We didn't get to the quiz Monday because of the fire drill, it's on Friday now."), [
    "2026-10-16",
  ]);
  assert.deepEqual(dates("The grade nine French quiz is Tuesday.", { locale: "en-CA" }), ["2026-10-13"]);
  assert.deepEqual(dates("Report cards go home tomorrow."), []);
  assert.deepEqual(dates("The museum trip is in 3 days, bring a bag lunch."), ["2026-10-15"]);
});

test("school words from the UK, India, Mexico and Brazil", () => {
  const title = (t, locale) => findEvents(t, { ref, locale })[0]?.title;
  assert.deepEqual(dates("Your assessment is next Wednesday.", { locale: "en-GB" }), ["2026-10-21"]);
  assert.equal(title("The internal assessment is on 5th November.", "en-IN"), "Internal assessment");
  assert.deepEqual(dates("CIA 2 is next week Wednesday.", { locale: "en-IN" }), ["2026-10-21"]);
  assert.equal(title("Submit the lab record by Monday.", "en-IN"), "Lab record");
  assert.deepEqual(dates("El extraordinario es el 15 de enero.", { locale: "es-MX" }), ["2027-01-15"]);
  assert.equal(title("Bueno chavos, el primer parcial es el jueves 22.", "es-MX"), "Primer parcial");
  assert.equal(title("A entrega do relatório do lab é na sexta.", "pt-BR"), "Entrega do relatório do lab");
  // Cancelled with a promise to reschedule later: nothing goes on the calendar
  assert.deepEqual(
    dates("The speaking assessment has been cancelled for Friday, we'll let you know when it's rescheduled.", {
      locale: "en-GB",
    }),
    [],
  );
});

test("traps from real recorded lectures", () => {
  assert.deepEqual(dates("The mid-term will be held in class on October 17th; that is also in your syllabus."), [
    "2026-10-17",
  ]);
  assert.deepEqual(dates("The first problem set will go out on Monday but it will be due ten days later."), [
    "2026-10-29",
  ]);
  assert.deepEqual(
    dates("Please don't anybody tell me late - any time after today you didn't know when the mid-term was."),
    [],
  );
  assert.deepEqual(dates("But I will tell you that the labs are on Monday and Tuesday afternoon."), []);
  assert.deepEqual(
    findDefinitions(
      "There's something called sperm competition where the sperm of several males compete inside one female.",
    ).map((d) => d.term),
    ["Sperm competition"],
  );
  assert.deepEqual(
    findDefinitions("There's a whole group of beetles called dung beetles.").map((d) => d.term),
    [],
  );
});

test("corrections, reschedules, cancellations and the past", () => {
  assert.deepEqual(dates("The vocab quiz is Wednesday, no, Thursday. Thursday, sorry."), ["2026-10-15"]);
  assert.deepEqual(dates("The test is the 16th. No, wait, the 19th, sorry."), ["2026-10-19"]);
  assert.deepEqual(dates("The exam is not on Friday anymore, it moved to Tuesday."), ["2026-10-13"]);
  assert.deepEqual(dates("Exam moved from Friday to next Tuesday."), ["2026-10-20"]);
  assert.deepEqual(dates("The essay was due today, but I'm giving everybody until Friday."), ["2026-10-16"]);
  assert.deepEqual(dates("There's no quiz on Friday."), []);
  assert.deepEqual(dates("The quiz that was supposed to be Wednesday is cancelled."), []);
  assert.deepEqual(dates("Last Friday we had a quiz."), []);
  assert.deepEqual(dates("The paper was due Monday, so it's already late."), []);
  assert.deepEqual(dates("I'll post the grades for the midterm by Friday."), []);
  assert.deepEqual(dates("Essays come back to you Monday with comments."), []);
  assert.deepEqual(
    dates("Coursework drafts are due back to me on Monday 9 November, not before.", { locale: "en-GB" }),
    ["2026-11-09"],
  );
});

test("titles read like a planner", () => {
  const title = (t) => findEvents(t, { ref })[0]?.title;
  assert.equal(title("Don't forget, homework is due tomorrow."), "Homework due");
  assert.equal(title("The final project is due Friday."), "Final project due");
  assert.equal(findEvents("The final project is due Friday.", { ref })[0].type, "assignment");
  assert.equal(title("Read chapters three and four for Thursday."), "Read chapters three and four");
});

test("Portuguese", () => {
  const pt = (t) => dates(t, { locale: "pt-BR" });
  assert.deepEqual(pt("A prova é na sexta-feira."), ["2026-10-16"]);
  assert.deepEqual(pt("O trabalho em grupo é pra 20/10, impresso."), ["2026-10-20"]);
  assert.deepEqual(pt("A entrega do relatório é dia 20, pelo Moodle."), ["2026-10-20"]);
  assert.deepEqual(pt("Sexta-feira que vem tem a entrega do projeto."), ["2026-10-23"]);
  assert.deepEqual(pt("A lista de exercícios é pra daqui a duas semanas."), ["2026-10-26"]);
  assert.deepEqual(pt("Depois de amanhã é o seminário de vocês."), ["2026-10-14"]);
  assert.deepEqual(pt("Não tem prova nessa sexta, gente, a prova é só na sexta que vem."), ["2026-10-23"]);
  assert.deepEqual(pt("A prova de cálculo foi adiada, não vai ser mais na terça, vai ser na quinta."), ["2026-10-15"]);
  assert.deepEqual(pt("A quinta questão da prova vale dois pontos."), []);
  assert.deepEqual(pt("A prova é no dia 28 de outubro."), ["2026-10-28"]);
  assert.deepEqual(pt("A P1 é dia 28/10."), ["2026-10-28"]);
  assert.deepEqual(pt("A P2 é dia vinte e cinco de novembro."), ["2026-11-25"]);
  assert.deepEqual(pt("Não tem prova no dia 20."), []);
  assert.equal(
    findEvents("A prova não é mais na sexta, passou pra segunda.", { ref, locale: "pt-BR" })[0].title,
    "Prova",
  );
  assert.deepEqual(dates("El examen es el quince de noviembre.", { locale: "es" }), ["2026-11-15"]);
  assert.equal(findEvents("A prova de cálculo é na sexta.", { ref, locale: "pt-BR" })[0].title, "Prova de cálculo");
});

test("definitions with asides, fillers and a deadline in the same sentence", () => {
  const terms = (t) => findDefinitions(t).map((d) => d.term);
  assert.deepEqual(
    terms("Recursion, and everyone groans here, is just a function that calls itself on a smaller problem."),
    ["Recursion"],
  );
  assert.deepEqual(
    terms("Entonces, eh, una variable aleatoria es básicamente una función que asigna un número a cada resultado."),
    ["Variable aleatoria"],
  );
  assert.deepEqual(terms("Pessoal, osmose, né, é a passagem de água através de uma membrana."), ["Osmose"]);
  assert.deepEqual(terms("Okay, so afterload, think of it as the resistance the left ventricle has to push against."), [
    "Afterload",
  ]);
  assert.deepEqual(terms("What do I mean by a priori? Knowledge you can have without checking the world."), [
    "A priori",
  ]);
  assert.deepEqual(
    terms("Hoy empezamos con elasticidad, que es qué tanto cambia la cantidad demandada cuando cambia el precio."),
    ["Elasticidad"],
  );
  assert.equal(
    findDefinitions(
      "Sepsis is basically the body's response to an infection damaging its own organs, and you'll need it for the quiz on Thursday.",
    )[0].definition,
    "the body's response to an infection damaging its own organs",
  );
  assert.deepEqual(terms("Okay, a metaphor compares two things without using like or as."), ["Metaphor"]);
  assert.deepEqual(terms("Le llamamos inflación al aumento generalizado de los precios."), ["Inflación"]);
  // Not definitions
  assert.deepEqual(terms("The winter concert was awesome last night, thank you band kids."), []);
  assert.deepEqual(terms("Fall picture day is Thursday, so dress nice."), []);
  assert.deepEqual(terms("Gente, a AV1 foi adiada, vai ser na segunda."), []);
  assert.deepEqual(terms("Elasticity is something we'll define properly on Thursday."), []);
});

test("definitions the way teachers say them", () => {
  const terms = (t) => findDefinitions(t).map((d) => d.term);
  assert.deepEqual(terms("Okay so mitosis, basically, it's when the cell splits into two identical daughter cells."), [
    "Mitosis",
  ]);
  assert.deepEqual(terms("Photosynthesis is how plants turn light into energy."), ["Photosynthesis"]);
  assert.deepEqual(terms("ROI, return on investment, is just what you got back divided by what you put in."), ["ROI"]);
  assert.deepEqual(terms("So what is an API? It's basically a contract between two programs."), ["API"]);
  assert.deepEqual(terms("Okay, classical conditioning. That's learning by association."), ["Classical conditioning"]);
  assert.deepEqual(terms("We call this opportunity cost, right? The value of the next best thing you gave up."), [
    "Opportunity cost",
  ]);
  assert.deepEqual(terms("Densidade, gente, é a massa dividida pelo volume, tá?"), ["Densidade"]);
  // Not definitions
  assert.deepEqual(terms("Friday is a big day for us."), []);
  assert.deepEqual(terms("The answer is twelve."), []);
  assert.deepEqual(terms("The test is a week from tomorrow."), []);
  assert.deepEqual(terms("Big O is the part everyone loses points on in the final."), []);
  assert.deepEqual(terms("So basically entropy, which is hard, we'll get to later."), []);
});

test("tasks given to someone mid-sentence", () => {
  const items = (t) => findActionItems(t, { ref }).map((a) => [a.owner, a.due]);
  assert.deepEqual(
    items("Drywall crew shows up Thursday, so Luis, I need that inspection signed off by Thursday morning."),
    [["Luis", "2026-10-15"]],
  );
  assert.deepEqual(items("Okay, Dana, the water rates story is yours, I want a draft by Friday."), [
    ["Dana", "2026-10-16"],
  ]);
  assert.deepEqual(
    items("Hannah, Ben, I need the photos from you two by the 20th, and I'll write the intro tomorrow."),
    [
      ["Hannah and Ben", "2026-10-20"],
      ["Me", "2026-10-13"],
    ],
  );
  assert.deepEqual(items("Kofi and Mei, you two own the seating chart, and we need it locked by 10/30."), [
    ["Kofi and Mei", "2026-10-30"],
  ]);
  assert.deepEqual(items("From now on, Marco, you're doing lockup."), [["Marco", null]]);
  assert.deepEqual(items("Rachel's out, so Tom, can you take the customer call on Thursday instead of her?"), [
    ["Tom", "2026-10-15"],
  ]);
  assert.equal(
    findActionItems("Priya, you're pulling her drain tomorrow morning.", { ref })[0].task,
    "Pull her drain tomorrow morning",
  );
  assert.deepEqual(items("Before we adjourn, can someone volunteer to draft the letter to parents?"), [[null, null]]);
  assert.deepEqual(items("Let's be real, nobody reads the changelog. We'll see how many people sign up."), []);
  assert.deepEqual(items("Thanks, Mark, that was really helpful."), []);
});

test("action items the way meetings sound", () => {
  const items = (t) => findActionItems(t, { ref }).map((a) => [a.owner, a.due]);
  assert.deepEqual(items("Okay so action item: Priya will send the vendor contract to legal by Friday."), [
    ["Priya", "2026-10-16"],
  ]);
  assert.deepEqual(items("Rahul owns the migration plan. He'll have a first draft in two weeks."), [
    ["Rahul", "2026-10-26"],
  ]);
  assert.deepEqual(items("Carlos will follow up with the agency, and Mei to circulate the minutes tomorrow."), [
    ["Carlos", null],
    ["Mei", "2026-10-13"],
  ]);
  assert.deepEqual(items("Paula, can you get the contracts countersigned by the 20th?"), [["Paula", "2026-10-20"]]);
  assert.deepEqual(items("Can someone book the big room for the offsite?"), [[null, null]]);
  assert.deepEqual(items("Who's going to own the year-end report? Okay, Rosa, it's yours, due in two weeks."), [
    ["Rosa", "2026-10-26"],
  ]);
  assert.deepEqual(items("Maria sent the deck yesterday. Great quarter, everyone."), []);
});

test("traps from a whole real lecture, as Whisper wrote it (MIT 14.01, lecture 1)", () => {
  const terms = (text) => findDefinitions(text).map((d) => d.term);
  // Talk that looks like "X is Y" but isn't a definition
  assert.deepEqual(terms("On the x-axis is the quantity of roses. On the y-axis is the price of roses."), []);
  assert.deepEqual(terms("Higher price means you make more money, so you want to produce more of them."), []);
  assert.deepEqual(terms("Therefore, it's the equilibrium, highly non-technical."), []);
  assert.deepEqual(terms("Producers are happy because on their supply curve is the same point."), []);
  assert.deepEqual(terms("Auctions are a terrific example. They're like the textbook examples of a market."), []);
  assert.deepEqual(terms("Adam Smith is sort of considered the father of economics."), []);
  assert.deepEqual(terms("Economics at its core is all about how the market knows best."), []);
  assert.deepEqual(terms("Laws were driven by the capitalist signature of our economy."), []);
  assert.deepEqual(terms("Many of these people are poor and lives could be changed by a payment."), []);
  // Said the other way round: the description first, the term second
  assert.deepEqual(terms("Where the points meet is the market equilibrium."), ["Market equilibrium"]);
  // "is what's called X": the next sentence says what it is (and a repeated line is skipped)
  assert.deepEqual(
    findDefinitions(
      "Now, the other extreme is what's called the command economy. Rather than a capitalist economy, it's what's called the command economy. In this case, the government makes all the production and consumption decisions.",
    ).map((d) => [d.term, d.definition]),
    [["Command economy", "the government makes all the production and consumption decisions"]],
  );
  assert.deepEqual(
    terms("I'll have a budget constraint, which is the resource I have, and those who can train the optimization."),
    ["Budget constraint"],
  );
  // Where the material stops is not an event
  assert.deepEqual(dates("That will cover everything you've learned up through next Wednesday."), []);
  assert.deepEqual(dates("So for example, problem set one is going to be assigned next Friday."), ["2026-10-23"]);
});

test("definitions from whole lectures, as Whisper wrote them (MIT OCW, several courses)", () => {
  const defs = (t) => findDefinitions(t).map((d) => d.term);
  // said in the middle of a sentence
  assert.deepEqual(
    defs(
      "There was a period of time known as the prebiotic world, where there were no living organisms that replicated.",
    ),
    ["Prebiotic world"],
  );
  assert.deepEqual(
    defs("They cracked what's known as the genetic code. It maps three letters of DNA to one amino acid."),
    ["Genetic code"],
  );
  assert.deepEqual(
    defs(
      'The message is we have very limited, what psychologists call, "attentional resources." We can pay attention to a few things.',
    ),
    ["Attentional resources"],
  );
  assert.deepEqual(defs("The negatively charged particle got the name of the electron."), ["Electron"]);
  assert.deepEqual(
    defs(
      "They came up with this new model, the Rutherford model, where you had mostly empty space and concentrated mass.",
    ),
    ["Rutherford model"],
  );
  // talk that only looks like a definition
  assert.deepEqual(defs("How is everyone doing? Come on, let's do better than that."), []);
  assert.deepEqual(defs("Even though this is a lecture class, I still want you to do."), []);
  assert.deepEqual(defs("Since then, it's been replicated so that she doesn't have to shut down her lab."), []);
  assert.deepEqual(defs("So JJ Thompson was interested in this thing called cathode rays."), []);
  assert.deepEqual(defs("Mass is being lost, left and right."), []);
  assert.deepEqual(defs("The different voltage between the plates was greater than 0."), []);
  assert.deepEqual(defs("The first part of this class is really the basic foundations of chemistry."), []);
  assert.deepEqual(defs("Step one is the hardest because everybody skips the reading."), []);
  assert.deepEqual(defs("So the goodie bag is another part of your homework."), []);
  assert.deepEqual(defs("Dealers are mixing the fentanyl in with everything else."), []);
});

test("lecture talk around dates that is not a deadline (from whole MIT lectures)", () => {
  const dates = (t) => findEvents(t, { ref: new Date("2026-10-12T10:00:00"), locale: "en-US" }).map((e) => e.date);
  // what the class will discuss, a question held for later, a plan that slipped, a fraction on the board
  assert.deepEqual(dates("That part of his paper we're gonna talk about next Tuesday."), []);
  assert.deepEqual(dates("I want to hold that question for Tuesday, but the paper is really about mining."), []);
  assert.deepEqual(
    dates(
      "I had planned to tell you everything you need for the problem set by today, but that's not going to happen.",
    ),
    [],
  );
  assert.deepEqual(dates("So now I've got 2/11 on the board, and simulating what we'd ask you to do on a quiz."), []);
  assert.deepEqual(
    dates("The kind of problem solving you'll see today is like generating tests which you saw last time."),
    [],
  );
  assert.deepEqual(dates("I won't have office hours today due to my schedule."), []);
  // still deadlines
  assert.deepEqual(dates("The problem sets are due on Friday."), ["2026-10-16"]);
  assert.deepEqual(dates("We didn't get to the quiz Monday because of the fire drill, it's on Friday now."), [
    "2026-10-16",
  ]);
});

test("in a whole lecture a bare 'X is Y' needs course vocabulary and a noun-phrase meaning", () => {
  const filler = "We talked about that for a while and then moved on to the next thing. ".repeat(30);
  const terms = (t) => findDefinitions(t).map((d) => d.term);
  // course vocabulary, said more than once, meaning is a noun phrase: kept
  assert.deepEqual(
    terms(`${filler}Atropine is a competitive inhibitor of acetylcholine. Atropine binds the receptor and blocks it.`),
    ["Atropine"],
  );
  // talk shaped like a definition: dropped in a long transcript (it would still count in a short note)
  assert.deepEqual(terms(`${filler}The father went to jail. Imagination is a really interesting thing.`), []);
  assert.deepEqual(terms(`${filler}Thanks is the most math I'll do in a lecture all year.`), []);
  // the other shapes stand on their own
  assert.deepEqual(
    terms(
      `${filler}When you do these in the lab, they're called condensation reactions, because as you form that bond, you kick out a molecule of water.`,
    ),
    ["Condensation reactions"],
  );
  assert.deepEqual(terms(`${filler}Lipids make micelles and lipid bilayers, which are the key boundary of cells.`), [
    "Lipid bilayers",
  ]);
  // every definition carries a confidence and the reasons for it
  const d = findDefinitions(
    "Okay so mitosis, basically, it's when the cell splits into two identical daughter cells.",
  )[0];
  assert.ok(d.confidence > 0 && d.confidence < 1 && Array.isArray(d.why));
});

test("study notes: course words, key lines and headings from a lecture, without AI", () => {
  const lecture = [
    "Okay, good morning everyone, can you hear me in the back?",
    "So today let's talk about the demand curve.",
    "The demand curve shows how much people buy at each price.",
    "As the price goes up, the quantity demanded goes down, because people switch to substitutes.",
    "I had a funny thing happen on the way here, my car wouldn't start.",
    "Now we're going to move on to the supply curve.",
    "The supply curve shows how much firms sell at each price.",
    "Where the demand curve and the supply curve cross is the market equilibrium.",
    "The market equilibrium is the price where quantity demanded equals quantity supplied.",
    "Any questions? No? Okay.",
    "Remember, the problem set is due on Friday.",
  ].join(" ");
  const terms = keyTerms(lecture).map((t) => t.term);
  assert.ok(terms.includes("demand curve") && terms.includes("supply curve"), terms.join(", "));
  assert.ok(!terms.includes("morning") && !terms.includes("funny"));
  const lines = keySentences(lecture, { share: 0.4 }).map((l) => l.text);
  assert.ok(
    lines.some((l) => l.startsWith("The demand curve shows")),
    lines.join(" | "),
  );
  assert.ok(lines.some((l) => l.includes("market equilibrium")));
  assert.ok(!lines.some((l) => /funny|hear me|Any questions/.test(l)), lines.join(" | "));
  assert.deepEqual(
    sections(lecture, { gap: 1 }).map((h) => h.title),
    ["Demand curve", "Supply curve"],
  );
  const notes = studyNotes(lecture, { share: 0.4 });
  assert.equal(notes.sections[0].title, "Demand curve");
  assert.ok(notes.sections[0].lines[0].terms.includes("demand curve"));
  // transcript tags are not speech
  assert.ok(!keyTerms("[MUSIC] [MUSIC] [MUSIC] the wave the wave").some((t) => t.term === "music"));
});

test("'that's called X' takes the meaning from the sentences before it", () => {
  const text =
    "Some atoms of hydrogen have an extra neutron, so they weigh more. It is still electrically neutral. That's called deuterium. Then we move on to the next topic and look at the table.";
  const d = findDefinitions(text).find((x) => /deuterium/i.test(x.term));
  assert.ok(d, "found");
  assert.match(d.definition, /extra neutron/);
  assert.doesNotMatch(d.definition, /next topic/);
});
