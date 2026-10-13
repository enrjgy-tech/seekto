import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  reviewPlan, findDates, findEvents, parseICS, toICS, googleCalendarLink, detectSubject, detectTopic, findDefinitions,
  makeQuiz, checkAnswer, exportQuiz, parseCaptions,
} from "../src/index.js";

// Monday, October 12, 2026
const ref = new Date(2026, 9, 12);

test("finds month-name, numeric and relative dates", () => {
  const dates = (t) => findDates(t, ref).map((d) => d.date);
  assert.deepEqual(dates("Due October 20th."), ["2026-10-20"]);
  assert.deepEqual(dates("Due Oct. 20, 2027."), ["2027-10-20"]);
  assert.deepEqual(dates("by the 3rd of November"), ["2026-11-03"]);
  assert.deepEqual(dates("turn it in 10/30"), ["2026-10-30"]);
  assert.deepEqual(dates("tomorrow"), ["2026-10-13"]);
  assert.deepEqual(dates("in two weeks"), ["2026-10-26"]);
  assert.deepEqual(dates("on Friday"), ["2026-10-16"]);
  assert.deepEqual(dates("next Friday"), ["2026-10-23"]);
  assert.deepEqual(dates("on Monday"), ["2026-10-19"]);
  assert.deepEqual(dates("January 5"), ["2027-01-05"]);
  assert.deepEqual(dates("September 1"), ["2027-09-01"]);
  assert.deepEqual(dates("no date here, 13/45 is not one"), []);
});

test("finds tests and deadlines in what a teacher says", () => {
  const said =
    "Okay everyone, quick reminders. The chapter 5 quiz is on Friday. " +
    "Your persuasive essay is due October 20th, and remember the rubric. " +
    "We'll do review problems tomorrow. The midterm is November 3rd.";
  const events = findEvents(said, { ref, subject: "English" });
  assert.deepEqual(
    events.map((e) => [e.date, e.type, e.title]),
    [
      ["2026-10-16", "test", "English chapter 5 quiz"],
      ["2026-10-20", "assignment", "English persuasive essay due"],
      ["2026-11-03", "test", "English midterm"],
    ]
  );
});

test("titles deadlines from the words before 'due'", () => {
  // Said on a Monday: "next Monday" is the Monday of next week (weeks start on Monday).
  const [event] = findEvents("The lab write-up is due next Monday.", { ref });
  assert.equal(event.title, "Lab write-up due");
  assert.equal(event.date, "2026-10-19");
});

test("parses a Canvas-style .ics feed and writes one back", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:event-assignment-1",
    "DTSTART;VALUE=DATE:20261020",
    "SUMMARY:Persuasive Essay [ENG 101]",
    "DESCRIPTION:Use the rubric\\, 1500 words",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:event-2",
    "DTSTART:20261016T150000",
    "SUMMARY:Chapter 5 Quiz",
    " (Math)",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const events = parseICS(ics);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { uid: "event-assignment-1", title: "Persuasive Essay [ENG 101]", date: "2026-10-20", time: null, description: "Use the rubric, 1500 words", url: null });
  assert.equal(events[1].title, "Chapter 5 Quiz(Math)");
  assert.equal(events[1].time, "15:00");
  // Exports carry reminders: 9:00 the day before and 8:00 on the day; they don't leak into a re-import
  const withAlarms = toICS([{ id: "q", title: "Bio quiz", date: "2026-10-31", type: "test" }]);
  assert.match(withAlarms, /DTEND;VALUE=DATE:20261101/);
  assert.match(withAlarms, /TRIGGER:-PT15H[\s\S]*TRIGGER:PT8H/);
  assert.equal(parseICS(withAlarms)[0].description, "");
  assert.doesNotMatch(toICS([{ id: "q", title: "Bio quiz", date: "2026-10-31" }], { reminders: false }), /VALARM/);
  const back = parseICS(toICS([{ id: "a", title: "Math test; ch. 5", date: "2026-10-16" }]));
  assert.deepEqual(back.map((e) => [e.title, e.date]), [["Math test; ch. 5", "2026-10-16"]]);
});

const lecture = parseCaptions(await readFile(new URL("../../packs/sample-binary-search/transcript.vtt", import.meta.url), "utf8"))
  .map((c) => c.text)
  .join(" ");

