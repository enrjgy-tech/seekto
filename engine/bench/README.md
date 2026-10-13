# How accurate is the engine?

Seekto finds deadlines, definitions and action items with rules, not an AI model. Rules can look great on the examples they were written for and fail on real speech, so we measure them on sentences they were **not** written for.

## The test set

`data/*.jsonl` holds 360 labelled items: class talk from US teachers, UK and Indian classes, US syllabus text, Spanish and Brazilian Portuguese classes, lecture definitions, and work meetings. Each item says when it was said, what it says, and what a careful person would put on the calendar.

- **Written blind, by AI.** The sentences were written by separate AI model sessions that were never given the code, the rules or the engine's output, and were told to make them sound like real people: fillers, self-corrections, reschedules, cancellations, past mentions, two deadlines in one sentence, day-first dates. For the current fresh set, another separate AI session checked every label before scoring. AI-written sentences can share habits that real speech doesn't have, which is one more reason real class transcripts are the next step.
- **Not real recordings.** They are written to sound like classes, but they aren't transcripts of real ones. Real (anonymized) class transcripts are welcome: see [CONTRIBUTING.md](../../CONTRIBUTING.md).
- **Two kinds of unseen data.** The fresh set (below) was written after the rules were finished. And of the first 360 items, half is held out. Items with an even number are the *test* half. Their mistakes are never printed, only counted, and rules are only ever fixed using the *dev* half. The test numbers are the honest ones.
- **Conventions.** For dates, weeks start on Monday (the calendar screens follow your locale). "Friday" means the next Friday after today; "next Friday" means Friday of next week; "next week" alone means its Monday. Numbers like 10/11 are month first in US and Canadian English and day first everywhere else.

## Fresh set: scored once

Fresh sets are written after the rules are finished, by AI sessions that never see the code, committed before they're scored, and scored once. Their mistakes aren't printed and rules must not be tuned on them.

**Current fresh set** (`data/fresh-*.jsonl`, 190 items, scored once on October 13, 2026): college lecturers in the US, UK, India and Australia; school teachers in the US, UK, Canada, Australia and India; Spanish from Spain, Argentina, Chile, Colombia and Mexico and Portuguese from Brazil and Portugal; meetings in a dozen kinds of workplace. A second reviewer checked the labels before scoring.

| | Found | Right, of what it adds |
|---|---|---|
| Deadlines and tests (150 items) | 76% (97 of 128) | 90% are a real deadline on the right date |
| Definitions (150 items) | 58% (31 of 53) | 82% are real definitions |
| Action items (40 meetings) | 76% (45 of 59), 4 extra | 85% name the right person, 84% the right due date |

"Right, of what it adds" counts every date Seekto would put on the calendar: a wrong date and a date that isn't a deadline at all both count against it.

**Earlier fresh set, now dev2** (`data/r2-*.jsonl`): scored once on October 12, 2026, before any rule was fixed on it: deadlines 78% found (90% right), definitions 35% (70%), action items 33% (57% right person). It was then opened up: its mistakes are printed with `--show`, and the October 13 rule changes (definitions said with fillers and asides, tasks given to someone mid-sentence, "end of the month", dates relative to another date) were fixed on it. That's why its own score is no longer reported, and why a new fresh set was written.

## Real lectures: quoted from real recordings

