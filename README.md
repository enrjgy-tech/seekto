# Seekto

**Paste a lecture, ask anything, seek to the exact second.**

Seekto turns a lecture into something you can ask. Load a lecture with its transcript, type a question, and Seekto finds the lines that answer it, marks them on the timeline and jumps the video to that second. Save any answer as a card with its source second, or export your cards to Anki.

It's free and open source, runs entirely in your browser, and needs no account. Nothing you load is uploaded.

**[Try it →](https://SEEKTO_PAGES_URL/)**

## What works today

This is an early build, made in public. Today you can:

- open the built-in sample lecture and ask it questions;
- load a YouTube link and its caption file (`.srt` or `.vtt`), or paste a transcript with timestamps;
- load a video or audio file with its captions and play from any answer;
- see the top three answers on the lecture timeline, with your words highlighted;
- save answers as cards, copy a link to the exact moment, and copy your cards for Anki.

Seekto never downloads or scrapes YouTube. Videos play in YouTube's own embedded player.

## What's coming

See [ROADMAP.md](ROADMAP.md). In short:

- **Packs:** thousands of prepared lectures built from transcripts that open course sites publish themselves, so a pasted link opens instantly on any device.
- **Notes while you watch:** a synced transcript beside the video, notes stamped to the second, and suggested key points.
- **Live class mode:** on-device transcription of a talk in the room.
- **Better answers:** short explanations under each clip, and free-form answers from a small in-browser model where your device supports it.
- **Spaced review** for your cards, and **Study together** links for a class.

## Who it's for

Students first, in every subject. Also anyone learning from lectures and talks: self-learners, people taking online courses for work, and researchers who study recorded talks.

## Run it locally

```sh
git clone https://github.com/SEEKTO_REPO.git
cd seekto
npm test          # engine tests, including retrieval checks on the sample lecture
npm run build     # builds the static site into ./site
npm run serve     # serves ./site locally
```

No dependencies are needed for the app or the tests. Node 20 or newer.

## For developers

The engine is a small, dependency-free module you can use on any page:

```js
import { parseCaptions, buildIndex, search, formatTime } from "./engine/index.js";

const cues = parseCaptions(await (await fetch("lecture.vtt")).text());
const index = buildIndex(cues);
for (const answer of search(index, "why does the list have to be sorted?")) {
  console.log(formatTime(answer.start), answer.text);
}
```

## Packs

A pack is a prepared lecture: its transcript, its source and its license. See [packs/README.md](packs/README.md) for the rules and how to add one. Packs are built only from sources that allow it, and every pack's license is checked in CI.

## Contributing

Contributions are welcome, especially packs, accessibility fixes and testing on phones and Chromebooks. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code: [MIT](LICENSE). Each pack keeps its own license, listed in its `pack.json`.