test("detects subject and topic of a lecture", () => {
  assert.equal(detectSubject(lecture), "Computer Science");
  assert.equal(detectTopic(lecture), "Binary Search");
  assert.equal(detectSubject("we talked about our weekend"), null);
});

test("finds definitions", () => {
  const defs = findDefinitions(
    "Photosynthesis is the process plants use to turn light into sugar. It is very important. " +
      "So mitosis means one cell dividing into two identical cells. A prime number is a number with exactly two factors."
  );
  assert.deepEqual(defs.map((d) => d.term), ["Photosynthesis", "Mitosis", "Prime number"]);
});

test("makes a mixed quiz and checks answers", () => {
  const notes = [{ title: "Bio", text: "Photosynthesis is the process plants use to turn light into sugar. Mitosis means one cell dividing into two identical cells." }];
  // One question per definition, alternating direction; "flip" asks the other way round.
  const quiz = makeQuiz(notes, { count: 4, seed: 7 });
  assert.equal(quiz.length, 2);
  assert.deepEqual(quiz.map((q) => q.kind).sort(), ["define", "term"]);
  const flipped = makeQuiz(notes, { count: 4, seed: 7, flip: true });
  assert.deepEqual(flipped.find((q) => q.answer === "Photosynthesis" || q.prompt === "Photosynthesis").kind, quiz.find((q) => q.answer === "Photosynthesis" || q.prompt === "Photosynthesis").kind === "term" ? "define" : "term");
  // The same seed gives the same order
  assert.deepEqual(makeQuiz(notes, { seed: 3 }), makeQuiz(notes, { seed: 3 }));
  assert.ok(checkAnswer("photosynthesis", "Photosynthesis"));
  assert.ok(checkAnswer("photosynthesys", "Photosynthesis"));
  assert.ok(!checkAnswer("mitosis", "Photosynthesis"));
  assert.ok(checkAnswer("plants turn light into sugar", "the process plants use to turn light into sugar"));
  const blanks = makeQuiz([{ title: "CS", text: lecture }], { count: 5 });
  assert.equal(blanks.length, 5);
  assert.ok(blanks.every((q) => q.prompt.includes("_____") || q.kind !== "blank"));
});

test("a lesson becomes a fuller test: multiple choice and key-sentence blanks", () => {
  const lesson = [
    "Mitosis means one cell dividing into two identical daughter cells.",
    "Before a cell divides, it copies its DNA, so each new cell gets a full set of chromosomes.",
    "A chromosome is a long strand of DNA wrapped around proteins.",
    "The centromere is the point where the two copies of a chromosome are held together.",
    "Meiosis is the kind of division that makes sperm and egg cells, with half the chromosomes.",
    "Cytokinesis is the final step, when the cytoplasm splits into two cells.",
  ].join(" ");
  const quiz = makeQuiz([{ title: "Cells", text: lesson }], { seed: 4 });
  assert.ok(quiz.length >= 6);
  for (const q of quiz.filter((x) => x.choices)) {
    assert.ok(q.choices.includes(q.answer));
    assert.equal(new Set(q.choices.map((c) => c.toLowerCase())).size, q.choices.length);
  }
  assert.ok(quiz.some((q) => q.kind === "define" && q.choices?.length >= 3));
  // A lecture with no "X is Y" sentences still gives a test, from its key sentences
  const history = "Robespierre and the Committee of Public Safety ran France for about a year. They executed thousands of people they considered enemies of the revolution. The guillotine became the symbol of that whole period. A lot of historians argue the terror was a response to foreign invasion and civil war. By 1794 even his allies turned on him and he was executed too.";
  const blanks = makeQuiz([{ title: "History", text: history }], { seed: 2 });
  assert.ok(blanks.length >= 4, `only ${blanks.length} questions`);
  assert.ok(blanks.every((q) => q.kind === "blank" && q.prompt.includes("_____")));
  // Moodle gets the options too
  assert.match(exportQuiz([{ prompt: "Gene", answer: "DNA", choices: ["RNA", "DNA"] }], "gift"), /\{~RNA =DNA\}/);
});

test("a Google Calendar link for one all-day event", () => {
  assert.equal(googleCalendarLink({ title: "Bio quiz", date: "2026-12-31" }), "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Bio+quiz&dates=20261231%2F20270101");
});

