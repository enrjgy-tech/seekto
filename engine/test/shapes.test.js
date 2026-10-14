// The shape catalog (engine/bench/shapes.mjs) is a test too: most of the known ways of saying "X means Y"
// must be caught, and ordinary sentences that look like them must not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("definition shapes: most are caught and ordinary talk is not", () => {
  const out = execFileSync("node", [new URL("../bench/shapes.mjs", import.meta.url).pathname], { encoding: "utf8" });
  const [, hit, total] = out.match(/shapes caught: (\d+)\/(\d+)/);
  const [, bad] = out.match(/wrongly offered: (\d+)\//);
  assert.ok(Number(hit) / Number(total) >= 0.88, `only ${hit} of ${total} shapes caught`);
  assert.ok(Number(bad) <= 1, `${bad} ordinary sentences offered as definitions`);
});

import { findDefinitions } from "../src/index.js";

test("implied definitions: one-letter symbols and stated facts", () => {
  const get = (t) => findDefinitions(t, { features: true })[0];
  assert.equal(get("Just remember that S stands for Svedberg.")?.term, "S");
  assert.equal(get("Q is the reaction quotient.")?.definition, "the reaction quotient");
  assert.equal(get("Let p denote the price of a slice of pizza.")?.term, "p");
  assert.equal(get("The president is elected for four years.")?.definition, "elected for four years");
  assert.equal(get("A senator's term lasts six years.")?.definition, "lasts six years");
  for (const no of ["A is the answer.", "I have three exams.", "The class has 40 students."])
    assert.equal(get(no), undefined, no);
});
