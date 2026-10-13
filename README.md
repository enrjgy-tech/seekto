# Seekto

**Your teacher says "the quiz is on Friday." Seekto puts it on your calendar and turns the lesson into a practice test you can share with your class.**

Free and open source. No account, works without AI, and on computers the transcript is made privately on your own device. In English, Spanish and Portuguese.

![Seekto's first screen: a sample class plays, the quiz date and lab deadline light up and land on a calendar, the practice test fills up, then a multiple-choice practice test, and a classmate opens the shared test on a phone with "Your classmate got all 7 right. Can you match that?"](docs/media/hero.gif)

**[Open Seekto →](https://enrjgy-tech.github.io/seekto/)**: the sample class starts playing right away. No microphone, account or AI key needed. Can't record in class? **Paste your notes or a syllabus** instead.

*For developers:* Whisper running in the browser, a no-AI rules engine you can import in one line ([playground](https://enrjgy-tech.github.io/seekto/playground.html)) with [accuracy measured on real lectures and on sentences it was never tuned on](engine/bench), and end-to-end encrypted sync to a database you own. Plain JavaScript; the engine has no dependencies. [How it's built ↓](#how-its-built)

## What it does

- **Record a class.** On a computer, Seekto writes the transcript privately on the device when you stop, so the audio never leaves it. On a phone it can use the browser's live speech service instead (online, in Chrome and Edge). Mark "lost here" moments and type notes stamped to the second.
- **No recording? Paste.** Class notes, a syllabus or a teacher's announcement work the same way: dates to the calendar, terms to a practice test.
- **Deadlines find themselves.** "The essay is due the 21st", "the quiz moved from Friday to Tuesday", "el examen es el viernes", "a prova é na sexta que vem" go straight on your calendar, and the date is highlighted in the transcript. Import Canvas, Google Classroom, Moodle or Blackboard calendars too.
- **Practice tests from your own notes.** Seekto picks up terms the teacher explains ("so mitosis, basically, it's when…") and makes multiple-choice and "which term means…" questions, plus fill-in-the-blanks from the lesson's key sentences, so a lecture without neat definitions still gives a test. Tap, type or say your answer; long answers you mark yourself. Export to Quizlet, Anki, Google Forms, Kahoot or Moodle.
- **Reviews before the test.** When a quiz is on your calendar, Seekto can add a few short spaced reviews before it.
- **Reminders where you already look.** "Remind me" adds a deadline to Google Calendar, or as a file Apple Calendar and Outlook open with reminders the day before and that morning. The full calendar export carries the same reminders.
- **Share a test with your class.** One link opens it on any phone, with nothing to install. Send your score and your classmates try to beat it. The questions travel inside the link, so they're never stored on a server.
- **Ask about it.** "When is my math test?", "¿Qué tengo esta semana?", "O que é mitose?" Type, or use talk mode.

## How accurate is it?

Two kinds of numbers, and the first one matters more.

**On whole real lectures** (28 complete MIT OpenCourseWare recordings, run through Seekto's own Whisper path, output judged by hand; [details](engine/bench#more-lectures-training-and-a-blind-test-that-failed)):

| | What the engine offered | Right |
|---|---|---|
| Definitions, 23 lectures it had never seen | 382 | about 78 (**about 20%**) |
| Definitions, 2 lectures scored blind before any fix | 15 | 0 of the 8 real ones found |
| Definitions, 23 lectures after the rules learned from them (tuned, so read with care) | 127 | 57 (45%), 57 of 82 real ones found |
| Definitions, 2 more lectures scored blind after that | 11 | 5 (45%), 5 of 9 real ones found |
| Deadlines, the same 23 lectures | 9 at first contact, 2 after general fixes | 3 real deadlines existed: 3 found with 6 wrong, then 2 found with 0 wrong |

So on a real lecture, roughly half of the definitions Seekto suggests are real, and it finds about half of the real ones. That is why a recorded class shows them as suggestions you keep or dismiss; only kept ones become flashcards. Deadlines look solid, but lectures carry few of them, so the quoted-lecture set below is the better test for those.

**On written test sentences** (they sound like teachers, syllabi and meetings, with fillers, corrections and reschedules, in English, Spanish and Portuguese; written by separate AI sessions that never saw the code, [how](engine/bench#the-test-set)):

| | Held out: found | Held out: right, of what it adds | Fresh: found | Fresh: right, of what it adds |
|---|---|---|---|---|
| Deadlines and tests | 90% | 93% | 78% | 92% |
| Definitions | 70% | 78% | 58% | 84% |
| Meeting action items | 82% | 85% right person | 76% | 85% right person |

"Held out" is half of the first 360 sentences, only ever counted. "Fresh" is 190 sentences written after the rules were finished and scored once. A third set, 54 sentences quoted from real Open Yale lectures, stands at 2 of 2 deadlines found (3 false alarms) and 4 of 6 definitions on its held-out half. CI fails if a change lowers any held-out number. Every scored set, its history and how to run it: [engine/bench](engine/bench).

## Why it's different

- **No AI needed.** Dates, deadlines, definitions and quizzes come from tested rules in [`engine/`](engine/src), in English, Spanish and Portuguese. Add an AI model only if you want one: Ollama on your computer, free models on OpenRouter, or OpenAI or Anthropic with your own key.
- **Private transcripts.** On computers, Whisper runs in your browser: no audio leaves your device, and it works offline after a one-time download. Whisper itself writes about 100 languages; Seekto finds dates and terms in English, Spanish and Portuguese. Tested so far in Chrome and Edge on Windows; reports from other browsers are welcome. Phones use the browser's live speech service by default.
- **Your notes stay yours.** Everything lives in your browser. Connect your phone and laptop with a 6-character pairing code; then both screens show the same 6-digit number, and you confirm it on both and they sync directly, encrypted. Optional storage goes to a Supabase project *you* own, end-to-end encrypted with a key only you hold. Or [run all of it yourself](docs/SELF-HOSTING.md).

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
npm run vendor    # copies the speech library into ./site (for private transcripts)
npm run serve     # serves ./site locally
```

The app is plain HTML, CSS and JavaScript modules, and the build only copies files. The engine has no dependencies; the app's one is Transformers.js (pinned, copied in by `npm run vendor`), which runs Whisper for private transcripts. Node 20 or newer for the tests. To host your own copy (Docker, your own servers, no outside requests), see [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md).

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
