import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [capture, version = '1.6'] = process.argv.slice(2);
if (!capture) throw new Error('Usage: node scripts/build-mfm.mjs <capture directory> [version]');

const read = async name => JSON.parse(await readFile(join(capture, name), 'utf8'));
const official = 'https://mfm.warhammer-community.com/en';
const mirror = 'https://mfmdiff.com';
const versions = await read('versions.json');
const release = versions.find(row => row.id === version);
assert.equal(release?.edition, '11th');
assert.equal(release.source, 'scraped');
const index = await read(version + '-index.json');
assert.ok(index.length >= 30);
assert.equal(new Set(index.map(row => row.slug)).size, index.length);

function normalized(name) {
  return name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function displayName(name) {
  return name.toLowerCase().replace(/(^|[\s\-‑])\p{L}/gu, part => part.toUpperCase())
    .replace(/ (And|In|Of|The|With|To) /g, part => part.toLowerCase())
    .replace(/\bHQ\b/gi, 'HQ');
}

function countModels(variant) {
  if (variant.label.startsWith('+ ')) return variant.models;
  const groups = variant.label.split(', ');
  const counts = groups.map(group => /^([0-9]+) /.exec(group)?.[1]);
  assert.ok(counts.every(Boolean), 'Unsupported model-count label ' + variant.label);
  return counts.reduce((total, count) => total + Number(count), 0);
}

function pricing(tiers) {
  assert.ok(tiers.length > 0);
  let expectedFirst = 1;
  return tiers.map(({ tier, variants }, index) => {
    assert.equal(typeof expectedFirst, 'number', 'Pricing tier follows an open range');
    const range = /^YOUR [0-9]+(?:ST|ND|RD|TH)(?: TO ([0-9]+)(?:ST|ND|RD|TH)| (\+))? UNITS? COSTS?$/.exec(tier);
    assert.ok(tier === 'YOUR UNIT COSTS' || range, 'Unsupported pricing tier ' + tier);
    if (range) assert.equal(Number(/YOUR ([0-9]+)/.exec(tier)[1]), expectedFirst);
    const end = !range || range[2] ? '' : Number(range[1] || expectedFirst);
    if (end !== '') assert.ok(end >= expectedFirst);
    assert.equal(end === '', index === tiers.length - 1, 'Incomplete pricing tiers');
    const first = expectedFirst;
    expectedFirst = end === '' ? null : end + 1;
    assert.ok(variants.length > 0);
    return {
      range: '[' + first + ',' + end + ']',
      label: tier,
      costs: variants.map(variant => {
        const models = countModels(variant);
        assert.ok(Number.isInteger(variant.points) && variant.points >= 0);
        return {
          models,
          points: variant.points,
          desc: variant.label,
          optionId: variant.label.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          ...(variant.label.startsWith('+ ') && { addon: true })
        };
      })
    };
  });
}

function profile(row, fields) {
  return Object.fromEntries(fields.filter(field => typeof row[field] === 'string').map(field => [field, row[field]]));
}

function facts(unit, slug) {
  if (!unit) return {};
  return {
    keywords: unit.keywords ?? [],
    ...(unit.anchor && { datasheetSource: 'https://wahapedia.ru/wh40k11ed/factions/' + slug + '/' + unit.anchor }),
    stats: unit.stats.map(row => profile(row, ['name', 'm', 't', 'sv', 'w', 'ld', 'oc', 'inv'])),
    weapons: unit.weapons.map(row => ({
      ...profile(row, ['name', 'kind', 'range', 'a', 'skill', 's', 'ap', 'd']),
      ...(row.keywords && { keywords: row.keywords })
    })),
    abilityNames: [...new Set(unit.abilities.map(row => row.name))].filter(Boolean)
  };
}

function wargear(unit, costs) {
  const additions = costs.filter(cost => cost.addon).map(cost => ({
    item: cost.desc.replace(/^\+ \d+ /, ''),
    points: cost.points,
    perItem: true
  }));
  return [...(unit.wargear ?? []).map(row => ({
    item: row.name.replace(/^per /i, ''),
    points: row.points,
    perItem: /^per /i.test(row.name)
  })), ...additions];
}

async function buildFaction(row) {
  const { slug } = row;
  const points = await read(version + '-' + slug + '.json');
  const sourceSlug = {
    'black-templars': 'space-marines', 'blood-angels': 'space-marines', 'dark-angels': 'space-marines',
    deathwatch: 'space-marines', 'space-wolves': 'space-marines', 'tau-empire': 't-au-empire',
    'emperors-children': 'emperor-s-children', 'titan-legions': 'adeptus-titanicus',
    'chaos-titan-legions': 'adeptus-titanicus'
  }[slug] || slug;
  const captureSlug = ['t-au-empire', 'emperor-s-children'].includes(sourceSlug) ? slug :
    sourceSlug === 'adeptus-titanicus' ? 'titan-legions' : sourceSlug;
  const datasheets = await read('waha-' + captureSlug + '.json');
  assert.equal(points.version, version);
  assert.equal(points.slug, slug);
  assert.equal(points.units.length, row.units);
  assert.equal(points.detachments.length, row.detachments);
  const aliases = { VYPER: 'VYPERS', 'MYPHITIC BLIGHT-HAULERS': 'MYPHITIC BLIGHT-HAULER' };
  function getSheet(name, legends) {
    const titanName = slug === 'chaos-titan-legions' ? name.replace(/^CHAOS /, '') : name;
    const key = normalized(aliases[titanName] || titanName);
    const matches = datasheets.filter(card => normalized(card.name) === key);
    return matches.find(card => card.legends === Boolean(legends)) || (matches.length === 1 ? matches[0] : null);
  }
  const units = points.units.map(unit => {
    const sourceSheet = getSheet(unit.name, unit.legends);
    const sheet = sourceSheet && slug === 'chaos-titan-legions' ? {
      ...sourceSheet,
      name: 'Chaos ' + sourceSheet.name,
      keywords: sourceSheet.keywords.map(keyword => ({
        Imperium: 'Chaos', 'Adeptus Titanicus': 'Titanicus Traitoris', [sourceSheet.name]: 'Chaos ' + sourceSheet.name
      }[keyword] || keyword))
    } : sourceSheet;
    const costTiers = pricing(unit.tiers);
    const joins = (unit.joins ?? []).map(link => {
      assert.ok(['LEADER', 'SUPPORT'].includes(link.type));
      return { role: link.type.toLowerCase(), targets: link.canJoin.map(name => getSheet(name)?.name || displayName(name)) };
    });
    const mfmWargear = wargear(unit, costTiers[0].costs);
    return {
      name: sheet?.name || displayName(unit.name),
      ...(unit.group && { group: displayName(unit.group) }),
      ...(unit.legends && { legends: true }),
      pricing: costTiers,
      ...(joins.length && {
        role: joins[0].role,
        leads: [...new Set(joins.flatMap(link => link.targets))],
        joins
      }),
      ...(mfmWargear.length && { wargear: mfmWargear }),
      ...facts(sheet, sourceSlug)
    };
  });
  const used = new Map();
  const mainUnits = [];
  const alliedPricing = [];
  for (const unit of units) {
    if (unit.group === 'Every Model Has the Imperium Keyword') {
      alliedPricing.push(unit);
      continue;
    }
    const key = normalized(unit.name);
    const previous = used.get(key);
    if (previous) {
      // The two Space Wolves entries share a name but have distinct matched-play status.
      assert.ok(unit.legends && !previous.legends, 'Ambiguous unit ' + slug + '/' + unit.name);
      unit.name += ' (Legends)';
    }
    used.set(normalized(unit.name), unit);
    mainUnits.push(unit);
  }
  return {
    slug,
    name: row.name.replaceAll("'", '’'),
    source: official + '/' + slug,
    ...(sourceSlug === 'adeptus-titanicus' && {
      rosterRules: {
        requiresDetachment: false,
        warlordKeywords: [slug === 'chaos-titan-legions' ? 'Titanicus Traitoris' : 'Adeptus Titanicus'],
        dispositions: ['Take and Hold'],
        source: 'https://assets.warhammer-community.com/eng_11-06_warhammer40000_faction_pack_adeptus_titanicus-w2uqxtzclf-9hqf20r3dc.pdf',
        dispositionSource: 'https://wahapedia.ru/wh40k11ed/factions/adeptus-titanicus/'
      }
    }),
    units: mainUnits,
    ...(alliedPricing.length && { alliedPricing }),
    detachments: points.detachments.map(detachment => {
      assert.ok(Number.isInteger(detachment.dp) && detachment.dp >= 0);
      return {
        name: displayName(detachment.name),
        dp: detachment.dp,
        dispositions: detachment.rule ? [displayName(detachment.rule)] : [],
        ...(detachment.group && { group: displayName(detachment.group) }),
        enhancements: detachment.enhancements.map(enhancement => ({
          name: enhancement.name,
          points: enhancement.points,
          upgrade: /\(upgrade\)$/i.test(enhancement.name)
        }))
      };
    })
  };
}

const factions = await Promise.all(index.map(buildFaction));
const dataset = {
  schemaVersion: 2,
  meta: {
    edition: '11th',
    version,
    lastUpdated: release.scrapedAt,
    source: official,
    transcription: mirror,
    datasheets: 'https://wahapedia.ru/wh40k11ed/',
    verification: 'Version/date cross-checked against Warhammer Community. Factual transcription with selected rule and points spot checks.'
  },
  factions
};
await writeFile(new URL('../data/mfm.json', import.meta.url), JSON.stringify(dataset) + '\n');
console.log('Built ' + factions.length + ' factions and ' + factions.reduce((count, faction) => count + faction.units.length, 0) + ' unit entries.');
