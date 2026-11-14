# Warhammer 40,000 11th-edition catalogue

The checked-in snapshot covers 30 MFM faction catalogs, with 1,768 selectable unit entries (including Legends), 29 separately retained Imperial Agents allied price records, and 334 detachment entries across the faction catalogs. Entries that appear in more than one faction are counted in each. The combination of MFM pricing and the datasheet lookup is unofficial.

## References and checks

- [Games Workshop downloads and errata](https://www.warhammer-community.com/en-gb/downloads/warhammer-40000/) independently identifies 14 October 2026 as the current MFM update date.
- [Official Munitorum Field Manual](https://mfm.warhammer-community.com/en) is the authority for points, copy-based prices, costed wargear, detachments, enhancements, and attachments. Its live faction pages returned HTTP 403 during this audit. The cached launch release was v1.0.
- [mfmdiff October 14 v1.6 capture](https://mfmdiff.com/data/1.6/index.json) supplies the dated MFM factual transcription. The catalogue preserves the different costs for repeated copies, the original printed model composition labels, and per-item costs where stated. The upstream count of 75 Imperial Agents rows includes 29 rows priced for other Imperium armies. Those rows are retained separately as `alliedPricing`.
- [Wahapedia 11th-edition datasheets](https://wahapedia.ru/wh40k11ed/) supply characteristics, weapon profiles, keywords, and titles of abilities from the full game datasheets. Combat Patrol profiles and rule prose are excluded. Datasheet source pages identify their own publication or app revision, which can differ from the points snapshot. Thirty-two older Legends entries still lack a matched datasheet. Conditional invulnerable saves that have an asterisk retain that marker and need their source notes.
- [Hearthkyn Warriors](https://www.wahapedia.ru/wh40k11ed/factions/leagues-of-votann/Hearthkyn-Warriors) and [Lord Marshal Dreir](https://www.wahapedia.ru/wh40k11ed/factions/astra-militarum/Lord-Marshal-Dreir) were independently spot-checked for points, with Hearthkyn characteristics and weapon rows and Dreir’s Leader target also checked. Wahapedia’s displayed MFM version can lag the latest MFM. Resolve dated discrepancies with the current official MFM when available.
- The [official Adeptus Titanicus faction pack](https://assets.warhammer-community.com/eng_11-06_warhammer40000_faction_pack_adeptus_titanicus-w2uqxtzclf-9hqf20r3dc.pdf) confirms the Titan Warlord and detachment exceptions and the Chaos equivalent’s keyword substitutions. The current [Adeptus Titanicus army rules reference](https://wahapedia.ru/wh40k11ed/factions/adeptus-titanicus/) specifies Take and Hold.

The snapshot is traceable and spot-checked. A current official row-by-row comparison remains outstanding. The base datasheets and MFM pricing do not encode the full universe of equipment swaps, fixed loadouts, stratagems, ability mechanics, and army-building restrictions. Legal model counts can fall between the displayed MFM pricing brackets in applicable datasheets. Pricing cases involving several differently composed copies still need the full rules interpretation. An unlisted weapon option or enhancer eligibility rule requires a check against the relevant official datasheet, erratum, or detachment rules.

## Update procedure

Use Node 22 or newer and Python 3 with `lxml` installed. Keep all capture files outside the tracked checkout.

```sh
node scripts/capture-mfm.mjs /tmp/forgeroster-mfm 1.6
python scripts/extract-datasheet-facts.py /tmp/forgeroster-mfm
node scripts/build-mfm.mjs /tmp/forgeroster-mfm 1.6
node --test scripts/test-mfm.mjs
```

Check the official downloads date and switch the version argument only once the new MFM revision is available. Review added and removed factions, unit names, price tiers, and addon rows against the official publications. Resolve missing datasheet joins explicitly and audit differences in keywords against official faction packs and errata. If the points transcription is stale relative to an official document, fix the source facts before rebuilding and record the official revision. Update the test totals and spot-check expectations when deliberately changing the version. Commit the generated compact JSON together with any changes to its source notes and regression checks.
