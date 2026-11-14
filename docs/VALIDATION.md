# Army validation

The builder uses the Warhammer Community [11th-edition army-building article](https://www.warhammer-community.com/en-gb/articles/95fucn12/building-an-army-in-the-new-edition-of-warhammer-40000/) and the [Munitorum Field Manual](https://mfm.warhammer-community.com/en) for battle-size limits and catalogue facts. Rules in sections 19 and 25 were cross-checked against [Wahapedia's 11th-edition core reference](https://www.wahapedia.ru/wh40k11ed/the-rules/core-rules/). Game and event rules remain authoritative.

Run the focused check suite with `node --test tests/validation.test.cjs`.

## Supported checks

- The 1,000 and 2,000 point game sizes have distinct unit, enhancement and detachment point budgets. A single 3 DP detachment is permitted at Incursion.
- Duplicate detachments, unit copy limits, Epic Heroes and the Battleline and Dedicated Transport exceptions.
- Faction catalogue membership, exact or explicitly configured range pricing, ordinal pricing tiers, and selected upgrades or costed equipment.
- Warlord assignment and structured mandatory or ineligible Warlord flags.
- Enhancement sources, distinct count, repeatable Upgrades, recipient eligibility, and one enhancement across an attached unit.
- One Leader and one Support per eligible bodyguard, and mandatory attachment for Support units.
- Explicit supply of required and forbidden units or detachments.

## Maintaining rule metadata

Pack schema version 1 can provide datasheet entries with `keywords`, `modelCounts`, `allowedWargear`, `mustBeWarlord`, `cannotBeWarlord`, and `maxCopies`. A fully specified selectable equipment list may also include `wargearLimits` entries with `item`, optional `maxPerUnit` and optional `perModels`, plus arrays of mutually exclusive alternatives in `exclusiveWargearGroups`. These constraints apply to the selections recorded by the app.

Detachment entries use `requiredUnits`, `forbiddenUnits`, `requiredDetachments`, and `forbiddenDetachments` name arrays. Enhancement entries use `eligibleUnits`, `requiredKeywords`, and `upgrade`. Mark a detachment or enhancement with `validationComplete: true` only when all its restrictions are represented and supported by the validator.

A unit can declare `role` as `leader` or `support` and `leads` as an array of named bodyguards. Entries that express keyword-based eligibility can use objects such as `{"keywords":["Battleline","Imperium","Infantry"]}` in that array when the condition is verified.

Unknown equipment and composition rules, rule-pack gaps, bespoke alliance rules, custom battle sizes, and unresolved keyword-based eligibility can require manual verification. Event force-disposition and Legends policies vary. Loadout validation depends on the datasheet metadata and does not currently model per-model replacement pairs, detailed equipment quantities by model type, or linked wargear prerequisites.
