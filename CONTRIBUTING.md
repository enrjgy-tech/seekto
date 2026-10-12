# Contributing to Seekto

Thanks for helping. Small, focused pull requests are easiest to review.

## Good first contributions

- **Packs:** add a lecture from a source that allows it. See [packs/README.md](packs/README.md).
- **Testing:** try the app on your phone, Chromebook or school laptop and open an issue with what broke.
- **Accessibility:** keyboard use, screen readers, contrast and reduced motion.
- **Retrieval:** add a question to the golden checks in `engine/test/engine.test.js` that the search gets wrong, then improve the search.

## Before you open a pull request

```sh
npm test
npm run check:packs
npm run build
```

All three run in CI and must pass.

## Ground rules

- Never add code that downloads or scrapes YouTube or any site that doesn't allow it.
- Keep the app working with no account and no server. Anything that leaves the device must be optional and clearly labelled.
- Every pack states its source and its license exactly as the source gives them.
- New dependencies need a short reason in the pull request.

## Conduct

Be kind and assume good intent. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
