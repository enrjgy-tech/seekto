# Contributing to Seekto

Thanks for helping. Small, focused pull requests are easiest to review.

## Good first contributions

- **Testing:** try the app on your phone, Chromebook or school laptop and open an issue with what broke.
- **Date detection:** add a sentence a teacher might say to `engine/test/study.test.js` that Seekto gets wrong, then fix it in `engine/src/dates.js`.
- **Packs:** add a lecture transcript from a source that allows it. See [packs/README.md](packs/README.md).
- **Accessibility:** keyboard use, screen readers, contrast and reduced motion.

## Before you open a pull request

```sh
npm test
npm run check:packs
npm run build
```

All three run in CI and must pass.

## Ground rules

- Never add code that downloads or scrapes YouTube or any site that doesn't allow it.
- Keep the app working with no account, no server and no AI model. Anything that leaves the device must be optional and clearly labelled.
- Every pack states its source and its license exactly as the source gives them.
- New dependencies need a short reason in the pull request.

## Conduct

Be kind and assume good intent. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
