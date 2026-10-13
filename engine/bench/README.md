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

## Results on the held-out half

| | Found | Right, of what it adds |
|---|---|---|
| Deadlines and tests (155 items) | 89% (99 of 111) | 93% are a real deadline on the right date |
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
