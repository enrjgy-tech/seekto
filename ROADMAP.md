# Roadmap

Seekto is built in public. This roadmap is the plan, not a promise of dates.

## Now (October 2026)

- [x] Working app: sample lecture, YouTube link plus captions, video or audio files, pasted transcripts
- [x] Ask: ranked answers, timeline marks, jump to the exact second
- [x] Cards with source second, moment links, Anki copy
- [x] Engine module with tests, including retrieval checks
- [x] Pack format, license rules and CI checks
- [ ] Pack pipeline for open course sites that publish transcripts (NPTEL, MIT OpenCourseWare, Open Yale Courses, CS50), after checking each site's terms
- [ ] First 100 packs, matched to their YouTube videos using each course site's own listing

## Next

- **Notes while you watch:** synced transcript beside the video; notes stamped to the second; "My notes" and "Auto notes" modes.
- **Packs at scale:** 5,000 basic packs across at least five subjects, plus 300 full packs with cards and checked explanations.
- **Live class mode:** record a talk on your device, transcribe on-device, tap "lost here", replay the speaker at the cited second.
- **Better answers:** short explanations checked against a published rubric; free-form answers from an in-browser model where WebGPU works, or your own endpoint.
- **Spaced review** with FSRS, and **Study together** links for a class.
- **Embed:** a one-tag `<seekto-player>` for course pages and docs sites.

## Later

- **Plan:** read-only Canvas sync, `.ics` import, deadlines next to lectures, and "ask your professor" email drafts that open in Gmail for you to send.
- **Talking mode:** ask out loud, hear the answer.

## Launch checks

The big public launch waits for these, measured and published here:

- a full design-system pass;
- 20 moderated sessions with students, at least 90% success on paste, ask, then open the clip;
- a System Usability Scale score of 80 or more;
- performance budgets met on Chromebooks, budget phones and low-end laptops;
- 5,000 basic packs and 300 full packs;
- a WCAG 2.2 AA audit, a published threat model and a trademark check.
