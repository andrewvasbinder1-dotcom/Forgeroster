# Combat calculator

Open the **Combat calculator** tab, use a weapon link in the catalogue, or start
from a roster entry. The direct URL is
[ForgeRoster combat](https://andrewvasbinder1-dotcom.github.io/Forgeroster/#combat).
For an independent baseline, choose **Load example**. The reference result is 3+
to hit, 3+ to wound, 5+ to save, 2.37 expected damage before overkill, and a
34.1773% chance to destroy the three-wound target.

## Rules and calculation

The [June 2026 Games Workshop Core Rules](https://www.warhammer-community.com/en-gb/articles/nhqt9wx3/new40k-rules-download-the-free-core-rules-now/)
are the primary reference. Cross-check [Core Rules](https://wahapedia.ru/wh40k11ed/the-rules/core-rules/)
and the [Rules Appendix](https://wahapedia.ru/wh40k11ed/the-rules/rules-appendix/).
The UI lists provenance for active effects. Updates to rule summaries do not
change executable behavior. Review `combat-engine.js` and its regression tests
when a publication changes an effect.

- The engine resolves attacking eligibility, contextual keyword effects, adjusted
  characteristics, capped hit and wound modifiers, natural rolls, rerolls, saves,
  damage, and model allocation. Cover changes BS under 11th edition.
- Exact distributions for homogeneous targets track remaining wounds after each
  damage packet. The displayed unsaved damage expectation includes every
  unrestricted damage packet. Wounds lost and kill results cap overkill at each
  model. Expected rerolls use a reroll-failures strategy when any die is eligible.
  Live rolls allow a different choice.
- Multi-profile results use the queue order and separate target states. Select
  the number of eligible models, their weapons, and any split melee allocations.
  Monte Carlo uses seeded pseudorandom draws and is labeled separately from exact
  results. Live play uses browser cryptographic random draws when available.
- The catalogue supplies candidate weapons, stats and keyword names. It lacks
  complete bearer and replacement mappings. Confirm the actual loadout manually.
  The selected unit's faction, detachment, and attached-unit rules are available
  for reference. Apply supported numeric effects manually when conditions are met.
- Mixed save and wound allocation groups, Precision overflow, FNP restricted to
  particular damage sources, one-off damage cancellation, and bespoke or unverified
  faction effects require manual handling. The calculator does not decide movement,
  visibility, and positioning from tabletop geometry.

## Account scenarios

Guest scenarios save in the current browser. Apply
[`supabase/combat_scenarios.sql`](../supabase/combat_scenarios.sql) in the project's
Supabase SQL Editor to enable account scenarios. The table has owner-based RLS
and excludes anonymous access. The browser filters reads by the authenticated
user as well. The calculator reads account rosters through the existing cloud
library and saves scenario snapshots in a dedicated table.

Verify the hosted migration with two test accounts. Save a scenario with account
A, load it from a second session for A, then verify that B cannot see or load it.
The static Pages deploy does not run SQL migrations.

Run `node --test tests/*.test.cjs scripts/test-mfm.mjs`.
