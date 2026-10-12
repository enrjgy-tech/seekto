import { test } from "node:test";
import assert from "node:assert/strict";
import { whisperCues, toMono16k } from "../src/index.js";

test("turns Whisper chunks into timed lines", () => {
  const out = {
    text: "...",
    chunks: [
      { timestamp: [0, 2.1], text: " today we start" },
      { timestamp: [2.2, 4.0], text: " chapter five." },
      { timestamp: [4.5, 6.0], text: " The quiz is on Friday." },
      { timestamp: [6.0, 8.0], text: " The quiz is on Friday." },
      { timestamp: [9.0, 12.0], text: " [BLANK_AUDIO]" },
      { timestamp: [12.0, null], text: " Mitosis means one cell dividing into two." },
    ],
  };
  assert.deepEqual(whisperCues(out), [
    { start: 0, end: 4, text: "Today we start chapter five." },
    { start: 4.5, end: 6, text: "The quiz is on Friday." },
    { start: 12, end: null, text: "Mitosis means one cell dividing into two." },
  ]);
  assert.equal(whisperCues(out, { offset: 30 })[0].start, 30);
  assert.deepEqual(whisperCues({ text: " hello there" }), [{ start: 0, end: null, text: "Hello there" }]);
  assert.deepEqual(whisperCues(null), []);
});

test("downmixes and resamples to 16 kHz", () => {
  const left = new Float32Array(48000).fill(0.5);
  const right = new Float32Array(48000).fill(-0.5);
  const out = toMono16k([left, right], 48000);
  assert.equal(out.length, 16000);
  assert.ok(Math.abs(out[100]) < 1e-6);
  const same = toMono16k([new Float32Array([0.1, 0.2])], 16000);
  assert.equal(same.length, 2);
});
