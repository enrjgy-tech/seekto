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

## More lectures: training, and a blind test that failed

`data/real-audio-train.jsonl` (151 items) holds five more complete MIT OpenCourseWare lectures, transcribed the same way and labelled by hand from the transcript ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), Whisper errors left in): 14.01 lecture 2 (Gruber, microeconomics), 7.016 lecture 1 (biology), 9.00SC lecture 1 (psychology), 5.111 lecture 2 (chemistry), 3.091 lecture 1 (materials). Its mistakes print with `--show`, and rules may be fixed on it.

- **First contact with the first three lectures** (97 items): 3 of 22 definitions found, **43 false**. The mistakes were the same kind as in lecture 1: running speech that looks like "X is Y", and real definitions said in the middle of a sentence ("things known as lipid bilayers, which are…", "what psychologists call attentional resources") or spread over two sentences ("The first is completeness." / "What I mean by that is…"). After general rules for both: 18 of 24 found, 3 false.
- **Blind test on the next two lectures** (5.111 and 3.091, 54 items). I wrote the labels from the text first, ran the engine once, and did not look at its mistakes before reporting: **0 of 8 definitions found, 15 false.** The false alarms were things like "How is everyone doing?", "Since then, it's been replicated…", "Mass is being lost". That is the honest first-contact number for lecture talk the rules had never seen.
- Those two lectures can no longer be blind. After the score was recorded I looked at the mistakes, fixed the *general* causes (question words and "since/even though/not" as terms; predicates like "being…", "credited with", "greater than", "how to…", "another part of…"; a short sentence is not a heading; "got the name of X"; "the X model, where…"), and folded them into the training set (they are in the 151 above). Afterwards on those same lectures: 2 of 8 definitions found, 2 false (so that number is now tuned, not blind). Nothing else got worse (fresh set: same 31 of 53 found, 6 false).
- **23 more lectures, every offered definition judged by hand** (`judgments/definitions.jsonl`, 11 courses: physics, biology, chemistry, economics, psychology, AI, programming, blockchain): 382 offered, about 78 real, **about 20% right**. That is the number to believe for real lecture speech. A learned confidence score on 20 checkable features (now attached to every definition the engine returns, with its reasons) separates real from false only moderately: keeping the top 40 by confidence gives about 60% real. Small on-device language models tried as a second opinion did no better (flan-t5-small at chance, flan-t5-base AUC 0.60; `.github/workflows/def-model.yml`).
- **Deadlines on the same 23 lectures:** only 3 real, datable deadlines were said at all (OCW lectures carry little admin talk). First contact: all 3 found, 6 wrong ("that part of his paper we'll talk about next Tuesday", "2/11 on the board", "which you saw last time", "I had planned to tell you everything for the problem set by today"). After general rules for those: 2 found, 0 wrong (the miss is office hours moved to next Wednesday, which the engine skips by design).
- **What the judged set taught, and what changed.** Tagging every candidate with the rule that produced it showed where the false ones come from: the bare "X is Y" shape gave 258 of the 382 candidates and only 16% of those were real, while the shapes with a naming word ("called X, which is", "what we call X", "X means") were 40 to 60% real. So in a long transcript a bare "X is Y" now needs extra evidence (X is course vocabulary said more than once or introduced with a naming word; Y opens like a noun phrase; no arithmetic). On the same 23 lectures that takes the engine from 382 offered / 78 real (20%) to **127 offered / 57 real (45%)**, still finding 57 of the 82 real ones. Those are tuned numbers. The confidence score was refitted on what remains (`fit-definitions.py`; leave-one-lecture-out AUC 0.69): at 0.5 and above, about 62% of suggestions are real.
- **Third blind test, eight lectures never read until now** (MIT 14.01SCF lec 9, 15.S12 lec 9, 3.091 lec 5, 5.111 lec 6, 6.0001 lec 5, 7.013 lec 23, 8.286 lec 4, 9.00SCF lec 6; judged by hand before any fix): the engine offered 35 suggestions, **16 real, 19 false (46% precision)**; two of the real ones are the same definition heard twice, so 14 distinct. Recall was **not measured** on these (I did not read the full transcripts for misses), so there is no recall number. The false ones are mostly a describing sentence after a topic word ("Heisenberg uncertainty principle :: But that was it...", "Per mega-parsec", "Element inside here"). This is in line with the earlier ~45%, not better. The judgments are in `judgments/definitions.jsonl` (`blind: 2`); the confidence model was not refitted on them.
- **Could a small on-device language model check the suggestions?** Measured on the judged candidates (`test/def-model-eval.mjs`, run on a GitHub runner): flan-t5-small AUC 0.50, flan-t5-base 0.60, Qwen2.5-0.5B 0.83 and Qwen2.5-1.5B 0.80 on all 387 candidates (rule features alone: 0.72 with whole lectures held out). Combined with the rule features on the 122 candidates the rules still offer, whole lectures held out: Qwen-1.5B plus rules AUC 0.80; keeping only the top scores gives 79% real at 49% recall, 89% at 32%, 100% at 13% (small sample, wide error). A model of that size is about 1 GB to download, so it would have to be optional. Three more rule signals tried first (term used again after the definition, an example right after, an introducing sentence before) changed nothing (AUC 0.72 to 0.72) and were not kept. Nothing here reaches 90% precision at a recall students would accept.
- **What makes a definition true or false: patterns in the 420 judged candidates.** (1) "That's called X" names what was just said, so the meaning is the sentence or two *before* it; the engine used to take the one after, and only 5 of 14 were right that way. Reading backwards (and the next sentence too when it comes back to X) gets about 8 of 14 by hand, and the engine now does it (rule `named-back`). (2) A bare "X is Y" is a definition only 18% of the time (48 of 270); it is more likely when Y is a general noun phrase of 10 to 30 words and X is course vocabulary mentioned several times, and unlikely when X is a person ("Satoshi is the one who…"), when Y speaks of "I", "we're going to" or past events, or points at the board ("here", "this one"). Five signals for that (`defTalk`, `defPast`, `defHere`, `termPerson`, `termDeixis`) were chosen from reading the examples, not searched for, and lift the held-out-lecture AUC from 0.80 to 0.82. (3) "X, which is Y" is real only 2 of 10 times: Y is often "where we're going" or "kind of cool", not a meaning. (4) A bare "X." followed by a sentence is real 4 of 28 times. A search that added whichever of 40 signals scored best on 387 examples reached 0.86 on them and fell to 0.65 on 8 lectures it had not seen, so it was dropped.
- **Second blind test, two lectures never read until now** (14.01 lecture 3, 7.016 lecture 2; labelled by hand after the engine ran, so this is precision judged blind and recall estimated from a read of the transcripts): 9 real definitions; the engine offered 11, **5 real, 6 false**. The first blind test was 0 of 8 found with 15 false. Two misses were then fixed with general shapes ("called X, because Y", "and X, which are Y"), after which these two lectures count as tuned (7 of 9, 6 false).

Other things this exposed: a definition whose term and meaning are far apart ("they later called *this* the nucleus", where *this* is two sentences back) is out of reach for sentence rules; and the labels I judged "real" were about 8 per lecture, so a few percentage points either way are one sentence.

## Study notes: the lines a student would keep

`engine/src/notes.js` picks about 1 sentence in 10 from a transcript (course vocabulary, teaching cues such as "called" and "because", not chat, not a question, not a story), finds the course words, and puts a heading where the teacher says "let's talk about X". Judged by hand on three whole lectures (14.01 lecture 12, 8.286 lecture 8, 7.013 lecture 21; the first two were used to adjust the rules, the third was read only after): **95 of 157 kept lines (about 60%) are lines a student would write down**; the rest are half-sentences, asides or stories. Of the 73 real definition sentences in the judged set, 36 land in the kept tenth (false-definition sentences: 66 of 281). The user sees these lines with course words highlighted and the full transcript one tap away.

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
