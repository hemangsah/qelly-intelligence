# UI rescue reference

`QELLY_EXPECTED_FULL_UI_WORKING.html` is the user-approved visual acceptance baseline for the draft Asset Rankings rescue pull request.

- It is served only by `.github/workflows/ui-review.yml` from a loopback HTTP server.
- It is not copied by `scripts/build-frontend.mjs`.
- It must not appear in `dist/frontend` or the GitHub Pages artifact.
- It contains no production credentials or infrastructure configuration.
- It will be removed from the branch before final merge after the user has approved the rendered UI, unless the user explicitly asks to retain it as design history.

Reference SHA-256: `ad6740c65f06ed74482ed28af991cce79158b96c5b23a196925f9cb7ee2620f2`
