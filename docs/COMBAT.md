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
- Mixed save and wound allocation groups can be entered manually in defender allocation order and use labeled seeded simulation for probabilities. Select a visible Character group to resolve Precision, with ordinary allocation resuming when it dies. FNP restricted to
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

### Model weapon loadouts

Open **Model weapon loadout** on a roster unit. Record each model and its
weapon profiles, including repeated copies, then save. Mark lost models as
casualties. The calculator uses the recorded total number of surviving
copies only when every model is recorded. Clear the override for a manual
estimate. A loadout is combat input, separate from verified army equipment
restrictions. For weapons with alternative profiles, select only the profile
you intend to resolve. Unit size changes ask before clearing the loadout.

### Scenario casualties

Select a roster attacker and use **Models Remaining** for a quick count.
With a uniform recorded loadout, changing ten models to nine immediately
removes one model's weapons. With mixed equipment, open **Manage Casualties**
to mark the lost bearer or enter a confirmed surviving weapon count. Wounded
models retain their weapons and their remaining wounds are saved for
reference. Conditional abilities keyed to wounds still use the modifier
controls. Choose a standard melee weapon for each model with alternatives;
Extra Attacks profiles can be queued separately.

Scenario saves include model status, equipment and remaining wounds. Roster
data stays unchanged. Queued attack entries retain their configured counts;
requeue them after changing casualties to use the new counts.

### Attached weapon profiles and queued attacks

Weapons with matching names on different attached units are listed separately,
with their source unit shown. Counts use only the models from the profile's
source. Legacy equipment records store names, so genuinely different variants
sharing one name on the same datasheet still require manual confirmation.

Queued attacks retain their original input. When revisiting the same attacker,
casualty and bearer changes flag pending attacks for review. For the active
weapon, changes to combat inputs also flag the snapshot. Select that weapon
before recalculating it, keep the original snapshot explicitly, or remove the
attack. Finished dice rolls remain in the session history when inputs change.

Saved scenarios retain up to 60 lines from completed live rolls. Long dice rows are abbreviated. Loading a scenario restores that history for review.

Queued attacks track attacker changes separately from target edits. Changing target characteristics updates the resolution without asking for a new weapon count.

## Keyword reference

The keyword dialog links to the June 2026 11th-edition Core Rules PDF. Its explanations are original. The reference identifies the publication revision and section and labels classifications separately from attack abilities. Missing definitions retain their visible label and can link back to the originating datasheet.

The calculator builds keyword activity from the same compiled attack it uses for probability and live rolls. The state describes the current attack at the time the popup opens. Resolve timing- and roll-dependent effects during play. An attack with no eligible weapons or a targeting error cannot activate those weapon effects.

New saved scenarios record the keyword reference revision. The release bundles only one reference revision. A future update that changes mechanics needs archived version dispatch before old scenarios can be replayed under their original mechanics.