test("exports quizzes for Anki, Quizlet, CSV and Moodle", () => {
  const qs = [{ prompt: "Turns light into sugar", answer: "Photosynthesis" }, { prompt: 'Say "hi", then: x=1', answer: "Greeting" }];
  assert.equal(exportQuiz(qs, "anki"), 'Turns light into sugar\tPhotosynthesis\nSay "hi", then: x=1\tGreeting');
  assert.equal(exportQuiz(qs, "csv").split("\n")[2], '"Say ""hi"", then: x=1","Greeting"');
  assert.ok(exportQuiz(qs, "gift").includes("::Q2:: Say \"hi\", then\\: x\\=1 {=Greeting}"));
});

test("Spanish: dates, deadlines and definitions", () => {
  const ref = new Date(2026, 9, 12); // Monday, October 12, 2026
  const ev = (t) => findEvents(t, { ref }).map((e) => [e.date, e.type, e.title]);
  assert.deepEqual(ev("El examen de química es el viernes."), [["2026-10-16", "test", "Examen de química"]]);
  assert.deepEqual(ev("La tarea de historia se entrega el 20 de octubre."), [["2026-10-20", "assignment", "Tarea de historia"]]);
  assert.deepEqual(ev("Tenemos prueba mañana."), [["2026-10-13", "test", "Prueba"]]);
  assert.deepEqual(ev("El proyecto vence en dos semanas."), [["2026-10-26", "assignment", "Proyecto"]]);
  assert.deepEqual(ev("El parcial es el jueves de la próxima semana."), [["2026-10-22", "test", "Parcial"]]);
  // "el próximo martes" is the Tuesday of next week, like "next Tuesday"
  assert.deepEqual(ev("El ensayo es para el próximo martes."), [["2026-10-20", "assignment", "Ensayo"]]);
  // "esta mañana" is "this morning", not tomorrow
  assert.deepEqual(findDates("Esta mañana hablamos de células.", ref), []);
  const defs = findDefinitions("Bueno, la mitosis es la división de una célula en dos células idénticas. La fotosíntesis significa convertir luz en azúcar. Esto es muy importante para el examen.");
  assert.deepEqual(defs.map((d) => d.term), ["Mitosis", "Fotosíntesis"]);
});

test("Portuguese: dates and deadlines", () => {
  const ref = new Date(2026, 9, 12); // Monday, October 12, 2026
  const dates = (t) => findDates(t, ref).map((d) => d.date);
  assert.deepEqual(dates("A prova é na sexta."), ["2026-10-16"]);
  assert.deepEqual(dates("O trabalho é para o dia 20 de outubro."), ["2026-10-20"]);
  assert.deepEqual(dates("Amanhã entrego o trabalho."), ["2026-10-13"]);
  assert.deepEqual(dates("A prova será daqui a duas semanas."), ["2026-10-26"]);

  const events = (t) => findEvents(t, { ref }).map((e) => [e.date, e.type, e.title]);
  assert.deepEqual(events("A prova é na sexta."), [["2026-10-16", "test", "Prova"]]);
  assert.deepEqual(events("O trabalho é para o dia 20 de outubro."), [["2026-10-20", "assignment", "Trabalho"]]);
});

test("one sentence with two deadlines gives two events", () => {
  const ref = new Date(2026, 9, 12);
  const ev = (t) => findEvents(t, { ref }).map((e) => [e.date, e.title]);
  assert.deepEqual(ev("Your lab report is due next Wednesday, and the essay is due October 30th."), [["2026-10-21", "Lab report due"], ["2026-10-30", "Essay due"]]);
  assert.deepEqual(ev("La tarea de química se entrega el 20 de octubre, y el proyecto vence en dos semanas."), [["2026-10-20", "Tarea de química"], ["2026-10-26", "Proyecto"]]);
  assert.deepEqual(ev("The quiz is Friday and the essay is due Monday."), [["2026-10-16", "Quiz"], ["2026-10-19", "Essay due"]]);
});

test("plans spaced reviews before a test", () => {
  assert.deepEqual(reviewPlan("2026-10-23", "2026-10-12"), ["2026-10-16", "2026-10-20", "2026-10-22"]);
  assert.deepEqual(reviewPlan("2026-10-16", "2026-10-12"), ["2026-10-14", "2026-10-15"]);
  assert.deepEqual(reviewPlan("2026-10-14", "2026-10-12"), ["2026-10-13"]);
  assert.deepEqual(reviewPlan("2026-10-13", "2026-10-12"), []);
});
