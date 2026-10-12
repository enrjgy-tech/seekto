# Seekto

**Your study assistant. Record class, and Seekto keeps your notes, your deadlines and your studying in one place.**

Seekto is a free, open-source study assistant that runs in your browser. Talk to it or type to it:

- **"When is my math test?"** It checks your calendar.
- **"What's due this week?"** It lists what's coming up.
- **"Quiz me on chapter 5."** It makes a practice test from your notes and grades your answers, typed or spoken.
- **"What is mitosis?"** It finds the answer in your notes.

**[Try it →](https://enrjgy-tech.github.io/seekto/)**

## What it does

- **Record a class.** Audio stays on your device. You get a live transcript where your browser supports it, "lost here" marks and quick typed notes, all stamped to the second.
- **Notes that organize themselves,** by date, subject and topic. Search everything, replay the teacher at any line, and ask a note questions.
- **A calendar that fills itself.** When a teacher says "the quiz is on Friday" or you type "essay due October 20th", it goes on your calendar. Import your Canvas, Google Classroom, Moodle or Blackboard calendar as an .ics file.
- **Research & assignments.** Paste the rubric and it becomes a checklist and a schedule back from the due date. See your related notes, add YouTube videos as sources and ask them questions, and get a plan or research brief with an AI model.
- **Practice tests,** both ways: term to meaning and meaning to term. Export to Quizlet, Anki, Google Forms or Kahoot (CSV), or Moodle (GIFT).
- **Connect your devices with a code.** Choose "Connect a device" on your computer to show a 6-letter code, type it on your phone, tap Allow, and they stay in sync: notes, recordings, calendar and assignments. Record on your phone, study on your computer.
- **Your own account, no sign-up.** Turn on storage and Seekto gives you an account key, a 24-character code that is your whole account: no email, no password. Your data is encrypted on your device with that key and kept in a free Supabase project you own, so devices stay in sync even when they're not on at the same time. Seekto never hosts anyone's data.
- **Talk mode.** Ask out loud, hear the answer, and get quizzed by voice.
- **Your choice of AI, or none.** Everything above works without AI. Add a model for open questions, summaries, better quizzes and research briefs:
  - **on your computer:** Ollama, private and free;
  - **free cloud:** OpenRouter's free models;
  - **paid cloud:** OpenAI, Anthropic, or any OpenAI-compatible service.

  Keys stay on your device and go only to the service you choose.

It works best on a computer. On a phone, it's built around recording, with quick questions and your calendar.

## Privacy

Your notes, recordings and calendar are stored in your browser on your device. There's no account and no Seekto server. Live transcripts use your browser's speech service; in Chrome and Edge that is processed online by the browser maker. Always follow your school's rules and ask before recording a class.

**Connected devices** sync directly with each other over an encrypted WebRTC connection, not through a Seekto server. To find each other they use a public message service, [ntfy.sh](https://ntfy.sh) by default (you can set your own ntfy server in Settings). Only connection setup passes through it: device names, random device ids and network addresses. A new device needs the code and a tap on Allow on the device showing it; after that, paired devices prove a shared secret each time they reconnect. AI keys are never synced.

**Your account and storage** are optional. The account key never leaves your devices except when you hand it to another device yourself (by typing it, or with Allow on a connected device after checking a 4-digit match code). Before anything is sent to your storage, it is encrypted on the device (AES-GCM, with keys derived from the account key by HKDF) and bound to its item id and version, so the storage can't read it, swap items, or pass an old copy off as new. The storage sees an account id, opaque item ids, version numbers, sizes and timing, nothing else. Its tables are closed to direct access; the app only uses a few functions that check a per-account write token, stored as a hash. If you lose the key and all your devices, nobody can recover the data. Changing the key encrypts everything again and deletes the old copy, so a lost device loses access. The setup script is [`app/supabase.sql`](app/supabase.sql). Devices on networks that block direct connections (some school networks) may not be able to connect; using the same Wi-Fi helps.

## Run it locally

```sh
git clone https://github.com/enrjgy-tech/seekto.git
cd seekto
npm test          # engine tests: dates, calendars, quizzes, the assistant, AI requests, search, sync, encryption
npm run build     # builds the static site into ./site
npm run serve     # serves ./site locally
```

No dependencies. Node 20 or newer.

## How it's built

- `app/`: the web app (plain HTML, CSS and JavaScript modules, no build step).
- `engine/`: the tested logic the app uses:
  - finding dates and deadlines in speech and text;
  - reading and writing .ics calendars;
  - subject and topic detection;
  - definitions and quizzes;
  - answer checking;
  - understanding questions like "when is my test";
  - transcript search;
  - pairing codes and the rules for syncing devices;
  - account keys and end-to-end encryption for your own storage;
  - requests to each AI provider.
- `packs/`: prepared lecture transcripts with their licenses, for research sources.

## Contributing

Contributions are welcome, especially testing on phones and Chromebooks, accessibility, and better date and topic detection. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [roadmap](ROADMAP.md).

## License

[MIT](LICENSE).
