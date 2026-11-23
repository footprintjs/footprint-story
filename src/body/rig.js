/**
 * A rig: a body as a tree of parts, as data (docs/design/2026-11-bodies.md §1).
 *
 *   readRig(rig)                    the rig checked and frozen, mass shares scaled to sum to 1; every refusal names the fix
 *   humanRig({name, height, ...})   the usual person, from a height in px (Drillis & Contini's lengths, Dempster's masses,
 *                                   as Winter tabulates them)
 *
 * Each part owns the joint at its start, so there is no joint list: a tree has one joint per part below the root, and
 * two lists would have to agree. Parents are listed before children, so a cycle cannot be written and the tree is read
 * in one pass. Angles are radians on the frame, y down (a positive turn is clockwise on screen), 0 along +x; a part's
 * `rest` and `limit` are relative to its parent, written for a body facing +x (`facing: -1` mirrors them, limits.js).
 *
 * WHY nothing is keyed by a name: names come from people and models; lookups go through a Map, so `__proto__` reaches
 * nothing (and fails the name rule anyway).
 */
import { NAME, readList, readName, readNumber, readRecord, refuse, shown, stored } from './read.js';

/** The most parts a rig may have, and the most a chain may hold (design §7, §10): bounded work per pose. */
export const MOST_PARTS = 64;
export const MOST_CHAIN = 16;
/** The longest a part may be, in px (§10): keeps the float digits of a placed point. */
export const MOST_LENGTH = 10000;

const TURN = 2 * Math.PI;
const RIG_KEYS = ['name', 'plane', 'facing', 'root', 'footHeight', 'parts', 'chains', 'feet', 'loose'];
const PART_KEYS = ['name', 'parent', 'length', 'rest', 'limit', 'width', 'layer', 'mass'];
const CHAIN_KEYS = ['name', 'parts', 'solver', 'bend'];
const LAYERS = ['near', 'mid', 'far'];
const SOLVERS = ['two-bone', 'fabrik'];
const BENDS = ['front', 'back'];

/** What a read rig knows beyond its data: indices by name, parents by index, and the joint windows as it faces. A rig is
 *  in this map only if readRig made it, so a function handed one need not read it again. */
const INFO = new WeakMap();

/** The rig as readRig made it, read again when it was not. */
export function rigOf(rig) { return INFO.has(rig) ? rig : readRig(rig); }
/** The derived facts of a read rig (internal to src/body). */
export const infoOf = (rig) => INFO.get(rigOf(rig));

const one = (v, list, what, usual) => {
  if (v === undefined && usual !== undefined) return usual;
  if (!list.includes(v)) refuse(`${what} is one of ${list.map((x) => JSON.stringify(x)).join(', ')} — not ${shown(v)}`);
  return v;
};

/** A part's [min, max], relative to its parent, as written (facing +x). */
function readLimit(v, what) {
  const ends = readList(v, what, { least: 2, most: 2 });
  if (!ends.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= TURN)) refuse(`${what} is [min, max], two numbers within ±2π (±${TURN.toFixed(4)}) — not [${ends.map(shown).join(', ')}]`);
  const [lo, hi] = ends;
  if (!(lo <= hi)) refuse(`${what} is [min, max] with min ≤ max — not [${lo}, ${hi}]: swap them`);
  if (!(hi - lo < TURN)) refuse(`${what} spans ${hi - lo} rad: a window must be narrower than a whole turn (2π); leave limit out for a joint that turns freely`);
  return Object.freeze([lo + 0, hi + 0]);
}

