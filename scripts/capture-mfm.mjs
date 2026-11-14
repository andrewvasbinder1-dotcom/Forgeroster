import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [destination, version = '1.6'] = process.argv.slice(2);
if (!destination) throw new Error('Usage: node scripts/capture-mfm.mjs <capture directory> [version]');
assert.match(version, /^[\w.-]+$/);
const base = 'https://mfmdiff.com/data/';
await mkdir(destination, { recursive: true });

async function capture(path, filename = path.replace('/', '-')) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status);
  const source = await response.text();
  const parsed = JSON.parse(source);
  await writeFile(join(destination, filename), source);
  return parsed;
}

const releases = await capture('versions.json');
assert.ok(releases.some(row => row.id === version && row.edition === '11th' && row.source === 'scraped'));
const factions = await capture(version + '/index.json');
for (let first = 0; first < factions.length; first += 4) {
  await Promise.all(factions.slice(first, first + 4).flatMap(({ slug }) => {
    assert.match(slug, /^[a-z-]+$/);
    return [capture(version + '/' + slug + '.json')];
  }));
}
const marineChapters = ['black-templars', 'blood-angels', 'dark-angels', 'deathwatch', 'space-wolves'];
const sharedSlugs = { 'titan-legions': 'adeptus-titanicus', 'tau-empire': 't-au-empire', 'emperors-children': 'emperor-s-children' };
const datasheetPacks = factions.map(entry => entry.slug).filter(slug => !marineChapters.includes(slug) && slug !== 'chaos-titan-legions');
for (let first = 0; first < datasheetPacks.length; first += 4) {
  await Promise.all(datasheetPacks.slice(first, first + 4).map(async slug => {
    const url = 'https://wahapedia.ru/wh40k11ed/factions/' + (sharedSlugs[slug] || slug) + '/datasheets.html';
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(url + ' returned HTTP ' + response.status);
    await writeFile(join(destination, 'waha-' + slug + '.html'), await response.text());
  }));
}
console.log('Captured version ' + version + ' plus ' + datasheetPacks.length + ' datasheet source pages.');
