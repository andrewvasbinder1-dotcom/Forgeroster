import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = JSON.parse(readFileSync(new URL('../data/mfm.json', import.meta.url)));
const [destination, officialFile] = process.argv.slice(2);
if (!destination) throw Error('Usage: node scripts/verify-points.mjs output.csv [official-transcription.json]');
const official = officialFile ? JSON.parse(readFileSync(resolve(officialFile))) : null;
if (official && (!official.source?.startsWith('https://mfm.warhammer-community.com/') ||
    !official.revision || !Array.isArray(official.rows))) throw Error('Expected an official transcription with source, revision and rows.');
const key = row => JSON.stringify([row.faction, row.unit, row.tier, row.option, row.models]);
const lookup = new Map();
for (const row of official?.rows || []) {
  if (!Number.isInteger(row.points) || row.points < 0 || lookup.has(key(row))) throw Error('Invalid or duplicate official comparison row.');
  lookup.set(key(row), row.points);
}
const headers = ['Faction','Unit','Pricing tier','Composition','Models','ForgeRoster points','Official points','Discrepancy','Source','Source revision','Status'];
const csv = value => '"' + String(value ?? '').replaceAll('"','""') + '"';
const table = [headers];
for (const faction of input.factions) {
  for (const unit of faction.units) for (const tier of unit.pricing || []) for (const cost of tier.costs || []) {
    const row = { faction: faction.name, unit: unit.name, tier: tier.range || '', option: cost.desc || '', models: cost.models };
    const expected = lookup.get(key(row));
    lookup.delete(key(row));
    table.push([row.faction,row.unit,row.tier,row.option,row.models,cost.points,expected,
      expected === undefined ? '' : cost.points - expected, expected === undefined ? input.meta.transcription : official.source,
      expected === undefined ? input.meta.version : official.revision, expected === undefined ? 'Awaiting official comparison' :
        expected === cost.points ? 'Matches supplied official transcription' : 'Discrepancy']);
  }
}
for (const [reference, points] of lookup) table.push([...JSON.parse(reference),'',points,'',official.source,official.revision,'Missing in ForgeRoster']);
writeFileSync(destination,table.map(row => row.map(csv).join(',')).join('\n') + '\n');
console.log(table.length - 1, 'comparison rows');
