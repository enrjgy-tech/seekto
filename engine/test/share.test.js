import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeShare, decodeShare, sharedToText, makeQuiz, findDefinitions } from "../src/index.js";

const text = "Mitosis means one cell dividing into two identical cells. Photosynthesis is the process plants use to turn light into sugar. A gene is a section of DNA that codes for a protein.";

test("a practice test survives the round trip through a link", async () => {
  const questions = makeQuiz([{ title: "Cells", text }], { count: 6 });
  const code = await encodeShare({ title: "Bio quiz", questions });
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = await decodeShare(code);
  assert.equal(back.title, "Bio quiz");
  assert.deepEqual(back.questions.map((q) => [q.kind, q.prompt, q.answer]), questions.map((q) => [q.kind, q.prompt, q.answer]));
});

test("links stay short", async () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ kind: "define", prompt: `Term ${i}`, answer: `A definition that is reasonably long for term number ${i}` }));
  const code = await encodeShare({ title: "Forty cards", questions: many });
  assert.ok(code.length < 2000, `link part is ${code.length} characters`);
});

test("broken or hostile links are refused cleanly", async () => {
  await assert.rejects(decodeShare("not-a-real-link"), /broken or incomplete/);
  const empty = await encodeShare({ title: "x", questions: [] });
  await assert.rejects(decodeShare(empty), /doesn't contain/);
  const weird = await encodeShare({ title: "<script>", questions: [{ kind: "evil", prompt: "x", answer: "y" }, { kind: "define", prompt: "Gene", answer: "A section of DNA" }] });
  const back = await decodeShare(weird);
  assert.equal(back.questions.length, 1);
  assert.equal(back.title, "<script>"); // shown escaped by the app, never as HTML
});

test("a saved shared test becomes notes Seekto can quiz from again", () => {
  const questions = makeQuiz([{ title: "Cells", text }], { count: 6 });
  const again = findDefinitions(sharedToText({ questions })).map((d) => d.term).sort();
  assert.deepEqual(again, ["Gene", "Mitosis", "Photosynthesis"]);
});
