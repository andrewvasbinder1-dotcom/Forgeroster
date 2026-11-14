# ForgeRoster

ForgeRoster is an unofficial Warhammer 40,000 11th-edition army builder.
Open the [live app](https://andrewvasbinder1-dotcom.github.io/Forgeroster/) or
serve this repository with any static HTTP server.

## Develop and verify

Run `python3 -m http.server 8000` and visit `http://localhost:8000/`.
Serve the site over HTTPS outside localhost to enable service workers.
Run `node --test tests/*.test.cjs` for JavaScript tests. To run the mobile smoke
test, install Python Playwright and its Chromium build, then run
`python3 tests/browser_smoke.py`. Pass the published URL to test GitHub Pages.

The Pages workflow publishes `main`. Confirm the workflow's commit and conclusion,
then open the deployed URL and check that a roster can be created after a fresh
load. When changing the app shell, update `sw.js` to match the assets referenced
by `index.html` and increment the cache version. The service worker caches only
static files required to reopen the app. Account authentication and cloud saves
require network access.

## Maintenance

- See [data sources and coverage](DATA_SOURCES.md) for points, profiles and edition updates.
- See [army validation](docs/VALIDATION.md) for implemented checks and metadata.
- See [rule packs](RULES_PACKS.md) for bundled coverage, source versions and the import schema.
- See [Supabase setup](AUTH_SETUP.md) for authentication configuration, migration,
  cloud sync behavior and verification.
- Rule packs carry a schema version, source and version. Update and review packs
  independently of the points snapshot, and preserve stable entry IDs.
- Review changes from the official downloads page and publish a new dated
  snapshot after checking affected records. Record missing or disputed values
  as unverified and use original rule summaries.

ForgeRoster is an independent project and is not affiliated with Games Workshop,
New Recruit or BattleScribe.
