import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, answerLocally, searchNotes, describeDay } from "../src/assistant.js";

test("understands common study questions", () => {
  assert.deepEqual(classify("When is my math test?"), { intent: "next-test", subject: "math" });
  assert.deepEqual(classify("when's the next quiz"), { intent: "next-test", subject: null });
  assert.deepEqual(classify("When is my essay due?"), { intent: "when-due", subject: "essay" });
  assert.deepEqual(classify("What's due this week?"), { intent: "due", range: "week" });
  assert.deepEqual(classify("anything due tomorrow"), { intent: "due", range: "tomorrow" });
  assert.deepEqual(classify("Quiz me on biology"), { intent: "quiz", topic: "biology" });
  assert.deepEqual(classify("help me study"), { intent: "quiz", topic: null });
  assert.deepEqual(classify("make a practice test for chemistry"), { intent: "quiz", topic: "chemistry" });
  assert.deepEqual(classify("What is mitosis?"), { intent: "define", term: "mitosis" });
  assert.deepEqual(classify("start recording"), { intent: "record" });
  assert.deepEqual(classify("help me outline my essay with this rubric"), { intent: "research" });
  assert.deepEqual(classify("write me a poem"), { intent: "general" });
});

const today = "2026-10-12";
const events = [
  { title: "Math chapter 5 quiz", date: "2026-10-16", type: "test", subject: "Math" },
  { title: "English essay due", date: "2026-10-20", type: "assignment", subject: "English" },
  { title: "Math midterm", date: "2026-11-03", type: "test", subject: "Math" },
  { title: "Old quiz", date: "2026-10-01", type: "test" },
];
const notes = [{ id: "n1", title: "Cells", text: "Mitosis means one cell dividing into two identical cells. The nucleus holds DNA." }];

test("answers from the calendar", () => {
  assert.match(answerLocally(classify("When is my math test?"), { events, today }).text, /^Your next one is Math chapter 5 quiz, Friday, Oct 16 \(in 4 days\)\. After that: Math midterm/);
  assert.match(answerLocally(classify("when is my history test"), { events, today }).text, /don't see an upcoming history test/);
  assert.match(answerLocally(classify("what's due this week"), { events, today }).text, /Math chapter 5 quiz/);
  assert.doesNotMatch(answerLocally(classify("what's due this week"), { events, today }).text, /English essay/);
  assert.equal(answerLocally(classify("What's due today?"), { events, today }).text, "Nothing on your calendar today.");
});

test("answers definitions from notes", () => {
  const a = answerLocally(classify("What is mitosis?"), { notes, today });
  assert.equal(a.text, "Mitosis: one cell dividing into two identical cells.");
  const b = answerLocally(classify("what is DNA"), { notes, today });
  assert.match(b.text, /nucleus holds DNA/);
  assert.equal(answerLocally(classify("tell me a joke"), { today }).needsModel, true);
});

test("searches notes and describes days", () => {
  assert.equal(searchNotes(notes, "nucleus")[0].note.id, "n1");
  assert.equal(describeDay("2026-10-13", today), "tomorrow");
});

test("understands meeting questions", () => {
  assert.equal(classify("What are my action items?").intent, "actions");
  assert.equal(classify("what do I need to do").intent, "actions");
  assert.equal(classify("Draft a follow-up email").intent, "follow-up");
  assert.equal(classify("write the recap email").intent, "follow-up");
  assert.equal(classify("What's due this week?").intent, "due");
});
