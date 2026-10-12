# Packs

A pack is a prepared lecture: its transcript, where it came from, and its license. When someone pastes a YouTube link that matches a pack, Seekto opens it instantly on any device.

## Rules

Packs are built only from sources that allow it:

- **course-site**: transcripts a course publishes on its own site under an open license (for example NPTEL under CC BY-SA, MIT OpenCourseWare and Open Yale Courses under CC BY-NC-SA);
- **creator-captions**: captions the video's creator supplies;
- **connected-channel**: a channel whose owner connects it;
- **original**: material written for Seekto.

Nothing is ever downloaded or scraped from YouTube.

## Layout

```
packs/<pack-id>/
  pack.json        manifest (see schema.json)
  transcript.vtt   or transcript.srt
```

`npm run check:packs` validates every manifest and transcript. CI runs it on every pull request.

## Add a pack

1. Copy `sample-binary-search/` to a new folder named after the lecture.
2. Put the transcript in as `.vtt` or `.srt`.
3. Fill in `pack.json`, including the source URL and the license exactly as the source states it.
4. Run `npm run check:packs`, then open a pull request.
