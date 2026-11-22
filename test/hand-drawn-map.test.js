// A hand-drawn map: buildIsoMap and runMapFlow take the tool's own style choices beside the spec and the policy
// (`{choices}`: footprint-story/human's sketchyLine and hatchTexture), build the map end to end with each policy, and
// refuse a style naming a choice not handed in, naming the entry and the fix. The seeds stay exact: the same map, the
// same strokes; where it was written (`who`) and how fast it is drawn (`speed`) never reach the wobble; the pen's points
// pinned to 1e-6. And the map flow's map equals buildIsoMap's with hand-drawn choices, for random maps and both
// policies, its record naming the choices that drew it.
// FC_RUNS=20000 npm test runs a deep sweep (the flow runs a fifth of it: each run is a footprintjs chart).
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { buildIsoMap, isoStyle, ISO_MAP_POLICIES, ISO_MAP_STEPS, MOST_PAINT_ITEMS } from '../isometric.js';
import { sketchyLine, hatchTexture, strokeAt, strokeOutline, CAP_STEPS } from '../human.js';
import { runMapFlow, mapFlow } from '../mapflow.js';
import { mapArb } from './isoMapSpecs.js';
import { SUMMARISED, paintSummary } from '../src/mapflow/summary.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const FILM = ISO_MAP_POLICIES.film, DECK = ISO_MAP_POLICIES.deck;
const CHOICES = Object.freeze([sketchyLine, hatchTexture]);
const HAND = Object.freeze({ line: 'human:sketchy', texture: 'human:hatch' });
/** Two blocks and a floor on a written grid: the map whose strokes are pinned. */
const SPEC = Object.freeze({ blocks: [{ name: 'web', at: [0, 0], size: [2, 2, 1], label: 'Web' }, { name: 'db', at: [3, 0], kind: 'cylinder', size: [2, 2, 1], label: 'Database' }],
  floors: [{ at: [-1, -1], size: [7, 4], label: 'Production' }], grid: { tile: 120, origin: [800, 200] }, style: HAND });
/** The same map placed by the build and fitted into an area: the steps' other branches. */
const BUILT = Object.freeze({ blocks: [{ name: 'web', size: [2, 2, 1], label: 'Web' }, { name: 'db', kind: 'cylinder', size: [2, 2, 1], label: 'Database' }],
  wires: [{ from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'Production' }], area: [0, 0, 1600, 900], style: HAND });
const strokes = (items, role) => items.filter((i) => i.item === 'stroke' && (!role || i.role === role));

test('a hand-drawn map built end to end with each policy: the faces keep their fills, the edges drawn by hand, the sides hatched', () => {
  for (const policy of [FILM, DECK]) {
    for (const spec of [SPEC, BUILT]) {
      const map = buildIsoMap(spec, policy, { choices: CHOICES });
      assert.deepEqual(map.style.row, { shape: 'box', shading: 'tones', line: 'human:sketchy', palette: 'theme', texture: 'human:hatch', effects: [] }, 'the map keeps the names of the choices that drew it');
      assert.deepStrictEqual(structuredClone(map), map, 'plain data a record keeps');
      map.paints.forEach((items, i) => {
        const faces = items.filter((it) => it.item !== 'stroke');
        assert.ok(faces.every((f) => f.stroke === null && f.fill !== null), `${map.blocks[i].name}'s faces keep their fills and lose their ink line`);
        assert.ok(strokes(items, 'ink').length >= 1, `${map.blocks[i].name}'s edges drawn by hand`);
        assert.ok(strokes(items, 'hatch').length > 0, `${map.blocks[i].name}'s sides hatched`);
        assert.ok(items.length <= MOST_PAINT_ITEMS);
        for (const s of strokes(items)) {
          assert.equal(s.stroke.cap, 'round');
          // what a painter does with each: the ring of the part drawn so far, capped; the whole by Infinity
          const t = s.points.at(-1)[3];
          assert.deepStrictEqual(strokeOutline(strokeAt(s.points, Infinity), { cap: s.stroke.cap }), strokeOutline(s.points, { cap: s.stroke.cap }));
          // half way through its time it is part drawn, its ring capped at both ends (every end has width: the taper's tip)
          assert.ok(strokeOutline(strokeAt(s.points, (s.points[0][3] + t) / 2)).length >= 2 * CAP_STEPS);
        }
      });
      // a floor keeps its tile lines as the ink line keeps them, and is not hatched (its ground is not a face a hatch fills)
      assert.ok(map.floorPaints.every((items) => items.some((it) => it.role === 'grid' && it.stroke.width === 1.5) && !strokes(items).length));
      assert.equal(map.placed, spec === SPEC ? 'hand' : 'build');
    }
  }
});