function readPart(raw, i, rigName, index) {
  const at = `rig "${rigName}"'s parts[${i}]`;
  readRecord(raw, PART_KEYS, at);
  const name = readName(stored(raw, 'name', `${at}'s name`), `${at}'s name`);
  const what = `rig "${rigName}"'s part "${name}"`;
  if (index.has(name)) refuse(`${what} is named twice (parts[${index.get(name)}] and parts[${i}]): give each part its own name`);
  const parentName = stored(raw, 'parent', `${what}'s parent`);
  if (parentName !== null && !index.has(parentName)) refuse(`${what}'s parent is null (the root) or a part listed before it — not ${shown(parentName)}${typeof parentName === 'string' && NAME.test(parentName) ? ': list the parent first' : ''}`);
  const root = parentName === null;
  const length = readNumber(raw, 'length', what, root ? { lo: 0, hi: MOST_LENGTH } : { lo: 0, hi: MOST_LENGTH, above: true });
  const width = readNumber(raw, 'width', what, { lo: 0, hi: MOST_LENGTH, usual: 0 });
  const mass = readNumber(raw, 'mass', what, { lo: 0, hi: 1e6 });
  const layer = one(stored(raw, 'layer', `${what}'s layer`), LAYERS, `${what}'s layer`, 'mid');
  const rawLimit = stored(raw, 'limit', `${what}'s limit`);
  if (root && rawLimit !== undefined && rawLimit !== null) refuse(`${what} is the root: it has no joint, so no limit (its turn is the pose's turn) — leave limit out`);
  const limit = rawLimit === undefined || rawLimit === null ? null : readLimit(rawLimit, `${what}'s limit`); // null: free, as readRig writes it
  const rest = readNumber(raw, 'rest', what, { lo: limit ? limit[0] : -TURN, hi: limit ? limit[1] : TURN, usual: 0 });
  if (root && rest !== 0) refuse(`${what} is the root: its turn is the pose's turn, so its rest is 0 — not ${rest}`);
  return Object.freeze({ name, parent: parentName, length, rest, limit, width, layer, mass });
}

function readChain(raw, i, rigName, parts, index, chainIndex) {
  const at = `rig "${rigName}"'s chains[${i}]`;
  readRecord(raw, CHAIN_KEYS, at);
  const name = readName(stored(raw, 'name', `${at}'s name`), `${at}'s name`);
  const what = `rig "${rigName}"'s chain "${name}"`;
  if (chainIndex.has(name)) refuse(`${what} is named twice: give each chain its own name`);
  const solver = one(stored(raw, 'solver', `${what}'s solver`), SOLVERS, `${what}'s solver`);
  const [least, most] = solver === 'two-bone' ? [2, 2] : [2, MOST_CHAIN];
  const names = readList(stored(raw, 'parts', `${what}'s parts`), `${what}'s parts (a ${solver} chain: ${least === most ? `exactly ${least}` : `${least} to ${most}`})`, { least, most });
  names.forEach((n, k) => {
    if (typeof n !== 'string' || !index.has(n)) refuse(`${what}'s parts[${k}] is a part of the rig — not ${shown(n)}`);
    const p = parts[index.get(n)];
    if (k === 0 && p.parent === null) refuse(`${what} starts at the root "${n}", which has no joint to turn (the pose's turn moves the whole body): start the chain at a child of the root`);
    if (k > 0 && p.parent !== names[k - 1]) refuse(`${what}'s parts[${k}] "${n}" is the child of "${names[k - 1]}", the part before it — its parent is "${p.parent}"`);
  });
  const bend = stored(raw, 'bend', `${what}'s bend`);
  if (solver === 'two-bone') one(bend, BENDS, `${what}'s bend (which side the middle joint goes: knees "front", elbows "back")`);
  else if (bend !== undefined) refuse(`${what} is a ${solver} chain: bend is for a two-bone chain only — leave it out`);
  return Object.freeze(solver === 'two-bone' ? { name, parts: Object.freeze(names), solver, bend } : { name, parts: Object.freeze(names), solver });
}

function readPartNames(v, what, index, rootName) {
  if (v === undefined) return Object.freeze([]);
  const names = readList(v, what, { most: MOST_PARTS });
  names.forEach((n, k) => {
    if (typeof n !== 'string' || !index.has(n)) refuse(`${what}[${k}] is a part of the rig — not ${shown(n)}`);
    if (n === rootName) refuse(`${what}[${k}] is the root "${n}": name a part below it`);
    if (names.indexOf(n) !== k) refuse(`${what} names "${n}" twice`);
  });
  return Object.freeze(names);
}

/**
 * The rig checked and frozen. Refused, in words naming the part and the fix: anything but an object with the rig's keys;
 * 1 to 64 parts, unique names, parents listed before children, exactly one root; lengths finite, the root 0 ≤ length,
 * every other part above 0, at most 10,000 px; widths 0 to 10,000; a limit [min, max] within ±2π, min ≤ max, narrower
 * than a turn, the rest inside it; mass shares finite, ≥ 0, summing above 0; chains of a two-bone solver exactly 2
 * parts, a FABRIK one 2 to 16, each the child of the one before; a getter anywhere (never run).
 */
