# Seekto

**Your teacher says "the quiz is on Friday." Seekto puts it on your calendar and turns the lesson into a practice test you can share with your class.**

Free and open source. No account, works without AI, and on computers the transcript is made privately on your own device. In English, Spanish and Portuguese.

![A class recording turning into calendar dates and a practice test, which a classmate opens from a link on their phone](docs/media/hero.gif)

**[Open Seekto →](https://enrjgy-tech.github.io/seekto/)** and press **Try a sample class**. No microphone, account or AI key needed.

*For developers:* Whisper running in the browser, a no-AI rules engine you can import in one line ([playground](https://enrjgy-tech.github.io/seekto/playground.html)) with [accuracy measured on sentences it was never tuned on](engine/bench), and end-to-end encrypted sync to a database you own. Plain JavaScript with no runtime dependencies. [How it's built ↓](#how-its-built)

## What it does

- **Record a class.** On a computer, Seekto writes the transcript privately on the device when you stop, so the audio never leaves it. On a phone it can use the browser's live speech service instead (online, in Chrome and Edge). Mark "lost here" moments and type notes stamped to the second.
- **Deadlines find themselves.** "The essay is due the 21st", "the quiz moved from Friday to Tuesday", "el examen es el viernes", "a prova é na sexta que vem" go straight on your calendar, and the date is highlighted in the transcript. Import Canvas, Google Classroom, Moodle or Blackboard calendars too.
- **Practice tests from your own notes.** Seekto picks up terms the teacher explains ("so mitosis, basically, it's when…") and makes questions both ways, plus fill-in-the-blanks. Type or say your answer. Export to Quizlet, Anki, Google Forms, Kahoot or Moodle.
- **Reviews before the test.** When a quiz is on your calendar, Seekto can add a few short spaced reviews before it.
- **Share a test with your class.** One link opens it on any phone, with nothing to install. Send your score and your classmates try to beat it. The questions travel inside the link, so they're never stored on a server.
- **Ask about it.** "When is my math test?", "¿Qué tengo esta semana?", "O que é mitose?" Type, or use talk mode.

## How accurate is it?

The rules were measured on 360 sentences written by people who never saw them, the way teachers, syllabi and meetings really sound (fillers, corrections, reschedules, cancellations, day-first dates). Half the set is held out: it is only ever counted, never used to tune the rules.

| On the held-out half | Found | Right when found |
|---|---|---|
| Deadlines and tests (155 sentences) | 88% | 92% have the right date |
| Definitions (75 sentences) | 57% | 71% are real definitions |
| Meeting action items (25 meetings) | 82% | 85% name the right person, 94% the right due date |

Definitions are the weak spot, so check your practice test. On the half used to fix the rules, scores are close to 100%; that gap is why only the held-out half is reported. The sentences are written to sound real but aren't real recordings yet. Details, known gaps and how to run it: [engine/bench](engine/bench). CI fails if a change lowers any of these numbers.

## Why it's different

- **No AI needed.** Dates, deadlines, definitions and quizzes come from tested rules in [`engine/`](engine/src), in English, Spanish and Portuguese. Add an AI model only if you want one: Ollama on your computer, free models on OpenRouter, or OpenAI or Anthropic with your own key.
- **Private transcripts in about 100 languages.** Whisper runs in your browser: no audio leaves your device, and it works offline after a one-time download. Tested so far in Chrome and Edge on Windows; reports from other browsers and phones are welcome.
- **Your notes stay yours.** Everything lives in your browser. Connect your phone and laptop with a 6-letter code (both screens show the same number to confirm) and they sync directly, encrypted. Optional storage goes to a Supabase project *you* own, end-to-end encrypted with a key only you hold. Or [run all of it yourself](docs/SELF-HOSTING.md).

## Also for meetings

Switch to **Work** and the same app records meetings, after a consent check every time. It pulls out decisions and action items (who does what, by when), puts dated ones on your calendar and drafts a follow-up email for you to check and send yourself.

<details><summary>See the full tour: a class, a shared test and a meeting</summary>

![A sample class playing live, a classmate opening the shared test on a phone, and a sample meeting turning into decisions, action items and a follow-up email](docs/media/demo.gif)

</details>

## Privacy, in short

Everything you create stays in your browser unless you turn on sync. Device sync goes directly between your devices; a public message service (ntfy.sh, or your own) and two STUN servers only help them find each other. Storage sync is end-to-end encrypted in a database you own. AI is off until you choose a provider, and then only what you ask about is sent to it. There are no trackers or analytics. Every outside service and what it can see is listed in [docs/PRIVACY.md](docs/PRIVACY.md).

Transcripts are made privately on your device with Whisper (the default on computers) or live by your browser's speech service, which sends audio to the browser maker; you choose in Settings. Before every recording Seekto asks you to confirm you're allowed to record. Follow your school's and workplace's rules.

## Run it locally

```sh
git clone https://github.com/enrjgy-tech/seekto.git
cd seekto
npm test          # engine tests: dates, meetings, calendars, quizzes, share links, sync, encryption
npm run bench     # accuracy on the blind-written test set
npm run build     # copies the app into ./site and writes its offline file list
npm run serve     # serves ./site locally
```

No runtime dependencies: the app is plain HTML, CSS and JavaScript modules, and the build only copies files. Node 20 or newer for the tests. To host your own copy (Docker, your own servers, no outside requests), see [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md).

## How it's built

- **`app/`**: the web app in plain HTML, CSS and JavaScript modules, in English, Spanish and Portuguese (`app/i18n/`). It installs as an app and opens offline after the first visit.
- **`engine/`**: the tested logic, usable on its own ([docs](engine/README.md), [playground](https://enrjgy-tech.github.io/seekto/playground.html)):
  - dates and deadlines in speech and text, in English, Spanish and Portuguese ([measured](engine/bench));
  - decisions and action items in meetings;
  - definitions, quizzes and answer checking;
  - share links;
  - .ics calendars;
  - questions like "when is my test";
  - device pairing and sync rules;
  - account keys and end-to-end encryption;
  - requests to each AI provider.
- **`app/supabase.sql`**: the storage you can bring, checked in CI against Postgres.

## Contributing

There are good first issues for every skill level: teach Seekto a phrase it misses (each is one test and one rule; `node engine/bench/run.mjs --show` lists real misses), add a language (French is open), add a storage adapter, test it on your phone or Chromebook, or improve accessibility. See [CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](ROADMAP.md) and the [launch plan](docs/LAUNCH.md).

Thanks to [@KeuqS](https://github.com/KeuqS) for the first outside contribution: Portuguese dates ([#11](https://github.com/enrjgy-tech/seekto/pull/11)).

## License

Code: [MIT](LICENSE). Geist fonts: [SIL Open Font License](app/fonts/OFL.txt).
