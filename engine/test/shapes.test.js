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
