import { test } from "node:test";
import assert from "node:assert/strict";
import { findDecisions, findActionItems, followUpEmail } from "../src/index.js";

const ref = new Date(2026, 9, 12); // Monday, October 12, 2026

const meeting = `Okay, let's get started. We decided to launch the beta on November 2nd.
Maria will send the updated deck to the client by Friday.
Action item: Sam to book the room for the workshop.
I'll write up the survey results tomorrow.
Can you share the budget spreadsheet with the team?
We agreed that support hours stay the same.
Back to the slides for a second. That was a great quarter.
Let's schedule a review with legal next week.
Please update the roadmap before Thursday.`;

test("finds decisions", () => {
  const d = findDecisions(meeting).map((x) => x.text);
  assert.deepEqual(d, ["We decided to launch the beta on November 2nd", "We agreed that support hours stay the same"]);
});

test("finds action items with owners and due dates", () => {
  const items = findActionItems(meeting, { ref });
  const by = Object.fromEntries(items.map((a) => [a.task, a]));
  assert.equal(by["Send the updated deck to the client by Friday"].owner, "Maria");
  assert.equal(by["Send the updated deck to the client by Friday"].due, "2026-10-16");
  assert.equal(by["Book the room for the workshop"].owner, "Sam");
  assert.equal(by["Write up the survey results tomorrow"].owner, "Me");
  assert.equal(by["Write up the survey results tomorrow"].due, "2026-10-13");
  assert.equal(by["Share the budget spreadsheet with the team"].owner, null);
  assert.equal(by["Schedule a review with legal next week"].owner, "Team");
  assert.equal(by["Update the roadmap before Thursday"].due, "2026-10-15");
  // not actions: "Back to the slides", decisions, small talk
  assert.ok(!items.some((a) => /slides|great quarter|launch the beta|get started/i.test(a.task)));
  assert.equal(items.length, 6);
});

test("handles curly apostrophes, pairs of owners and explicit lists", () => {
  const items = findActionItems("Next steps: Ana and Joe will draft the proposal by October 20. We’ll send the notes to everyone Monday.", { ref });
  assert.equal(items[0].owner, "Ana and Joe");
  assert.equal(items[0].task, "Draft the proposal by October 20");
  assert.equal(items[0].due, "2026-10-20");
  assert.equal(items[1].owner, "Team");
  assert.equal(items[1].due, "2026-10-19");
});

test("writes a follow-up email", () => {
  const email = followUpEmail({
    title: "Launch sync",
    decisions: findDecisions(meeting),
    actions: findActionItems(meeting, { ref }),
    formatDate: (d) => (d === "2026-10-16" ? "Fri, Oct 16" : d),
  });
  assert.equal(email.subject, "Follow-up: Launch sync");
  assert.match(email.body, /Decisions:\n- We decided to launch the beta on November 2nd/);
  assert.match(email.body, /- Maria: Send the updated deck to the client by Friday \(by Fri, Oct 16\)/);
  assert.match(email.body, /- Unassigned: Share the budget spreadsheet/);
  assert.match(followUpEmail({}).body, /didn't catch any/);
});
