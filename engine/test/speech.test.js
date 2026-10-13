// How people really talk: corrections, reschedules, cancellations, past mentions, ordinals,
// day-first dates and Portuguese. Many of these came from reviewers who tried to break the engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findEvents, findDefinitions, findActionItems } from "../src/index.js";

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
  assert.deepEqual(dates("Next week's quiz is on Wednesday, not Tuesday like it says in the syllabus."), ["2026-10-21"]);
  assert.deepEqual(dates("There's a quiz on Tuesday, then the chapter test the Tuesday after that."), ["2026-10-13", "2026-10-20"]);
  assert.deepEqual(dates("Read chapter 6 for Wednesday."), ["2026-10-14"]);
  assert.deepEqual(dates("The lab internals are on Thursday and Friday."), ["2026-10-15", "2026-10-16"]);
  // "next Friday" said on a Friday is a week later, not two
  assert.deepEqual(findEvents("Midterm two is next Friday at 9am.", { ref: new Date(2026, 10, 13, 12) }).map((e) => e.date), ["2026-11-20"]);
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
  assert.deepEqual(dates("Coursework drafts are due back to me on Monday 9 November, not before.", { locale: "en-GB" }), ["2026-11-09"]);
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
  assert.equal(findEvents("A prova não é mais na sexta, passou pra segunda.", { ref, locale: "pt-BR" })[0].title, "Prova");
  assert.deepEqual(dates("El examen es el quince de noviembre.", { locale: "es" }), ["2026-11-15"]);
  assert.equal(findEvents("A prova de cálculo é na sexta.", { ref, locale: "pt-BR" })[0].title, "Prova de cálculo");
});

test("definitions the way teachers say them", () => {
  const terms = (t) => findDefinitions(t).map((d) => d.term);
  assert.deepEqual(terms("Okay so mitosis, basically, it's when the cell splits into two identical daughter cells."), ["Mitosis"]);
  assert.deepEqual(terms("Photosynthesis is how plants turn light into energy."), ["Photosynthesis"]);
  assert.deepEqual(terms("ROI, return on investment, is just what you got back divided by what you put in."), ["ROI"]);
  assert.deepEqual(terms("So what is an API? It's basically a contract between two programs."), ["API"]);
  assert.deepEqual(terms("Okay, classical conditioning. That's learning by association."), ["Classical conditioning"]);
  assert.deepEqual(terms("We call this opportunity cost, right? The value of the next best thing you gave up."), ["Opportunity cost"]);
  assert.deepEqual(terms("Densidade, gente, é a massa dividida pelo volume, tá?"), ["Densidade"]);
  // Not definitions
  assert.deepEqual(terms("Friday is a big day for us."), []);
  assert.deepEqual(terms("The answer is twelve."), []);
  assert.deepEqual(terms("The test is a week from tomorrow."), []);
  assert.deepEqual(terms("Big O is the part everyone loses points on in the final."), []);
  assert.deepEqual(terms("So basically entropy, which is hard, we'll get to later."), []);
});

test("action items the way meetings sound", () => {
  const items = (t) => findActionItems(t, { ref }).map((a) => [a.owner, a.due]);
  assert.deepEqual(items("Okay so action item: Priya will send the vendor contract to legal by Friday."), [["Priya", "2026-10-16"]]);
  assert.deepEqual(items("Rahul owns the migration plan. He'll have a first draft in two weeks."), [["Rahul", "2026-10-26"]]);
  assert.deepEqual(items("Carlos will follow up with the agency, and Mei to circulate the minutes tomorrow."), [["Carlos", null], ["Mei", "2026-10-13"]]);
  assert.deepEqual(items("Paula, can you get the contracts countersigned by the 20th?"), [["Paula", "2026-10-20"]]);
  assert.deepEqual(items("Can someone book the big room for the offsite?"), [[null, null]]);
  assert.deepEqual(items("Who's going to own the year-end report? Okay, Rosa, it's yours, due in two weeks."), [["Rosa", "2026-10-26"]]);
  assert.deepEqual(items("Maria sent the deck yesterday. Great quarter, everyone."), []);
});
