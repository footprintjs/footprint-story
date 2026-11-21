/**
 * The map's steps: an isometric map built as named, pure steps, in order — the one copy of the algorithm a deck and a
 * film both build their maps with (docs/design/2026-11-map-flow.md).
 *
 *   buildIsoMap(spec, ISO_MAP_POLICIES.film)   → the built map: frozen plain data (mapSpec.js reads the spec and the policy)
 *   ISO_MAP_STEPS                              → [{name, about, reads, writes, run, decides?, branches?}, …]
 *
 * place → route → fitFloors → grid → shape → names → order → floorLabels → style. Each step reads only the keys it names
 * (`reads`) of the state it is handed, and gives back a new state with the keys it names (`writes`); it never edits what
 * it was handed and never puts a function in the state, so every state is plain data a record can keep. A step that
 * chooses (`place`: the map placed the blocks, or the build from its wires; `grid`: written in numbers, or fitted to the
 * area) says so as data — the choice and its reason in words (`placed`/`placedWhy`, `grid`/`gridWhy`) — and does the
 * rest in the branch it chose (`decides`, `branches`): footprint-story/mapflow runs the same functions as a footprintjs
 * chart, a decider for each, so a run's record keeps what each read, wrote and decided.
 *
 * The state, by key (lists in the spec's order: block i, floor i, wire i):
 *   who, blocks, floors, wires, written (the grid as written, or null), area, style ({row, options}), policy — the input
 *   placed 'hand'|'build', placedWhy, at [[c, r, lift]]       place
 *   routes [route | null]  (null: a straight wire)              route
 *   floorTiles [{at, size}]                                      fitFloors
 *   grid 'written'|'fitted', gridWhy, view {tile, origin, rise}  grid
 *   shapes, floorShapes [{box, centre, outline, faces}]          shape
 *   names, smalls [{lines, size, fits} | null]                   names
 *   order [block name] (the furthest first)                     order
 *   floorLabels [{x, y, matrix, size, lines, fits, covered} | null]   floorLabels
 *   paints, floorPaints [[paint item]]                           style
 *
 * Moved from StoryReel 0.38.0 (src/kits/isometric/build.mjs · buildMap, itself StoryDeck's deck/iso.js order), its
 * numbers become the policy; pinned against a copy of it (test/control/storyreel-0.38.0-build.mjs). What changed: the
 * map is never mutated and holds no closure (a block's room is asked of the grid where it is needed), the grid is kept
 * as its numbers, a piece's shape is the style's `shape` column (style.js · shapePiece, the same code paintPiece runs),
 * and the paint list is a step of its own (`style`).
 */
import { arrange } from './arrange.js';
import { arrangeByGroup, GROUP_MARGIN } from './groups.js';
import { routes } from './routes.js';
import { gridFor } from './fit.js';
import { isometric } from './grid.js';
import { wordsToFit } from './words.js';
import { floorLabelPlace } from './floorLabel.js';
import { restyle, shapePiece, paintShaped } from './style.js';
import { readIsoMap } from './mapSpec.js';

/** A refusal from a part of this package, said in a piece's (or the map's) name, with the fix. */
function fail(who, what, e, fix = '') {
  throw new Error(`isometric: ${who}: ${what}${String(e?.message ?? e).replace(/^isometric: /, '')}${fix}`, { cause: e });
}
const xy = (p) => [p.x, p.y];
/** The grid from its numbers (the state keeps the numbers; the grid's functions are made again where they are needed). */
const gridOf = (view) => isometric({ tile: view.tile, origin: view.origin, rise: view.rise });
/** A floor as a piece of the style: named by its name, or by its place when it has none. */
const floorPiece = (f, i, tiles) => ({ name: f.name ?? `floors[${i}]`, kind: 'floor', at: tiles.at, size: tiles.size });
const blockPiece = (b, at) => ({ name: b.name, kind: b.kind, at, size: b.size });
/** The floor points the laid wires reach, [[col, row, lift], …]: a wire round a block reaches past the blocks. */
const reachOf = (laid) => laid.flatMap((r) => (r?.points ? r.path.map(([c, w, h]) => [c, w, h ?? 0]) : []));

// ---- place -----------------------------------------------------------------------------------------------------------

