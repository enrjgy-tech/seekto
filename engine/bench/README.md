# How accurate is the engine?

Seekto finds deadlines, definitions and action items with rules, not an AI model. Rules can look great on the examples they were written for and fail on real speech, so we measure them on sentences they were **not** written for.

## The test set

`data/*.jsonl` holds 360 labelled items: class talk from US teachers, UK and Indian classes, US syllabus text, Spanish and Brazilian Portuguese classes, lecture definitions, and work meetings. Each item says when it was said, what it says, and what a careful person would put on the calendar.

- **Written blind.** The sentences were written by writers who were not allowed to open the code, and were told to make them sound like real people: fillers, self-corrections, reschedules, cancellations, past mentions, two deadlines in one sentence, day-first dates.
- **Not real recordings.** They are written to sound like classes, but they aren't transcripts of real ones. Real (anonymized) class transcripts are welcome: see [CONTRIBUTING.md](../../CONTRIBUTING.md).
- **Two kinds of unseen data.** The fresh set (below) was written after the rules were finished. And of the first 360 items, half is held out. Items with an even number are the *test* half. Their mistakes are never printed, only counted, and rules are only ever fixed using the *dev* half. The test numbers are the honest ones.
- **Conventions.** Weeks start on Monday. "Friday" means the next Friday after today; "next Friday" means Friday of next week; "next week" alone means its Monday. Numbers like 10/11 are month first in US English and day first everywhere else.

## Fresh set: scored once

After the rules were finished, four more writers (again without access to the code) wrote 190 new items: US college lectures, school teachers in the US, UK, Canada and Australia, Spanish and Brazilian Portuguese classes, and meetings in very different workplaces. The files (`data/fresh-*.jsonl`) were committed before they were scored, and they were scored once, on October 12, 2026:

| | Found | Right when found |
|---|---|---|
| Deadlines and tests (150 items) | 78% (102 of 131) | 90% have the right date |
| Definitions (about 100 items) | 35% (16 of 46) | 70% are real definitions |
| Action items (40 meetings) | 33% (13 of 40) | 57% name the right person, 92% the right due date |

These are lower than the held-out half, which is expected: the held-out half shares writers and styles with the sentences the rules were fixed on. The fresh numbers are the better guide to a class Seekto has never heard. Their mistakes are never printed, and the rules must not be tuned on them; they'll be scored again only at releases.

## Results on the held-out half

| | Found | Right when found |
|---|---|---|
| Deadlines and tests (155 items) | 88% (98 of 111) | 92% have the right date |
| Definitions (75 items) | 57% (17 of 30) | 71% are real definitions |
| Action items (25 meetings) | 82% (18 of 22), no extra items | 85% name the right person, 94% the right due date |

The action-item score counts items, then checks owners and due dates; it doesn't yet check that the task wording matches.

Before the rules were rewritten on October 12, 2026, the same held-out half scored 34% found and 52% correct for deadlines, 40% and 75% for definitions, and 41% for action items. On the dev half the rules now score close to 100%, which says more about tuning than about accuracy; that's why only the test half is reported.

Run it yourself:

```sh
npm run bench                         # dev, test and all
node engine/bench/run.mjs --show      # every dev mistake, to fix rules from
```

CI runs `node engine/bench/run.mjs --check`, which fails if a change lowers any held-out score more than one point below `floor.json`.

## Known weak spots

- Definitions said in a roundabout way ("the thing where the cell...") and two terms in one sentence.
- Holidays and school calendars ("the Monday after Thanksgiving", "after half term").
- Hedged plans ("I think the quiz might be Friday") are treated as real.
- French and other languages: not yet.