`data/real-lectures.jsonl` holds 54 sentences quoted verbatim from six real recorded lectures (Open Yale Courses: ECON 159, PSYC 110, GG 140, HIST 119, MCDB 150, BENG 100; each item carries its source URL; transcripts © Yale University, [CC BY-NC-SA](https://oyc.yale.edu/terms), so that one data file carries that license rather than the repo's MIT). The labels were written by hand from the transcripts *before* the engine was run on them, but they were not written blind the way the other sets were, so these numbers are a reality check, not a headline.

**At first contact** (scored once, October 13, 2026, before any fix): deadlines 2 of 5 found with 6 false alarms; definitions 6 of 9 found, 1 false. Real lecture talk is full of traps the written sets missed: "mid-term" with a hyphen, "the first one will go out on Monday but it will be due ten days later", "the labs are on Monday and Tuesday afternoon" (a schedule, not events), "you didn't know when the mid-term was", "something called sperm competition where…".

The odd-numbered half (realdev) is open: its mistakes print with `--show` and rules may be fixed on it (all five traps above were). The even-numbered half (realtest) is only ever counted, and currently stands at: **deadlines 2 of 2 found, 3 false alarms; definitions 4 of 6 found, 1 false.** CI fails if it drops. The next step is whole real recordings through Whisper, not just quoted sentences.

## A whole real recording: MIT 14.01, lecture 1

`data/real-audio.jsonl` is one complete lecture run through the same path the app uses: the recording (Jonathan Gruber, *14.01 Principles of Microeconomics*, Fall 2018, [MIT OpenCourseWare](https://ocw.mit.edu/courses/14-01-principles-of-microeconomics-fall-2018/), [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); copy on the [Internet Archive](https://archive.org/details/MIT14.01F18)) went through Whisper "base" and Seekto's cue cleanup, 35 minutes in about 5 on a GitHub runner (`.github/workflows/real-audio.yml`, run by hand; nothing from the recording is stored except this transcript). The transcript is cut into 28 pieces of 16 lines. That data file carries the lecture's license, not the repo's MIT; Whisper's errors are left in on purpose ("1401", "the restations", "Samielson").

What counts as right was written by hand from the transcript: 14 definitions a student would want as flashcards (microeconomics, opportunity cost, model, positive and normative analysis, market failures, invisible hand, command economy, capitalistic economy, demand curve, supply curve, market equilibrium, maximum surplus, budget constraint) and 2 dates (problem set 1 handed out "next Friday", and this Friday's section). Lines like "that will cover everything you've learned up through next Wednesday" are labelled as *not* events. The date is assumed to be Wednesday, September 5, 2018; the recording doesn't say.

**Two caveats.** The labels were written *after* I had read the engine's first output, so these labels are not blind. And I read the engine's output on the whole lecture once before splitting it, so the even pieces (audiotest) are not as untouched as the other held-out halves. Treat these numbers as a reality check.

| | At first contact | After fixes on the open half |
|---|---|---|
| Definitions found | 6 of 14 | 8 of 14 |
| Definitions offered that were wrong | **34** (15% of what it offered was real) | 6 (57% real) |
| Dates found | 1 of 2, 1 wrong date | 1 of 2, no wrong date |

What went wrong at first contact was ordinary speech that looks like "X is Y": "On the x-axis is the quantity of roses", "Therefore, it's the equilibrium", "Producers are happy because…", "Auctions are a terrific example", "Higher price means you make more money". The fixes are general rules about what a *term* is (a noun phrase, not a clause that starts with a preposition, a comparative or "I'll"), what a definition isn't ("happy…", "an example of…", a passive "driven by…"), and two real patterns: "Where the points meet is the market equilibrium" (description first, term second) and "…is what's called the command economy" (the next sentence says what it is). Across all 822 labelled items, the share of definitions that are real went from 73% to 87%, and no other set moved down. Still missing: a definition said across a pause ("what we're going to call maximum surplus. Which is…"), a garbled one ("we know about demand curve is it simply represents…"), and "this Friday the section is all new material" (a class meeting, not a due date).

## Results on the held-out half

| | Found | Right, of what it adds |
|---|---|---|
| Deadlines and tests (155 items) | 90% (100 of 111) | 93% are a real deadline on the right date |
| Definitions (75 items) | 70% (21 of 30) | 78% are real definitions |
| Action items (25 meetings) | 82% (18 of 22), no extra items | 85% name the right person, 94% the right due date |

The action-item score counts items, then checks owners and due dates; it doesn't yet check that the task wording matches.

Before the rules were rewritten on October 12, 2026, the same held-out half scored 34% found and 52% correct for deadlines, 40% and 75% for definitions, and 41% for action items. On the dev half the rules now score close to 100%, which says more about tuning than about accuracy; that's why only the test half is reported.

Run it yourself:

```sh
npm run bench                         # dev, dev2, test, fresh and all
node engine/bench/run.mjs --show      # every dev and dev2 mistake, to fix rules from
```

CI runs `node engine/bench/run.mjs --check`, which fails if a change lowers any held-out score more than one point below `floor.json`.

## Known weak spots

- Definitions said in a roundabout way ("the thing where the cell..."), two terms in one sentence, and definitions without a verb ("an isotope, same element, different neutrons").
- Holidays and school calendars ("the Monday after Thanksgiving", "after half term").
- Hedged plans ("I think the quiz might be Friday") are treated as real.
- French and other languages: not yet.