/** Who places the blocks: the map, when every block has an at (the spec has all or none), else the build. */
function choosePlace(state) {
  const groups = new Set(state.blocks.filter((b) => b.group !== null).map((b) => b.group));
  if (state.blocks.every((b) => b.at !== null)) return { ...state, placed: 'hand', placedWhy: 'every block has an at: the map placed them' };
  return { ...state, placed: 'build', placedWhy: `no block has an at: the build places them from their wires, ${groups.size ? `group by group (${groups.size} group${groups.size === 1 ? '' : 's'})` : 'across the frame'}` };
}
const placeByHand = (state) => ({ ...state, at: state.blocks.map((b) => [...b.at]) });
/** By group when any block has one (arrangeByGroup), else across the frame (arrange). */
function placeByBuild(state) {
  const { blocks, wires } = state, links = wires.map((w) => [w.from.block, w.to.block]);
  let at;
  try {
    at = blocks.some((b) => b.group !== null)
      ? arrangeByGroup(blocks.map((b) => ({ name: b.name, size: b.size, group: b.group })), links)
      : arrange(blocks.map((b) => ({ name: b.name, size: b.size })), links, { across: true }).things.map((t) => t.at);
  } catch (e) { fail(state.who, 'the blocks cannot be placed from their wires: ', e, ' — or give every block an at'); }
  return { ...state, at: at.map((p) => [p[0], p[1], p[2] ?? 0]) };
}

// ---- route -----------------------------------------------------------------------------------------------------------

/**
 * Every wire laid along the floor (routes), each block known by its index, so a refusal of a name is never the map's.
 * A straight wire is not laid: its route is null. A route names its ends and what it passes behind by the blocks' names.
 */
function route(state) {
  const { blocks, at, wires } = state;
  const things = blocks.map((b, i) => ({ name: String(i), at: at[i], size: b.size, round: b.kind === 'cylinder', ...(b.ports.length ? { ports: b.ports.map(({ name, at: a, face }) => ({ name, at: a, face })) } : {}) }));
  const index = new Map(blocks.map((b, i) => [b.name, String(i)])), end = ({ block, port }) => (port !== null ? { thing: index.get(block), port } : index.get(block));
  const asked = wires.filter((w) => !w.straight);
  let found = [];
  try { found = asked.length ? routes(things, asked.map((w) => [end(w.from), end(w.to)])) : []; } catch (e) { fail(state.who, 'the wires cannot be laid: ', e, " — check each wire's ends and the blocks' ports"); }
  const nameOf = (id) => blocks[Number(id)].name;
  return { ...state, routes: wires.map((w) => {
    const k = asked.indexOf(w), r = k < 0 ? null : found[k];
    return r && { ...r, from: w.from.block, to: w.to.block, ...(r.behind ? { behind: r.behind.map(nameOf) } : {}) };
  }) };
}

// ---- fitFloors -------------------------------------------------------------------------------------------------------

/** Each floor with no size fitted round the blocks on it (its group's, or all and their wires), the policy's margin showing on every side. */
function fitFloors(state) {
  const { blocks, at, floors, policy } = state, reach = reachOf(state.routes);
  return { ...state, floorTiles: floors.map((f) => {
    if (f.size !== null) return { at: [...f.at], size: [...f.size] };
    const on = blocks.map((b, i) => ({ at: at[i], size: b.size, group: b.group })).filter((b) => f.group === null || b.group === f.group), reached = f.group === null ? reach : [];
    // a group's floor by the margin arrangeByGroup leaves round a group; any other by the policy's
    const margin = f.group === null ? policy.fit.margin : GROUP_MARGIN;
    const far = (axis, end) => (end ? Math.ceil(Math.max(...on.map((b) => b.at[axis] + b.size[axis]), ...reached.map((p) => p[axis])) - 1e-9) : Math.floor(Math.min(...on.map((b) => b.at[axis]), ...reached.map((p) => p[axis])) + 1e-9));
    const corner = [far(0, false) - margin, far(1, false) - margin], size = [far(0, true) + margin - corner[0], far(1, true) + margin - corner[1]];
    if (Math.max(...size) > 256) throw new Error(`isometric: ${f.who}: fitted round its blocks the floor would be ${size[0]} by ${size[1]} tiles, and a floor is at most 256 a side — give it an at and a size of its own, or take it out`);
    return { at: corner, size };
  }) };
}

// ---- grid ------------------------------------------------------------------------------------------------------------

const chooseGrid = (state) => (state.written
  ? { ...state, grid: 'written', gridWhy: 'the map writes its grid in numbers: its tile and where the floor\'s far corner stands' }
  : { ...state, grid: 'fitted', gridWhy: 'no grid is written: it is fitted so the picture fills the area' });
const viewOf = (g) => ({ tile: [...g.tile], origin: [...g.origin], rise: g.rise });
function gridWritten(state) {
  try { return { ...state, view: viewOf(isometric(state.written)) }; } catch (e) { return fail(state.who, 'its grid: ', e); }
}
/**
 * Fitted so the blocks, the floor their wires reach and the floors the policy holds fill the area, less its inset (a
 * small area keeps half of itself): every floor that names a group, and with `hold: 'groups-and-labels'` every labelled
 * one too. WHY a film holds a labelled floor (StoryReel's gridOf): it shows its whole frame, and a floor's name run off it
 * is a name nobody reads; a deck lets any other floor run past the slide, where a click's camera can frame it.
 */
