// The map's steps (0.25.0) build a film's map as 0.24.0 built it: pinned against a copy of 0.24.0's steps and reader
// (test/control/footprint-story-0.24.0-mapSteps.js, -mapSpec.js), for random maps under the film's policy — every key
// 0.24.0's map holds is the same, to the last bit, but for two echoes of the input that name a new field: the policy
// names its cover rule ('drawn', the film's) and each floor its icon (false); the keys 0.25.0 adds hold nothing. StoryReel 0.40.0 builds its maps with buildIsoMap, so this is its guarantee.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as old from './control/footprint-story-0.24.0-mapSteps.js';
import { ISO_MAP_POLICIES as OLD_POLICIES } from './control/footprint-story-0.24.0-mapSpec.js';
import { buildIsoMap, ISO_MAP_POLICIES } from '../isometric.js';
import { mapArb } from './isoMapSpecs.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const NEW_KEYS = Object.freeze({ obstacles: [], keep: [], usualGrid: null, obstacleShapes: [] });

/** One spec built by both: the same map, or both refused. */
function same(spec, policy = ISO_MAP_POLICIES.film, oldPolicy = OLD_POLICIES.film) {
  let before = null, refused = null;
  try { before = old.buildIsoMap(spec, oldPolicy); } catch (e) { refused = e; }
  if (refused) { assert.throws(() => buildIsoMap(spec, policy), /^Error: isometric: /, `0.24.0 refused (${refused.message}); so must 0.25.0`); return null; }
  const now = buildIsoMap(spec, policy);
  for (const key of Object.keys(before)) {
    if (key === 'policy') assert.deepStrictEqual(now.policy, { ...before.policy, cover: 'drawn' }, 'policy');
    else if (key === 'floors') assert.deepStrictEqual(now.floors, before.floors.map((f) => ({ ...f, icon: false })), 'floors');
    else assert.deepStrictEqual(now[key], before[key], key);
  }
  assert.deepStrictEqual(Object.keys(now).sort(), [...Object.keys(before), ...Object.keys(NEW_KEYS)].sort());
  for (const [key, nothing] of Object.entries(NEW_KEYS)) assert.deepStrictEqual(now[key], nothing, key);
  return now;
}

test('0.25.0 builds every film map as 0.24.0 did: random maps, styles and colours', () => {
  const styled = fc.tuple(mapArb, fc.constantFrom(null, { line: 'none' }, { line: { name: 'ink', width: 4 } }), fc.option(fc.constantFrom({ base: '#d9e4f3', ink: '#14181f' }), { nil: null }));
  fc.assert(fc.property(styled, ([spec, style, colours]) => {
    same({ ...spec, style, blocks: spec.blocks.map((b) => ({ ...b, colours })) });
  }), { numRuns: RUNS });
});

test('and a policy that leaves cover out is the film\'s rule: the deck\'s numbers with cover left out build as 0.24.0\'s deck policy did', () => {
  const { cover, ...deckLeftOut } = ISO_MAP_POLICIES.deck;
  assert.equal(cover, 'block');
  fc.assert(fc.property(mapArb, (spec) => {
    const now = same(spec, deckLeftOut, OLD_POLICIES.deck);
    if (now) assert.equal(now.policy.cover, 'drawn');
  }), { numRuns: Math.ceil(RUNS / 3) });
});

test('the cases the property covers are met, and what 0.24.0 refused that 0.25.0 builds is only what it names', () => {
  const two = [{ name: 'web', size: [2, 2, 1], label: 'Web', small: 'nginx' }, { name: 'db', kind: 'cylinder', size: [2, 2, 1.2], label: 'Database server' }];
  const wires = [{ from: { block: 'web' }, to: { block: 'db' } }];
  for (const spec of [
    { blocks: two, wires, floors: [{ label: 'Production account' }], area: [0, 0, 1600, 900] },
    { blocks: two.map((b, i) => ({ ...b, group: i ? 'back' : 'front' })), wires, floors: [{ group: 'back', label: 'Back' }], area: [0, 0, 1600, 900] },
    { blocks: two.map((b, i) => ({ ...b, at: [i * 4, 0] })), wires, floors: [{ at: [0, 0], size: [9, 4], label: 'VPC' }], grid: { tile: 120, origin: [800, 200] } },
  ]) assert.ok(same(spec));
  // a map with no block (floors alone, on a written grid) and a sized floor naming a group with no block: refused by 0.24.0, built now
  const floorsAlone = { blocks: [], floors: [{ at: [0, 0], size: [4, 3], label: 'Empty', group: 'spare' }], grid: { tile: 100, origin: [800, 100] } };
  assert.throws(() => old.buildIsoMap(floorsAlone, OLD_POLICIES.film), /give it blocks/);
  assert.equal(buildIsoMap(floorsAlone, ISO_MAP_POLICIES.film).floorLabels[0].lines[0], 'Empty');
  const namedArea = { blocks: two, floors: [{ at: [0, 0], size: [9, 4], group: 'spare' }], area: [0, 0, 1600, 900] };
  assert.throws(() => old.buildIsoMap(namedArea, OLD_POLICIES.film), /its group "spare" has no block/);
  // a floor alone naming a group makes it a map of groups: fitted down to the grouped tile, as StoryDeck fits it
  assert.deepEqual(buildIsoMap(namedArea, ISO_MAP_POLICIES.film).grid, 'fitted');
});