test('the hand-drawn map differs from the usual only where the style does: places, grid, names and labels are the same', () => {
  for (const policy of [FILM, DECK]) {
    const hand = buildIsoMap(BUILT, policy, { choices: CHOICES }), usual = buildIsoMap({ ...BUILT, style: null }, policy);
    for (const key of ['at', 'routes', 'floorTiles', 'view', 'names', 'smalls', 'order', 'floorLabels', 'shapes', 'floorShapes']) assert.deepStrictEqual(hand[key], usual[key], key);
    assert.notDeepStrictEqual(hand.paints, usual.paints);
  }
});

test('a style naming a tool\'s choice not handed in is refused, naming the entry and the fix', async () => {
  const words = /isometric: slide 3's map's style: the style's line has no choice "human:sketchy" — the line choices are "ink", "none"; "human:sketchy" is a tool's own choice \(its name has a prefix\), which is code no record holds: hand the choice itself in \{choices\} \(footprint-story\/human has the "human:" ones\)$/;
  const spec = { ...SPEC, who: "slide 3's map" };
  assert.throws(() => buildIsoMap(spec, FILM), words);
  assert.throws(() => buildIsoMap(spec, FILM, { choices: [hatchTexture] }), words, 'the texture handed, the line not');
  await assert.rejects(runMapFlow(spec, DECK), words);
  // a choice of no tool's: the names there are, and the fix
  assert.throws(() => buildIsoMap({ ...SPEC, style: { line: 'reel:chalk' } }, FILM, { choices: CHOICES }), /the style's line has no choice "reel:chalk" — the line choices are "ink", "none", "human:sketchy"; "reel:chalk" is a tool's own choice .* \(the tool that names it has it\)$/);
  // a choice handed in that the style does not name is no fault: it is simply not used
  assert.deepEqual(buildIsoMap({ ...SPEC, style: null }, FILM, { choices: CHOICES }).style.row.line, 'ink');
});