function gridFitted(state) {
  const { blocks, at, floors, floorTiles, area: [x0, y0, x1, y1], policy: { fit, hold } } = state;
  const inset = Math.min(fit.inset, (x1 - x0) / 4, (y1 - y0) / 4);
  const held = floors.flatMap((f, i) => (f.group !== null || (hold === 'groups-and-labels' && f.label !== null) ? [floorTiles[i]] : []))
    .flatMap(({ at: [c, r], size: [w, d] }) => [[c, r, 0], [c + w, r, 0], [c, r + d, 0], [c + w, r + d, 0]]);
  const grouped = blocks.some((b) => b.group !== null);
  try {
    return { ...state, view: viewOf(gridFor(blocks.map((b, i) => ({ at: at[i], size: b.size })), [x0 + inset, y0 + inset, x1 - inset, y1 - inset],
      { most: fit.most, least: grouped ? fit.grouped : fit.least, also: [...reachOf(state.routes), ...held] })) };
  } catch (e) { return fail(state.who, 'its picture (fitted into the area): ', e); }
}

// ---- shape, names, order, floorLabels, style -------------------------------------------------------------------------

/** Each piece's box, centre, outline and faces on the frame: the style's `shape` column (style.js · shapePiece). */
function shape(state) {
  const { blocks, at, floors, floorTiles } = state, style = restyle(state.style), grid = gridOf(state.view);
  const of = (made) => ({ box: made.box, centre: made.centre, outline: made.outline, faces: made.items });
  const shaped = (who, piece, colours) => { try { return of(shapePiece(style, piece, grid, colours)); } catch (e) { return fail(who, '', e); } };
  return { ...state, shapes: blocks.map((b, i) => shaped(b.who, blockPiece(b, at[i]), b.colours)), floorShapes: floors.map((f, i) => shaped(f.who, floorPiece(f, i, floorTiles[i]), f.colours)) };
}

/**
 * Each label fitted to its block's top: one line at the policy's size, else two (parted by the block's rule), else
 * smaller down to its least, in the policy's share (`clear`) of the room the top has (grid.room: the diamond narrows
 * away from its middle). And the small line under it, on one line in the room the top has at the stack's foot — a
 * film fits it (`small` in the policy); a deck leaves it as written (`small: null`).
 */
function names(state) {
  const { blocks, at, policy: { name, small, clear } } = state, grid = gridOf(state.view);
  const fitted = blocks.map((b, i) => {
    if (b.label === null) return null;
    const room = (high) => grid.room({ at: at[i], size: b.size, round: b.kind === 'cylinder' }, high);
    const big = wordsToFit(b.label, (high) => clear * room(high), b.rule ? { ...name, break: b.rule } : name);
    if (!small || b.small === null) return { big, little: null };
    const high = big.lines.length * big.size * 1.15 + 2 + small.size * 1.15;
    return { big, little: wordsToFit(b.small, [Math.max(1, clear * room(high)), small.size * 1.15], { size: small.size, least: small.least }) };
  });
  return { ...state, names: fitted.map((f) => f?.big ?? null), smalls: fitted.map((f) => f?.little ?? null) };
}

/** The order the blocks are painted in, the furthest first (grid.backToFront), by name. */
function order(state) {
  const { blocks, at } = state;
  return { ...state, order: gridOf(state.view).backToFront(blocks.map((_, i) => i), (i) => ({ at: at[i], size: blocks[i].size })).map((i) => blocks[i].name) };
}

/** Where each floor's label lies (floorLabelPlace), clear of what is drawn over it: each block's outline and each stretch of a laid wire. */
function floorLabels(state) {
  const { floors, floorTiles, shapes } = state, grid = gridOf(state.view);
  const covers = floors.some((f) => f.label !== null) ? [...shapes.map((s) => s.outline),
    ...state.routes.flatMap((r) => { const path = r?.points ? r.path : []; return path.slice(1).map((b, i) => [path[i], b].map(([c, w, h]) => xy(grid.at(c, w, h ?? 0)))); })] : [];
  return { ...state, floorLabels: floors.map((f, i) => {
    if (f.label === null) return null;
    try { return floorLabelPlace(floorTiles[i], state.view, f.label, covers); } catch (e) { return fail(f.who, 'its label: ', e); }
  }) };
}

/** Each piece's paint list: the style's other columns over its faces (style.js · paintShaped), as paintPiece gives it. */
function style(state) {
  const { blocks, at, floors, floorTiles } = state, made = restyle(state.style);
  return { ...state, paints: blocks.map((b, i) => paintShaped(made, blockPiece(b, at[i]), state.shapes[i].faces, b.colours)),
    floorPaints: floors.map((f, i) => paintShaped(made, floorPiece(f, i, floorTiles[i]), state.floorShapes[i].faces, f.colours)) };
}

