# Seekto

**Turn what you hear into notes, deadlines and practice. For classes and meetings. Private, no account, works without AI.**

![Seekto turning a sample class into calendar dates and a quiz, then a sample meeting into decisions, action items and a follow-up email](docs/media/demo.gif)

**[Open Seekto →](https://enrjgy-tech.github.io/seekto/)** and press **Try a sample**. No microphone, account or AI key needed.

## What makes it different

- **It listens for what you need to do.** When a teacher says "the quiz is on Friday", it's on your calendar. When someone says "Maria will send the deck by Friday", it's an action item with an owner and a date. This works without any AI model, from tested rules in [`engine/`](engine/src).
- **Private transcripts in any language.** Turn on on-device transcription and Whisper runs in your browser: no audio leaves your device, it works offline after a one-time download, in about 100 languages and any modern browser.
- **Your data stays yours.** Everything is stored in your browser. Connect your phone and laptop with a 6-letter code and they sync directly, encrypted. Optional storage goes to a Supabase project *you* own, end-to-end encrypted with a key only you hold. Seekto has no server and no accounts to hack.
- **Any AI, or none.** Use it as is, or add Ollama on your own computer, free models on OpenRouter, or OpenAI or Anthropic with your own key.

## For learning

- **Record a class.** A live transcript, or a private one made on your device. "Lost here" marks and quick notes are stamped to the second. Audio stays on your device.
- **Ask about it.** "When is my math test?", "What's due this week?", "What is mitosis?" Type or talk.
- **Practice.** Seekto makes practice tests from your notes, both ways (term to meaning, meaning to term), and grades typed or spoken answers. Export to Quizlet, Anki, Google Forms, Kahoot or Moodle.
- **Share a test with your class.** One link opens the test for anyone, with nothing to install. The questions travel inside the link itself, so they're never stored on a server.
- **Assignments.** Paste the rubric to get a checklist and a schedule back from the due date, with your related notes and YouTube sources beside it. Import your Canvas, Google Classroom, Moodle or Blackboard calendar.

## For work

- **Record a meeting.** A consent check comes first, every time.
- **Decisions and action items.** Who does what, by when, pulled out as people talk. Dated items go on your calendar.
- **Follow-up email.** A recap with decisions and action items, ready to check and send from your own email app. Seekto never sends anything for you.
- **Ask about it.** "What are my action items?", "Draft a follow-up email."

Switch between Learning and Work at any time. Notes, search, talk mode, device sync and AI choice are shared.

## Privacy, in short

Everything you create stays in your browser unless you turn on sync. Device sync goes directly between your devices; a public message service (ntfy.sh, or your own) only helps them find each other. Storage sync is end-to-end encrypted in a database you own. AI is off until you choose a provider, and then only what you ask about is sent to it. There are no trackers or analytics. The details, including what each service can see, are in [docs/PRIVACY.md](docs/PRIVACY.md).

Transcripts are made either live by your browser's speech service (online in Chrome and Edge) or privately on your device with Whisper; you choose in Settings. Follow your school's and workplace's rules about recording.

## Run it locally

```sh
git clone https://github.com/enrjgy-tech/seekto.git
cd seekto
npm test          # engine tests: dates, meetings, calendars, quizzes, share links, sync, encryption
npm run build     # builds the static site into ./site
npm run serve     # serves ./site locally
```

No dependencies and no build step for the app. Node 20 or newer for the tests.

## How it's built

- **`app/`**: the web app in plain HTML, CSS and JavaScript modules. It installs as an app and opens offline after the first visit.
- **`engine/`**: the tested logic, usable on its own:
  - dates and deadlines in speech and text;
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

There are good first issues for every skill level: teach Seekto a date phrase or a meeting phrase it misses (each is one test and one rule), add a storage adapter, test it on your phone or Chromebook, or improve accessibility. See [CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](ROADMAP.md) and the [launch plan](docs/LAUNCH.md).

## License

Code: [MIT](LICENSE). Geist fonts: [SIL Open Font License](app/fonts/OFL.txt).
