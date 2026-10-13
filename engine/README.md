# Seekto engine

The no-AI part of [Seekto](../README.md), usable on its own: plain JavaScript modules with no dependencies, tested with `node --test`. It runs in browsers, Node 20+, Deno and Bun.

**[Try it in the playground →](https://enrjgy-tech.github.io/seekto/playground.html)** · **[How accurate it is →](bench)**

Pin a version (as below) rather than `@main`, which changes.

```js
import { findEvents, findDefinitions, makeQuiz, findActionItems } from
  "https://cdn.jsdelivr.net/gh/enrjgy-tech/seekto@v0.1.0/engine/src/index.js";

findEvents("The chapter 5 quiz is on Friday. The essay is due October 30th.", { ref: new Date(2026, 9, 12) });
// [{ date: "2026-10-16", type: "test", title: "Chapter 5 quiz", … },
//  { date: "2026-10-30", type: "assignment", title: "Essay due", … }]

findEvents("El examen de química es el viernes.", { ref: new Date(2026, 9, 12) });
// [{ date: "2026-10-16", type: "test", title: "Examen de química", … }]

findActionItems("Maria will send the deck by Friday. Can you book the room?", { ref: new Date(2026, 9, 12) });
// [{ owner: "Maria", task: "Send the deck by Friday", due: "2026-10-16", … },
//  { owner: null, task: "Book the room", due: null, … }]
```

## What's in it

| Area | Functions | Languages |
|---|---|---|
| Dates and deadlines | `findDates`, `findEvents` (corrections, reschedules, cancellations, past mentions; pass `locale` for day-first dates) | English, Spanish, Portuguese |
| Study | `findDefinitions`, `makeQuiz`, `reviewPlan`, `checkAnswer`, `exportQuiz` (Quizlet, Anki, CSV, Moodle GIFT) | English, Spanish, Portuguese definitions |
| Meetings | `findDecisions`, `findActionItems`, `followUpEmail` | English |
| Assistant | `classify`, `answerLocally`, `searchNotes` | English, Spanish, Portuguese questions |
| Calendars | `parseICS`, `toICS` | |
| Transcripts | `parseCaptions` (VTT, SRT), `whisperCues`, `toMono16k`, BM25 `search` | |
| Sharing | `encodeShare`, `decodeShare` (a practice test inside a URL fragment) | |
| Sync and accounts | `manifest`, `outgoing`, `incoming` (newest change wins, tombstones); `makeAccountKey`, `deriveAccount`, `sealItem`, `openItem` (HKDF, AES-GCM bound to id and version) | |
| AI providers | `buildRequest`, `readReply`, `chat` (Ollama, OpenRouter, OpenAI, Anthropic, OpenAI-compatible) | |

## Adding a phrase or a language

Every rule has tests in [`test/`](test). To teach the engine something new, add the sentence and the result you expect to a test, run `npm test` from the repo root, and change the rule until it passes. Spanish and Portuguese in [`src/dates.js`](src/dates.js) are the model for adding a language. Then run `npm run bench` to check that held-out accuracy didn't drop (CI checks it too).