test('the settings are {choices}: anything else is refused by name, with the fix', async () => {
  assert.throws(() => buildIsoMap(SPEC, FILM, { choice: CHOICES }), /isometric: buildIsoMap's settings are \{choices\} \(a tool's own style choices: \[sketchyLine, hatchTexture\] from footprint-story\/human\) — not "choice"$/);
  assert.throws(() => buildIsoMap(SPEC, FILM, 'sketchy'), /buildIsoMap's settings are \{choices\} \(a tool's own style choices\), or none — not "sketchy"/);
  assert.throws(() => buildIsoMap(SPEC, FILM, { choices: sketchyLine }), /buildIsoMap's choices are a list of at most 64 style choices — not an object/);
  assert.throws(() => buildIsoMap(SPEC, FILM, { choices: [sketchyLine, sketchyLine] }), /buildIsoMap's choices: isoStyle's choices\[1\]: line "human:sketchy" is given twice/);
  assert.throws(() => buildIsoMap(SPEC, FILM, { choices: [{ column: 'line', name: 'sketchy', apply() {} }] }), /buildIsoMap's choices: isoStyle's choices\[0\]'s name is the tool's prefix and a name/);
  assert.throws(() => buildIsoMap(SPEC, FILM, { get choices() { return CHOICES; } }), /buildIsoMap's choices is read as a stored value, and this one is a getter/);
  assert.throws(() => mapFlow({ choices: 1 }), /mapFlow's choices are a list/);
  await assert.rejects(runMapFlow(SPEC, FILM, { choices: [1] }), /runMapFlow's choices: isoStyle's choices\[0\] is a choice/);
  await assert.rejects(runMapFlow(SPEC, FILM, { get choices() { return CHOICES; } }), /runMapFlow's choices is read as a stored value, and this one is a getter/);
  // the list is read once: a later edit of the caller's list reaches nothing
  const list = [...CHOICES], chart = mapFlow({ choices: list });
  list.length = 0;
  assert.ok(chart);
});

test('a hatch too close for its piece is refused naming the block\'s entry and the spacing that fits', () => {
  const spec = { grid: { tile: 600, origin: [800, 200] }, blocks: [{ name: 'big', at: [0, 0], size: [3, 3, 3], who: 'blocks[0] ("big")' }], style: { texture: { name: 'human:hatch', spacing: 3 } } };
  assert.throws(() => buildIsoMap(spec, FILM, { choices: CHOICES }), /isometric: blocks\[0\] \("big"\): the style's texture "human:hatch" on "big" draws \d+ hatch lines, and its piece holds 509 more items \(512 in all\) — give a wider spacing: texture: \{name: 'human:hatch', spacing: \d+\}$/);
  const fix = Number(/spacing: (\d+)\}$/.exec((() => { try { buildIsoMap(spec, FILM, { choices: CHOICES }); } catch (e) { return e.message; } })())[1]);
  assert.ok(buildIsoMap({ ...spec, style: { texture: { name: 'human:hatch', spacing: fix } } }, FILM, { choices: CHOICES }).paints[0].length <= MOST_PAINT_ITEMS, 'the spacing it names fits');
});

test('the seeds stay exact: the same map, the same strokes; who and the pen\'s speed never reach the wobble', () => {
  const a = buildIsoMap(SPEC, FILM, { choices: CHOICES });
  assert.deepStrictEqual(buildIsoMap(SPEC, FILM, { choices: [hatchTexture, sketchyLine] }).paints, a.paints, 'the same, built again, the choices handed in any order');
  assert.deepStrictEqual(buildIsoMap(SPEC, DECK, { choices: CHOICES }).paints, a.paints, 'the same on a written grid under either policy');
  // where it was written: the map's and each piece's who
  const renamed = { ...SPEC, who: 'deck slide 9', blocks: SPEC.blocks.map((b, i) => ({ ...b, who: `the ${i}th block` })), floors: SPEC.floors.map((f) => ({ ...f, who: 'its floor' })) };
  assert.deepStrictEqual(buildIsoMap(renamed, FILM, { choices: CHOICES }).paints, a.paints, 'who is not in the seed');
  // how fast: the pen's speed changes the times, never where the pen goes or the width it lays
  const fast = buildIsoMap({ ...SPEC, style: { ...HAND, line: { name: 'human:sketchy', speed: 900 } } }, FILM, { choices: CHOICES });
  a.paints.forEach((items, i) => strokes(items, 'ink').forEach((s, k) => {
    const f = strokes(fast.paints[i], 'ink')[k];
    assert.deepStrictEqual(f.points.map((p) => p.slice(0, 2)), s.points.map((p) => p.slice(0, 2)));
    // the width by the speed's share of its mean, the same share at any speed (to the last bits of the sum)
    f.points.forEach((p, j) => assert.ok(Math.abs(p[2] - s.points[j][2]) <= 1e-9));
    assert.ok(f.points.at(-1)[3] < s.points.at(-1)[3], 'drawn faster');
  }));
  // what the drawing is does reach it: the tremor, and a piece's name
  const steadier = buildIsoMap({ ...SPEC, style: { ...HAND, line: { name: 'human:sketchy', tremor: 2 } } }, FILM, { choices: CHOICES });
  assert.notDeepStrictEqual(strokes(steadier.paints[0], 'ink')[0].points, strokes(a.paints[0], 'ink')[0].points);
  // the speed written out at its usual 400: a style that records it (its options differ), seeded as one that does not
  const usual = buildIsoMap({ ...SPEC, style: { ...HAND, line: { name: 'human:sketchy', speed: 400 } } }, FILM, { choices: CHOICES });
  assert.deepEqual(usual.style.options, { line: { speed: 400 } });
  assert.deepStrictEqual(usual.paints, a.paints, 'the same strokes, the same times');
});

test('a choice may name only its own options as timing (unseeded), checked when the style is made', () => {
  const own = (unseeded) => ({ column: 'texture', name: 'test:grain', options: ['speed'], unseeded, apply: (items) => items });
  assert.equal(isoStyle({ texture: { name: 'test:grain', speed: 2 } }, { choices: [own(['speed'])] }).row.texture, 'test:grain');
  assert.throws(() => isoStyle(null, { choices: [own(['pace'])] }), /isoStyle's choices\[0\] \(test:grain\)'s unseeded names options it reads \(speed\) — not "pace"/);
  assert.throws(() => isoStyle(null, { choices: [own('speed')] }), /isoStyle's choices\[0\] \(test:grain\)'s unseeded are the options it reads that are timing/);
  assert.deepEqual(sketchyLine.unseeded, ['speed']); assert.deepEqual(hatchTexture.unseeded, []);
});

/** The pen's points, pinned: [block, role, which stroke, its points, its first, middle and last point]. Tolerance 1e-6, so a Node whose Math rounds the last bit otherwise still passes. */
const PINNED = [
  [0, 'ink', 0, 359, [[680, 186.51530771650465, 0.7187709233357612, 0], [922.6832815729997, 258.65835921350015, 2.325247381988586, 0.8803134818602639], [680, 186.51530771650465, 0.7188738622044489, 1.7540642479173505]]],
  [0, 'hatch', 3, 19, [[680, 222.74798586637402, 0.24466014094665564, 3.1512987928998886], [692.0775593832898, 210.6704264830842, 0.65000000000244, 3.1726491032501554], [704.1551187665796, 198.59286709979443, 0.24466014094658686, 3.1939994136004257]]],
  [1, 'ink', 0, 417, [[895.1471862576143, 276.51530771650465, 0.7396814706696471, 0], [915.6259467290453, 249.0484216468432, 2.111231275741401, 1.0689739052376617], [1064.8528137423857, 276.51530771650465, 0.6947599041824785, 1.9077458759719184]]],
  [1, 'hatch', 0, 2, [[895.1471862576143, 278.5822151001586, 0.195, 1.9677458759719184], [895.3867297695642, 278.34267158820865, 0.195, 1.968169333076141], [895.3867297695642, 278.34267158820865, 0.195, 1.968169333076141]]],
];

test('the pen\'s points are pinned to 1e-6: the same strokes on every Node, in a deck and in a film', () => {
  for (const policy of [FILM, DECK]) {
    const map = buildIsoMap(SPEC, policy, { choices: CHOICES });
    assert.deepEqual(map.paints.map((items) => strokes(items).length), [61, 25]);
    for (const [b, role, k, n, points] of PINNED) {
      const s = strokes(map.paints[b], role)[k];
      assert.equal(s.points.length, n, `${map.blocks[b].name}'s ${role} stroke ${k}'s points`);
      [0, Math.floor(n / 2), n - 1].forEach((i, j) => points[j].forEach((v, c) => assert.ok(Math.abs(s.points[i][c] - v) <= 1e-6, `${map.blocks[b].name}'s ${role} stroke ${k}, point ${i}[${c}]: ${s.points[i][c]}, pinned ${v}`)));
    }
  }
});

test('the map flow runs the same steps with the same choices: its map equals buildIsoMap\'s, and its record names them', async () => {
  const { map, snapshot } = await runMapFlow(BUILT, FILM, { choices: CHOICES });
  assert.deepStrictEqual(map, buildIsoMap(BUILT, FILM, { choices: CHOICES }));
  const read = snapshot.commitLog.find((c) => c.runtimeStageId.startsWith('read#'));
  assert.deepEqual(read.trace.find((r) => r.path === 'style').verb, 'set');
  assert.deepEqual(snapshot.sharedState.style.row.line, 'human:sketchy');
  assert.deepEqual(snapshot.sharedState.style.row.texture, 'human:hatch');
  // the style stage read the style (and so the choices' names) when it wrote the paint lists
  const style = snapshot.commitLog.find((c) => c.runtimeStageId.startsWith('style#'));
  assert.ok(style.trace.find((r) => r.path === 'paints').readKeys.includes('style'));
  // a step handed no choices refuses the style it cannot make, in the same words
  const shape = ISO_MAP_STEPS.find((s) => s.name === 'shape');
  assert.throws(() => shape.run(map), /the style's line has no choice "human:sketchy"/);
  assert.deepStrictEqual(shape.run(map, { choices: CHOICES }).shapes, map.shapes);
});

/** A hand-drawn style row: the sketchy line, the hatch, or both, with or without options. */
const handRow = fc.record({
  line: fc.constantFrom(undefined, 'ink', 'human:sketchy', { name: 'human:sketchy', tremor: 0 }, { name: 'human:sketchy', width: 4, overshoot: 0, speed: 700 }),
  texture: fc.constantFrom(undefined, 'human:hatch', { name: 'human:hatch', spacing: 14, angle: 30 }, { name: 'human:hatch', width: 1, tremor: 2 }),
}).map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)));