export function readRig(rig) {
  if (INFO.has(rig)) return rig;
  readRecord(rig, RIG_KEYS, 'a rig');
  const name = readName(stored(rig, 'name', "a rig's name"), "a rig's name");
  const what = `rig "${name}"`;
  const plane = stored(rig, 'plane', `${what}'s plane`);
  if (plane === 'world') refuse(`${what}'s plane "world" (a 3D rig) is a later round: give plane: "side"`);
  one(plane, ['side'], `${what}'s plane`, 'side');
  const facing = one(stored(rig, 'facing', `${what}'s facing`), [1, -1], `${what}'s facing (1 looks along +x, −1 along −x)`, 1);
  const footHeight = readNumber(rig, 'footHeight', what, { lo: 0, hi: MOST_LENGTH, usual: 0 });
  const rawParts = readList(stored(rig, 'parts', `${what}'s parts`), `${what}'s parts`, { least: 1, most: MOST_PARTS });
  const index = new Map(), parts = [];
  rawParts.forEach((raw, i) => { const p = readPart(raw, i, name, index); parts.push(p); index.set(p.name, i); });
  const roots = parts.filter((p) => p.parent === null);
  if (roots.length !== 1) refuse(`${what} has ${roots.length} parts with parent null (${roots.map((p) => `"${p.name}"`).join(', ') || 'none'}): exactly one is the root, every other names its parent`);
  const rootName = roots[0].name;
  const givenRoot = stored(rig, 'root', `${what}'s root`);
  if (givenRoot !== undefined && givenRoot !== rootName) refuse(`${what}'s root is the part with parent null, "${rootName}" — not ${shown(givenRoot)}`);
  const total = parts.reduce((s, p) => s + p.mass, 0);
  if (!(total > 0 && Number.isFinite(total))) refuse(`${what}'s mass shares sum to ${total}: give some part a mass above 0, so the body has a centre`);
  const scaled = parts.map((p) => Object.freeze({ ...p, mass: p.mass / total }));
  const chainIndex = new Map(), chains = [];
  const rawChains = stored(rig, 'chains', `${what}'s chains`);
  (rawChains === undefined ? [] : readList(rawChains, `${what}'s chains`, { most: MOST_PARTS })).forEach((raw, i) => { const c = readChain(raw, i, name, scaled, index, chainIndex); chains.push(c); chainIndex.set(c.name, i); });
  const feet = readPartNames(stored(rig, 'feet', `${what}'s feet`), `${what}'s feet`, index, rootName);
  const loose = readPartNames(stored(rig, 'loose', `${what}'s loose`), `${what}'s loose`, index, rootName);
  const out = Object.freeze({ name, plane: 'side', facing, root: rootName, footHeight, parts: Object.freeze(scaled), chains: Object.freeze(chains), feet, loose });
  const parent = scaled.map((p) => (p.parent === null ? -1 : index.get(p.parent)));
  // a joint's window as the body faces: facing −1 changes the sign of both ends and swaps them (limits.js · the mirror)
  const windows = scaled.map((p) => (p.limit === null ? null : facing === 1 ? p.limit : Object.freeze([-p.limit[1] + 0, -p.limit[0] + 0])));
  INFO.set(out, { index, parent, windows, chainIndex, rootIndex: index.get(rootName) });
  return out;
}

/**
 * Segment lengths as shares of height (Drillis & Contini 1966, as Winter 2009 tabulates them: hip 0.530, shoulder
 * 0.818, chin 0.870) and mass shares (Dempster 1955, via Winter). The trunk from hip to shoulder (0.288) is split in two
 * halves for the spine chain (ours); the head and neck's mass (0.081) sits on the head, the neck 0 (ours). Widths are
 * ours: shares of height that read as a person at frame size, scaled by `build`.
 */
