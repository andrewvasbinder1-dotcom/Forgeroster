# Rules packs

ForgeRoster ships short reference summaries alongside the points catalogue. The summaries describe gameplay for quick lookup. Use the current official publication for decisions at the table.

## Core abilities and weapon keywords

The included Core pack summarizes 36 commonly used abilities and weapon keywords, including 11th-edition mechanics for Close-Quarters, Heavy, Infiltrators, Scouts, Stealth and Precision. Search by base keyword, such as “Melta”, to look up a trait with a variable value. [Official Core Rules PDF](https://assets.warhammer-community.com/eng_01-06_warhammer40k_new40k_core_rules-was6fbu1ix-hfewhmxyiy.pdf) · [Wahapedia current core rules cross-check](https://wahapedia.ru/wh40k11ed/the-rules/core-rules/)

## Included Leagues of Votann coverage

| Coverage | Primary source |
| --- | --- |
| Prioritised Efficiency, Hostile Acquisition, Fortify Takeover | Games Workshop Codex preview |
| Armoured Trailblazers, Farseekers, Hearthguard Covenant, Hearthband and Mercenary Oathband rules, enhancements or upgrades, and stratagems | Faction Pack v1.2, pp. 2–8 |
| Berehk Stornbröw characteristics, core and unique abilities, three weapon profiles, fixed wargear and Cthonian Beserks attachment | Faction Pack v1.2, pp. 9–10 |
| Selected corrections for Arkanyst Evaluator, Buri Aegnirssen, Hekaton Land Fortress, Hernkyn Yaegirs, Memnyr Strategist, Sagitaur and Ûthar the Destined | Faction Pack v1.2, p. 11 |
| Feel No Pain 4+ | 11th-edition core rules |

[Official Faction Pack v1.2, valid from 14 October 2026](https://assets.warhammer-community.com/eng_14-10_wh40k_faction_pack_leagues_of_votann-os3nsdjlao-buac8a7pzn.pdf) · [Official army-rule preview](https://www.warhammer-community.com/en-gb/articles/id57ps8z/maximise-your-yields-with-the-new-leagues-of-votann-army-rule/) · [Official core rules downloads](https://www.warhammer-community.com/en-gb/downloads/warhammer-40000/) · [Wahapedia faction cross-check](https://wahapedia.ru/wh40k11ed/factions/leagues-of-votann/) · [Wahapedia matched-play datasheet cross-check](https://wahapedia.ru/wh40k11ed/factions/leagues-of-votann/datasheets.html)

The five additional Votann Codex detachments and the other full Votann datasheets are outside this rules-summary pack’s coverage. Points and profile coverage in the separate builder catalogue may differ.

## Updating summaries

1. Confirm edition, publication version and effective date on Warhammer Community. Compare individual changes against the current matched-play reference and resolve discrepancies in favor of the official current publication.
2. Edit `data/rules/bundled.json`. Preserve pack and entry IDs across versions. Use one entry per rule, datasheet, ability, enhancement, weapon profile or erratum and keep original summaries concise. Put names, keyword tags and numeric facts in their respective fields. Record the primary source and page numbers in each entry’s `references`, and add direct source links to the pack’s `sources`.
3. Use `faction`, `detachment` and `unit` to scope lookup. Datasheets link other entries by name in `abilities` and `weapons`. Enhancement entries can specify `eligibleUnits` or `requiredKeywords`. Set `upgrade: true` for published non-Character upgrades. Leave unverified restrictions absent.
4. Verify the JSON and load ForgeRoster from a local HTTP server. Open the Rules & Keywords Library and check research links, weapon profiles and summaries. Create a test army in the faction and choose the detachment to check that relevant entries surface with the roster.
5. Update the coverage entry in the pack and this document when scope or source changes.

Open **Manage rules packs** to import or export local packs. Importing a pack with the same ID as an included pack overrides that pack on the current device after confirmation. Removing the local copy restores the included pack. The exported installed-packs file contains local packs.
