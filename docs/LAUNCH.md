# Launch plan

Dates are proposed by the maintainer's plan and confirmed a week ahead. Nobody is ever asked to star, upvote or vote, and every post says who made Seekto and what it can't do yet.

## The one thing to show

Seekto launches as a student tool. Every post leads with one moment: a teacher says "the quiz is on Friday", it lands on the calendar, and the lesson becomes a practice test a classmate opens from a link. That's the hero GIF at the top of the README, plus **Try a sample class** (no microphone, account or AI needed). Work mode for meetings stays in the app and gets its own launch on Nov 16.

## Timeline (proposed)

| When | What | Where | Ready when |
|---|---|---|---|
| Oct 19–30 | Private preview with 20 people: 12 students (high school and college), 8 working adults | Friends, classmates, one club, two teams | Each person records or loads a sample, asks two questions and shares one test; fixes from their notes ship |
| Nov 2 (Mon) | Main launch, for students | Show HN ("Show HN: Seekto – record a class, get the deadlines and a shareable practice test, no account or AI needed"), r/GetStudying, r/college; one post per community, written for it | Preview task success at 90% or better; no open data-loss bugs |
| Nov 3–6 | The technical crowd | r/selfhosted (bring-your-own encrypted storage), r/localLLaMA (Whisper in the browser, Ollama, no-AI mode), r/javascript (no build step, no dependencies) | HN feedback fixed |
| Nov 9 | Technical write-up as a second wave | Blog post linked from the repo: "End-to-end encrypted sync to your own Supabase in plain JavaScript" (Hacker News, Lobsters, r/javascript) | Outside read of docs/PRIVACY.md |
| Nov 16 | Work | r/productivity, r/remotework, Product Hunt | Work mode feedback from the preview fixed |
| Late Nov–Dec | Finals season | Share-a-test links are the hook; short videos by students who used it, unscripted | Share links tested on school Chromebooks and iPhones |
| Jan 2027 | New semester | Student communities again, with what changed since November | Calendar import and recording tested with that term's users |

## What we watch

Seekto has no analytics, so we only use public signals: stars, forks, issues and discussions, and whatever preview testers tell us. After each wave: the three most common problems become issues within a day, and the top one is fixed within a week.

## If something goes wrong

- A bug that loses data: post it at the top of the README and in each thread, fix it before anything else, and say plainly what happened.
- An AI provider problem: Seekto works without AI, so the posts point people to the no-AI path.
- Too many issues at once: label `triage`, answer each within 48 hours, and pause the next wave.
