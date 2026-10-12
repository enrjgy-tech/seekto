# Roadmap

Seekto is built in public. This is the plan, not a promise of dates.

## Working now

- [x] Assistant home with guided first steps and suggestions
- [x] Answers from your own notes and calendar with no AI ("when is my math test", "what's due this week", "what is mitosis")
- [x] Talk mode: ask out loud, hear answers, quiz by voice
- [x] Record a class: audio on device, live transcript where the browser supports it, "lost here" marks, typed notes stamped to the second
- [x] Notes organized by date, subject and topic, with search, playback from any line and questions
- [x] Calendar: dates found in recordings and notes, .ics import (Canvas, Google Classroom through Google Calendar, Moodle, Blackboard) and export
- [x] Research & assignments: rubric checklist, schedule from the due date, related notes, YouTube videos as sources with questions, links
- [x] Practice tests in both directions, with exports for Quizlet, Anki, CSV (Google Forms, Kahoot) and Moodle
- [x] AI model choice: none, Ollama on your computer, OpenRouter free or paid models, OpenAI, Anthropic, or any OpenAI-compatible service
- [x] Backup and restore
- [x] Learning and Work modes: meetings with a consent check, decisions, action items with owners and dates, and a follow-up email draft
- [x] Try a sample class or meeting with one click (no microphone, account or AI)
- [x] Share a practice test as a link that opens with no install; the questions live in the link, not on a server
- [x] Private on-device transcription with Whisper (any modern browser, offline after one download, about 100 languages)
- [x] Installs as an app and opens offline; fonts served with the app, no third-party requests
- [x] Your own account with no sign-up: a 24-character key, end-to-end encryption, and storage in a Supabase project you own (Seekto hosts nothing)
- [x] Connect devices with a 6-letter code: direct encrypted sync of notes, recordings, calendar and assignments, with Allow on first pairing and automatic reconnects

## Next

- **Live on-device transcription:** today Whisper runs when you stop recording; next, while you record.
- **Writing helper for Google Docs:** a browser side panel that shows your related notes, the rubric checklist and your sources while you write.
- **Live school sync:** Canvas and Google Classroom connections that keep deadlines up to date without exporting files.
- **Direct test upload** to connected sites (Canvas quizzes, Google Forms, Quizlet).
- **Phone app polish:** install as an app, record with the screen off.
- **More storage choices:** the storage layer is one small interface (register, put, changes, get, forget); S3-compatible storage, WebDAV or a synced folder can be added by pull request when people ask for them.
- **Sync on hard networks:** an optional relay for networks that block direct connections, and a QR code as well as the typed code.
- **Spaced review** that schedules your practice tests before each exam.

## Launch

The proposed dates and channels are in [docs/LAUNCH.md](docs/LAUNCH.md).

## Launch checks

The big public launch waits for these:

- 20 sessions with students, at least 90% success on record, ask, and add a deadline;
- a System Usability Scale score of 80 or more;
- performance budgets met on Chromebooks, budget phones and low-end laptops;
- a WCAG 2.2 AA audit, a published threat model and a trademark check.