// ---- the list --------------------------------------------------------------------------------------------------------

/** The keys of the state handed in. */
export const ISO_MAP_INPUT = Object.freeze(['who', 'blocks', 'floors', 'wires', 'written', 'area', 'style', 'policy']);

const part = (reads, writes, run) => Object.freeze({ reads: Object.freeze(reads), writes: Object.freeze(writes), run });
/** A step that chooses: its choice and reason (`decides`: written under `key` and `why`), then the branch it chose. `run` does both, as the chart does. */
function choosing(name, about, decides, branches) {
  const all = Object.values(branches);
  const reads = [...new Set([...decides.reads, ...all.flatMap((b) => b.reads)])], writes = [...new Set([...decides.writes, ...all.flatMap((b) => b.writes)])];
  // each part handed only what it reads, and only what it writes kept: the chart's decider and branch stages do the same
  const run = (state) => {
    const chosen = pick(decides.run(pick(state, decides.reads)), decides.writes), branch = branches[chosen[decides.key]];
    return { ...state, ...chosen, ...pick(branch.run(pick(state, branch.reads)), branch.writes) };
  };
  return Object.freeze({ name, about, reads: Object.freeze(reads), writes: Object.freeze(writes), run, decides: Object.freeze({ ...decides }), branches: Object.freeze(branches) });
}
const plainStep = (name, about, reads, writes, run) => Object.freeze({ name, about, ...part(reads, writes, run) });

/** The steps, in the order they run. */
export const ISO_MAP_STEPS = Object.freeze([
  choosing('place', 'Who places the blocks: the map, or the build from its wires',
    { key: 'placed', why: 'placedWhy', ...part(['blocks'], ['placed', 'placedWhy'], choosePlace) },
    { hand: part(['blocks'], ['at'], placeByHand), build: part(['who', 'blocks', 'wires'], ['at'], placeByBuild) }),
  plainStep('route', 'Each wire laid along the floor, round what stands on it', ['who', 'blocks', 'at', 'wires'], ['routes'], route),
  plainStep('fitFloors', 'Each floor with no size fitted round its blocks', ['blocks', 'at', 'floors', 'routes', 'policy'], ['floorTiles'], fitFloors),
  choosing('grid', 'The grid: written in numbers, or fitted to the area',
    { key: 'grid', why: 'gridWhy', ...part(['written'], ['grid', 'gridWhy'], chooseGrid) },
    { written: part(['who', 'written'], ['view'], gridWritten), fitted: part(['who', 'blocks', 'at', 'routes', 'floors', 'floorTiles', 'area', 'policy'], ['view'], gridFitted) }),
  plainStep('shape', "Each piece's box, centre, outline and faces: the style's shape", ['blocks', 'at', 'floors', 'floorTiles', 'view', 'style'], ['shapes', 'floorShapes'], shape),
  plainStep('names', "Each block's name fitted to its top, and its small line", ['blocks', 'at', 'view', 'policy'], ['names', 'smalls'], names),
  plainStep('order', 'The order the blocks are painted in, the furthest first', ['blocks', 'at', 'view'], ['order'], order),
  plainStep('floorLabels', "Where each floor's label lies, clear of what stands on it", ['floors', 'floorTiles', 'shapes', 'routes', 'view'], ['floorLabels'], floorLabels),
  plainStep('style', "Each piece's paint list: the style's other columns", ['blocks', 'at', 'floors', 'floorTiles', 'shapes', 'floorShapes', 'style'], ['paints', 'floorPaints'], style),
]);

/** Only the named keys of a state: what a step is handed, and what is kept of what it gives back. */
export function pick(state, keys) {
  const out = {};
  for (const k of keys) if (Object.hasOwn(state, k)) out[k] = state[k];
  return out;
}

/** A value frozen all the way down (plain data, no cycles): a built map nobody can edit after it is made. */
export function deepFreeze(v) {
  if (v && typeof v === 'object') { Object.freeze(v); for (const k of Object.keys(v)) deepFreeze(v[k]); }
  return v;
}

/**
 * The map built: the spec and the policy checked (mapSpec.js · readIsoMap), then each step run in order, handed only the
 * keys it reads — so a step that reads a key it does not name finds nothing, and the list stays honest — and keeping
 * only the keys it writes. Gives the last state, frozen plain data: what the steps decided and made, by key (above).
 */
export function buildIsoMap(spec, policy) {
  let state = deepFreeze(readIsoMap(spec, policy));
  for (const step of ISO_MAP_STEPS) state = Object.freeze({ ...state, ...deepFreeze(pick(step.run(pick(state, step.reads)), step.writes)) });
  return state;
}
