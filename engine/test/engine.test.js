import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseCaptions, parseTranscriptText, parseTime, formatTime, buildIndex, search, videoId, watchUrl } from "../src/index.js";

const sample = await readFile(new URL("../../packs/sample-binary-search/transcript.vtt", import.meta.url), "utf8");
const cues = parseCaptions(sample);
const index = buildIndex(cues);

test("parses times in VTT, SRT and short forms", () => {
  assert.equal(parseTime("00:01:02.500"), 62.5);
  assert.equal(parseTime("00:01:02,500"), 62.5);
  assert.equal(parseTime("01:02.5"), 62.5);
  assert.ok(Number.isNaN(parseTime("nope")));
});

test("parses SRT with tags and merges repeated lines", () => {
  const srt = "1\n00:00:01,000 --> 00:00:03,500\nHello <i>there</i>\n\n2\n00:00:03,500 --> 00:00:05,000\nHello there\n\n3\n00:00:05,000 --> 00:00:06,000\nNext";
  assert.deepEqual(parseCaptions(srt), [
    { start: 1, end: 5, text: "Hello there" },
    { start: 5, end: 6, text: "Next" },
  ]);
});

test("parses transcript text copied from a transcript panel", () => {
  const cues = parseTranscriptText("0:00\nWelcome back\n1:05\nBinary search\nneeds a sorted list\n1:02:03\nThe end");
  assert.equal(cues.length, 3);
  assert.deepEqual(cues[1], { start: 65, end: 3723, text: "Binary search needs a sorted list" });
});

test("formats times", () => {
  assert.equal(formatTime(5), "00:05");
  assert.equal(formatTime(125), "02:05");
  assert.equal(formatTime(3725), "1:02:05");
});

test("sample pack parses into 26 lines", () => {
  assert.equal(cues.length, 26);
  assert.equal(cues.at(-1).end, 352);
});

// Retrieval quality: each sample question must land on the line that answers it.
const golden = [
  ["Why does the list have to be sorted?", 46],
  ["How many steps for a million items?", 115],
  ["What is the off-by-one bug?", 214],
  ["When is linear search better?", 272],
  ["overflow", 244],
  ["homework", 328],
];
for (const [question, second] of golden) {
  test(`top answer for "${question}" starts at ${formatTime(second)}`, () => {
    const [top] = search(index, question);
    assert.ok(top, "no answer");
    assert.equal(top.start, second);
  });
}

test("returns nothing for unrelated words and at most three spaced answers", () => {
  assert.deepEqual(search(index, "photosynthesis chlorophyll"), []);
  const results = search(index, "search list");
  assert.ok(results.length <= 3);
  for (let i = 1; i < results.length; i++) assert.ok(Math.abs(results[i].start - results[0].start) > 20);
});

test("reads YouTube links", () => {
  assert.equal(videoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("not a link"), null);
  assert.equal(watchUrl("dQw4w9WgXcQ", 61.9), "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=61s");
});