const HUMAN = Object.freeze({
  footHeight: 0.039, //                       ankle above the floor: 0.530 − 0.245 − 0.246
  back: 0.144, neck: 0.052, head: 0.130, //   0.288 in two halves; shoulder 0.818 → chin 0.870 → top 1
  upperArm: 0.186, forearm: 0.146, hand: 0.108, thigh: 0.245, shin: 0.246, foot: 0.152,
});
const HALF_PI = Math.PI / 2;

/**
 * The usual person, facing +x and standing (each part at rest: arms down, legs straight, feet flat), from its height in
 * px. At 350 px (1.75 m at the package's 200 px a metre) the hip is 185.5 px up. `build` scales the widths only (0.5 to
 * 2, default 1); lengths and masses are the tables'. Refused: a height outside 1 to 10,000 px, a build outside 0.5 to 2.
 */
export function humanRig(options) {
  readRecord(options, ['name', 'height', 'build', 'facing'], 'humanRig\'s options');
  const name = readName(stored(options, 'name', "humanRig's name"), "humanRig's name");
  const h = readNumber(options, 'height', 'humanRig', { lo: 1, hi: MOST_LENGTH });
  const build = readNumber(options, 'build', 'humanRig', { lo: 0.5, hi: 2, usual: 1 });
  const facing = stored(options, 'facing', "humanRig's facing");
  const w = (share) => share * h * build;
  const part = (n, parent, length, rest, limit, width, layer, mass) => ({ name: n, parent, length: length * h, rest, limit, width: w(width), layer, mass });
  const side = (s, layer) => [
    part(`thigh-${s}`, 'pelvis', HUMAN.thigh, HALF_PI, [-0.6, 2.1], 0.06, layer, 0.100), //        hip: flexes forward to about 124°, back 30°
    part(`shin-${s}`, `thigh-${s}`, HUMAN.shin, 0, [0, 2.5], 0.045, layer, 0.0465), //             knee: bends back only (positive)
    part(`foot-${s}`, `shin-${s}`, HUMAN.foot, -HALF_PI, [-HALF_PI - 0.35, -HALF_PI + 0.87], 0.03, layer, 0.0145), // ankle: 20° up, 50° down
    part(`upper-arm-${s}`, 'back-high', HUMAN.upperArm, Math.PI, [0.5, 4.4], 0.04, layer, 0.028), // shoulder: hangs at π; forward and up, a little back
    part(`forearm-${s}`, `upper-arm-${s}`, HUMAN.forearm, -0.15, [-2.6, 0], 0.034, layer, 0.016), // elbow: bends forward only (negative)
    part(`hand-${s}`, `forearm-${s}`, HUMAN.hand, 0, [-1.2, 1.2], 0.028, layer, 0.006),
  ];
  return readRig({
    name, plane: 'side', facing: facing ?? 1, root: 'pelvis', footHeight: HUMAN.footHeight * h,
    parts: [
      { name: 'pelvis', parent: null, length: 0, width: w(0.097), layer: 'mid', mass: 0.142 },
      part('back-low', 'pelvis', HUMAN.back, -HALF_PI, [-2.0, -0.9], 0.108, 'mid', 0.139), //     upright; leans forward (towards 0)
      part('back-high', 'back-low', HUMAN.back, 0, [-0.3, 0.6], 0.114, 'mid', 0.216),
      part('neck', 'back-high', HUMAN.neck, 0, [-0.6, 0.7], 0.034, 'mid', 0),
      part('head', 'neck', HUMAN.head, 0, [-0.5, 0.5], 0.086, 'mid', 0.081),
      ...side('f', 'far'), ...side('n', 'near'),
    ],
    chains: [
      { name: 'arm-n', parts: ['upper-arm-n', 'forearm-n'], solver: 'two-bone', bend: 'back' },
      { name: 'arm-f', parts: ['upper-arm-f', 'forearm-f'], solver: 'two-bone', bend: 'back' },
      { name: 'leg-n', parts: ['thigh-n', 'shin-n'], solver: 'two-bone', bend: 'front' },
      { name: 'leg-f', parts: ['thigh-f', 'shin-f'], solver: 'two-bone', bend: 'front' },
      { name: 'spine', parts: ['back-low', 'back-high'], solver: 'fabrik' },
    ],
    feet: ['foot-n', 'foot-f'], loose: [],
  });
}