test('the map flow\'s map equals buildIsoMap\'s with hand-drawn choices, for random maps and both policies — or both refuse in one set of words', async () => {
  await fc.assert(fc.asyncProperty(mapArb, handRow, fc.constantFrom(FILM, DECK), fc.option(fc.constantFrom({ base: '#d9e4f3', ink: '#14181f' }), { nil: null }), async (spec, style, policy, colours) => {
    const given = { ...spec, style, blocks: spec.blocks.map((b) => ({ ...b, colours })) };
    let built, words;
    try { built = buildIsoMap(given, policy, { choices: CHOICES }); } catch (e) { words = e.message; }
    if (words) { await assert.rejects(runMapFlow(given, policy, { choices: CHOICES }), (e) => e.message === words); return; }
    const { map, snapshot } = await runMapFlow(given, policy, { choices: CHOICES });
    assert.deepStrictEqual(map, built);
    assert.deepStrictEqual(snapshot.sharedState.style, built.style, 'the record names the choices that drew it');
    // the record keeps the paint lists as counts and a digest (0.33.1): the digest of the lists buildIsoMap made
    for (const key of SUMMARISED) assert.deepStrictEqual(snapshot.sharedState[key], paintSummary(built[key]), key);
  }), { numRuns: Math.max(20, Math.ceil(RUNS / 5)) });
});
