# Contributing to Seekto

Thanks for helping. Small, focused pull requests are easiest to review.

## Good first contributions

Each of these takes an evening or less, and every one makes Seekto better for real people.

- **Teach Seekto a phrase it misses.** Someone says "the essay's due the Monday after break" or "Jordan's on point for the budget" and Seekto doesn't catch it. Add the sentence as a test in `engine/test/` (dates in `study.test.js` or `engine.test.js`, meetings in `meetings.test.js`), then make it pass in `engine/src/dates.js` or `engine/src/meetings.js`. No coding yet? Use the **"Seekto missed something"** issue form and someone else can pick it up.
- **Add a storage adapter.** Storage is one small interface in `app/js/cloud.js` (`register`, `put`, `changes`, `get`, `forget`). An S3-compatible, WebDAV or local-folder adapter is a self-contained project.
- **Test it where students and teams really are:** school Chromebooks, budget Android phones, iPhones, locked-down office laptops. Open an issue with what broke.
- **Accessibility:** keyboard use, screen readers, contrast and reduced motion.
- **Packs:** add a lecture transcript from a source that allows it. See [packs/README.md](packs/README.md).

Small, well-explained issues get the `good first issue` label. The launch plan is in [docs/LAUNCH.md](docs/LAUNCH.md).

## Before you open a pull request

```sh
npm test
npm run check:packs
npm run build
```

All three run in CI and must pass. CI also runs `app/supabase.sql` against Postgres and checks it as the browser's role.

## Ground rules

- Never add code that downloads or scrapes YouTube or any site that doesn't allow it.
- Keep the app working with no account, no server and no AI model. Anything that leaves the device must be optional and clearly labelled.
- Every pack states its source and its license exactly as the source gives them.
- New dependencies need a short reason in the pull request.

## Conduct

Be kind and assume good intent. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
