/**
 * The map flow's input, checked: the spec (the map as data, already read by a tool from its own format) and the policy
 * (the tool's own numbers). Gives the flow's first state — plain data, a copy of what was handed in — or refuses,
 * naming the piece by its `who` (the tool's words for where it was written) and the fix. Nothing is placed here.
 *
 *   readIsoMap({ blocks: [{ name: 'web', size: [2, 2, 1], who: 'blocks[0] ("web")' }, …], wires: […], area: [0, 0, 1600, 900] }, ISO_MAP_POLICIES.film)
 *     → { who, blocks, floors, wires, written, area, style, policy }
 *
 * The spec (docs/design/2026-11-map-flow.md · The spec and the policy):
 *   blocks    [{ name, kind: 'block'|'cylinder', at: [c, r, lift?]|null, size, label?, small?, rule?, group?, ports?, colours?, who? }]
 *   floors    [{ name?, at|null, size|null, label?, icon?, group?, colours?, who? }]
 *   wires     [{ name?, from: { block, port? }, to: { block, port? }, straight?, who? }]   (an end names a block or an obstacle)
 *   obstacles [{ name, at: [c, r, lift?], size, ports?, who? }]   what stands on the floor that the tool draws itself (0.25.0)
 *   keep      [{ at: [c, r, lift?], size: [wide, deep], name }]   floor a laid wire keeps off where it can (0.25.0)
 *   grid { tile, origin, rise? } | 'fit' | null,   usualGrid { tile, origin, rise? } | null (0.25.0),
 *   area [x0, y0, x1, y1] (where a fitted picture goes),   style (a row of choices),   who (the map, in a refusal)
 *
 * WHY so strict here: every later step trusts the state it is handed, so the one place a value from outside is read is
 * this one — by own stored fields (a getter is refused, never run), every list a plain list with no hole, every size
 * bounded before a list is read, a key that is not one of the piece's refused (a misspelt `lable` is said, not lost).
 * WHY the rules are the tools': all or none of the blocks have an at (the build does not guess where an unplaced block
 * goes among placed ones), one name one piece (a camera frames a piece by its name), a group's floor has a block,
 * a wire to a port runs along the floor — StoryDeck's rules, which StoryReel 0.38.0's read.mjs keeps too. And, from
 * 0.25.0 (StoryDeck's too): obstacles and keep are placed by hand, so the build does not place blocks among them; a
 * floor fitted round its blocks has blocks to be fitted round (a sized floor may name a group with none: it is a named
 * area); a fitted picture has something to fit.
 *
 * WHY obstacles, keep, a floor's icon and usualGrid (0.25.0, docs/design/2026-11-map-flow.md · build order step 3): they
 * are what StoryDeck 0.32.0 hands its map's parts that the steps did not take, each as data — a picture standing on the
 * floor by its footprint (a laid wire goes round it and may end at it, a floor's label keeps clear of it, it takes its
 * place in the paint order), floor kept clear under words placed over the picture (`routes` · keep), the icon a
 * floor's label is drawn with (it takes room on the edge), and the grid a map that places its own blocks is drawn on
 * when it writes none (the deck's: tile 120, its far corner at the slide's middle, 240 px down — depending on the
 * slide's width, so data, not a rule). Left out, each is nothing, and a map is built as 0.24.0 built it.
 */
import { isoStyle, MOST_OWN_CHOICES } from './style.js';
import { ownEntries, readColour } from './paint.js';
import { readPorts } from './ports.js';
import { isometric } from './grid.js';
import { MOST_KEEP, MOST_ROUTES } from './routes.js';
import { MOST_ISOMETRIC_THINGS } from './order.js';
import { MOST_FLOOR_LABEL } from './floorLabel.js';
import { fin, numbers, readThing, refuse, shown, stored } from './thing.js';

/**
 * How much a map holds: blocks, floors and obstacles together, wires, stretches kept clear, the letters of a name, a
 * block's label (and its small line), a group and a `who`. WHY a block's label may run to 2000 letters (0.25.0; 120
 * before): a deck draws whatever name its writer gives a block and says it does not fit (`fits: false`), never cuts it,
 * so the steps take what a page can hold; bounded, because fitting a name takes time that grows with it. A floor's label
 * stays at floorLabel.js · MOST_FLOOR_LABEL (120): both tools refuse a longer one themselves.
 */
export const ISO_MAP_LIMITS = Object.freeze({ pieces: MOST_ISOMETRIC_THINGS, wires: MOST_ROUTES, keep: MOST_KEEP, name: 64, label: 2000, group: 100, who: 200 });

/**
 * The tools' numbers. `film`: StoryReel 0.38.0's ISO_FIT (kits/isometric/build.mjs) — StoryDeck's numbers, and a film's
 * small line fitted down to 12 px; a fitted picture holds every floor that names a group or has a label (a film shows
 * its whole frame, and a name run off it is a name nobody reads). `deck`: StoryDeck 0.32.0's (deck/iso.js ·
 * FITTED_TILE, INSET, MARGIN, NAME, CLEAR): its small line left as written, and only a group's floor held (any other may
 * run past the slide, where a click's camera frames it); and its blocks cover a floor's label by the block each stands in
 * (`cover: 'block'`, deck/iso.js · isoDrawn's covers: a cylinder's box, not its round edge). The film's is pinned against
 * StoryReel's build, the deck's against StoryDeck 0.32.0's isoDrawn (test/control/).
 */
const FIT = Object.freeze({ most: 160, least: 96, grouped: 64, inset: 40, margin: 1 });
const NAME_SIZE = Object.freeze({ size: 26, least: 16 });
export const ISO_MAP_POLICIES = Object.freeze({
  film: Object.freeze({ fit: FIT, name: NAME_SIZE, small: Object.freeze({ size: 18, least: 12 }), clear: 0.9, hold: 'groups-and-labels' }),
  deck: Object.freeze({ fit: FIT, name: NAME_SIZE, small: null, clear: 0.9, hold: 'groups', cover: 'block' }),
});
/** Which floors a fitted picture holds: those that name a group, or those and every labelled one. */
export const ISO_MAP_HOLDS = Object.freeze(['groups', 'groups-and-labels']);
/**
 * What a block covers of a floor's label (the policy's `cover`, 0.25.0): `drawn`, the outline it draws (the style's
 * shape: a cylinder's round edge) — a film's, and the rule when left out; `block`, the outline of the block it stands
 * in (a cylinder's square box) — StoryDeck's. WHY a deck's differs: its label keeps clear of the box a piece is placed
 * by, the one a click lights; a policy field, not a guess, so each tool keeps its own pages.
 */
export const ISO_MAP_COVERS = Object.freeze(['drawn', 'block']);

const KINDS = ['block', 'cylinder'], RULES = ['even', 'fill'];
const MAP_KEYS = ['blocks', 'floors', 'wires', 'obstacles', 'keep', 'grid', 'usualGrid', 'area', 'style', 'who'];
const BLOCK_KEYS = ['name', 'kind', 'at', 'size', 'label', 'small', 'rule', 'group', 'ports', 'colours', 'who'];
const FLOOR_KEYS = ['name', 'at', 'size', 'label', 'icon', 'group', 'colours', 'who'];
const OBSTACLE_KEYS = ['name', 'at', 'size', 'ports', 'who'], KEEP_KEYS = ['at', 'size', 'name'];
const WIRE_KEYS = ['name', 'from', 'to', 'straight', 'who'];
const POLICY_KEYS = ['fit', 'name', 'small', 'clear', 'hold', 'cover'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** An object's keys, each one it takes: a key it does not take is refused, naming the ones it does. */
function keysOf(o, keys, who) {
  if (!isObject(o)) refuse(`${who} is an object of ${keys.join(', ')} — not ${shown(o)}`);
  for (const k of Object.keys(o)) if (!keys.includes(k)) refuse(`${who} takes ${keys.join(', ')} — not ${shown(k)}`);
}

/** A plain list of at most `most`, read entry by entry (paint.js · ownEntries), its length checked first. */
function listOf(v, most, who, form) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) refuse(`${who} is a list, ${form} — not ${shown(v)}`);
  if (v.length > most) refuse(`${who} holds at most ${most}, and this one has ${v.length} — split the map in two`);
  return ownEntries(v, who);
}

/** Words: null when left out, else text with something to show, at most `most` letters. */
function wordsOf(v, most, who, key) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || !v.trim()) refuse(`${who}: ${key} is words ("Server"), or null for none — not ${shown(v)}`);
  if ([...v].length > most) refuse(`${who}: ${key} is at most ${most} letters — this one has ${[...v].length}: shorten it`);
  return v;
}

/**
 * A piece's `who`: the tool's words, or the place in the spec when it gives none. WHY letters (code points, `[...who]`),
 * not `who.length`: a name and a label count letters, and the same limit counted in UTF-16 units refused a `who` of 200
 * letters from beyond the Basic Multilingual Plane ("𝒜", an emoji) at 101 — one rule counts one way.
 */
function whoOf(o, fallback) {
  const who = stored(o, 'who', `${fallback}'s who`);
  if (who === undefined || who === null) return fallback;
  if (typeof who !== 'string' || !who.trim() || [...who].length > ISO_MAP_LIMITS.who) refuse(`${fallback}'s who is the tool's words for where it was written, 1 to ${ISO_MAP_LIMITS.who} letters ('blocks[2] ("db")') — not ${shown(who)}`);
  return who;
}

function colours(v, who) {
  if (v === undefined || v === null) return null;
  if (!isObject(v)) refuse(`${who}: colours is {base, ink} ("#rrggbb" each, or null for the page's), or null — not ${shown(v)}`);
  keysOf(v, ['base', 'ink'], `${who}: colours`);
  const one = (key) => { const c = stored(v, key, `${who}: colours' ${key}`); return c === undefined || c === null ? null : readColour(c, `${who}: colours' ${key}`); };
  return { base: one('base'), ink: one('ink') };
}

/** A refusal from a part of this package, said in the piece's name. */
function named(who, fn) {
  try { return fn(); } catch (e) { throw new Error(`isometric: ${who}: ${String(e?.message ?? e).replace(/^isometric: /, '')}`, { cause: e }); }
}

function readBlock(b, i) {
  const place = `blocks[${i}]`;
  keysOf(b, BLOCK_KEYS, place);
  const name = nameOf(b, place);
  const who = whoOf(b, `${place} (${JSON.stringify(name)})`);
  const kind = stored(b, 'kind', `${who}'s kind`) ?? 'block';
  if (!KINDS.includes(kind)) refuse(`${who}: kind is ${KINDS.join(' or ')} — not ${shown(kind)}`);
  const at = stored(b, 'at', `${who}'s at`) ?? null, size = stored(b, 'size', `${who}'s size`);
  const read = named(who, () => readThing({ at: at ?? [0, 0], size }, `a ${kind}`));
  if (kind === 'cylinder' && read.size[0] !== read.size[1]) refuse(`${who}: a cylinder is round — its size is [wide, wide, high], the same width and depth (not ${shown(read.size)})`);
  const label = wordsOf(stored(b, 'label', `${who}'s label`), ISO_MAP_LIMITS.label, who, 'label'), small = wordsOf(stored(b, 'small', `${who}'s small`), ISO_MAP_LIMITS.label, who, 'small');
  if (small !== null && label === null) refuse(`${who}: small is the line under its label — give it a label too`);
  const rule = stored(b, 'rule', `${who}'s rule`) ?? null;
  if (rule !== null && !RULES.includes(rule)) refuse(`${who}: rule is how its label breaks onto two lines, ${RULES.map((r) => `"${r}"`).join(' or ')} — not ${shown(rule)}`);
  if (rule !== null && label === null) refuse(`${who}: rule says how its label breaks onto two lines — give it a label too`);
  const group = wordsOf(stored(b, 'group', `${who}'s group`), ISO_MAP_LIMITS.group, who, 'group');
  const given = stored(b, 'ports', `${who}'s ports`);
  const ports = given === undefined || given === null ? [] : named(who, () => readPorts(Array.isArray(given) ? ownEntries(given, 'its ports') : given, read.size, kind === 'cylinder', JSON.stringify(name)).map((p) => ({ name: p.name, at: [...p.at], face: p.face })));
  return { name, kind, at: at === null ? null : read.at, size: read.size, label, small, rule, group, ports, colours: colours(stored(b, 'colours', `${who}'s colours`), who), who };
}

function readFloor(f, i) {
  const place = `floors[${i}]`;
  keysOf(f, FLOOR_KEYS, place);
  const name = stored(f, 'name', `${place}'s name`) ?? null;
  if (name !== null && (typeof name !== 'string' || !name || [...name].length > ISO_MAP_LIMITS.name)) refuse(`${place}'s name is 1 to ${ISO_MAP_LIMITS.name} letters, or null for none — not ${shown(name)}`);
  const who = whoOf(f, name === null ? place : `${place} (${JSON.stringify(name)})`);
  const at = stored(f, 'at', `${who}'s at`) ?? null, size = stored(f, 'size', `${who}'s size`) ?? null;
  if ((at === null) !== (size === null)) refuse(`${who}: a floor gives its at and its size ([0, 0] and [8, 5]), or neither, and is fitted round its blocks`);
  const tiles = size === null ? null : numbers(size, [2], `${who}: size`, '[cols, rows], whole numbers 1 to 256');
  if (tiles && !tiles.every((n) => Number.isInteger(n) && n >= 1 && n <= 256)) refuse(`${who}: size is [cols, rows], whole numbers 1 to 256 — not ${shown(size)}`);
  const corner = at === null ? null : numbers(at, [2], `${who}: at`, '[col, row], its far corner');
  const label = wordsOf(stored(f, 'label', `${who}'s label`), MOST_FLOOR_LABEL, who, 'label'), icon = stored(f, 'icon', `${who}'s icon`) ?? false;
  if (typeof icon !== 'boolean') refuse(`${who}: icon is true (the tool draws an icon before its label, so the label has that much less room) or false — not ${shown(icon)}`);
  if (icon && label === null) refuse(`${who}: icon goes before its label — give it a label too, or take icon off`);
  return { name, at: corner, size: tiles, label, icon, group: wordsOf(stored(f, 'group', `${who}'s group`), ISO_MAP_LIMITS.group, who, 'group'),
    colours: colours(stored(f, 'colours', `${who}'s colours`), who), who };
}

/** A piece's name: 1 to ISO_MAP_LIMITS.name letters (a wire, and a camera, name it by it). */
function nameOf(o, place) {
  const name = stored(o, 'name', `${place}'s name`);
  if (typeof name !== 'string' || !name || [...name].length > ISO_MAP_LIMITS.name) refuse(`${place}'s name is 1 to ${ISO_MAP_LIMITS.name} letters (a wire names its block by it) — not ${shown(name)}`);
  return name;
}

/**
 * An obstacle: what stands on the floor that the tool draws itself (StoryDeck's footprint: a picture of a laptop
 * standing on the floor by the tiles it takes). A laid wire goes round it as round a block, and may end at it (at a
 * port of its own); a floor fitted round the map's blocks holds it; a floor's label keeps clear of its block; it takes
 * its place in the paint order. Its height may be 0 (flat on the floor). It has no name fitted and no paint list.
 */
function readObstacle(o, i) {
  const place = `obstacles[${i}]`;
  keysOf(o, OBSTACLE_KEYS, place);
  const name = nameOf(o, place), who = whoOf(o, `${place} (${JSON.stringify(name)})`);
  const read = named(who, () => readThing({ at: stored(o, 'at', `${who}'s at`), size: stored(o, 'size', `${who}'s size`) }, 'an obstacle'));
  const given = stored(o, 'ports', `${who}'s ports`);
  const ports = given === undefined || given === null ? [] : named(who, () => readPorts(Array.isArray(given) ? ownEntries(given, 'its ports') : given, read.size, false, JSON.stringify(name)).map((p) => ({ name: p.name, at: [...p.at], face: p.face })));
  return { name, at: read.at, size: read.size, ports, who };
}

/**
 * A stretch of floor kept clear (routes · keep): floor a laid wire keeps off where it has another way, under words placed
 * over the picture; `name` names those words (a route's `under` says it). The tool works the stretches out from where
 * its words are on the frame (floorUnder), so they are tiles here.
 */
function readKeepStretch(k, i) {
  const who = `keep[${i}]`;
  keysOf(k, KEEP_KEYS, who);
  const name = stored(k, 'name', `${who}'s name`);
  if (typeof name !== 'string' || !name.trim() || [...name].length > ISO_MAP_LIMITS.name) refuse(`${who}: name is the words it keeps the floor clear under (a route's under names them), 1 to ${ISO_MAP_LIMITS.name} letters — not ${shown(name)}`);
  const size = numbers(stored(k, 'size', `${who}'s size`), [2], `${who}: size`, '[wide, deep], in tiles');
  if (!(size[0] > 0 && size[1] > 0)) refuse(`${who}: size is [wide, deep] in tiles, each above 0 — not ${shown(size)}`);
  const read = named(who, () => readThing({ at: stored(k, 'at', `${who}'s at`), size: [...size, 0] }, 'a stretch kept clear'));
  return { at: read.at, size, name };
}

function readWire(w, i, blocks, obstacles) {
  const place = `wires[${i}]`;
  keysOf(w, WIRE_KEYS, place);
  const name = stored(w, 'name', `${place}'s name`) ?? null;
  if (name !== null && (typeof name !== 'string' || !name || [...name].length > ISO_MAP_LIMITS.name)) refuse(`${place}'s name is 1 to ${ISO_MAP_LIMITS.name} letters, or null for none — not ${shown(name)}`);
  const who = whoOf(w, name === null ? place : `${place} (${JSON.stringify(name)})`);
  const end = (key) => {
    const e = stored(w, key, `${who}'s ${key}`);
    keysOf(e, ['block', 'port'], `${who}: ${key}`);
    const block = stored(e, 'block', `${who}: ${key}'s block`), port = stored(e, 'port', `${who}: ${key}'s port`) ?? null;
    const b = blocks.find((x) => x.name === block) ?? obstacles.find((x) => x.name === block);
    if (!b) refuse(`${who}: ${key} names ${shown(block)}, which is no block here — the blocks are ${blocks.map((x) => JSON.stringify(x.name)).join(', ') || 'none'}${obstacles.length ? `, the obstacles ${obstacles.map((x) => JSON.stringify(x.name)).join(', ')}` : ''}`);
    if (port !== null && !b.ports.some((p) => p.name === port)) refuse(`${who}: ${key}: ${JSON.stringify(b.name)} has no port ${shown(port)} — ${b.ports.length ? `its ports are ${b.ports.map((p) => JSON.stringify(p.name)).join(', ')}` : 'give it ports'}`);
    return { block, port };
  };
  const from = end('from'), to = end('to'), straight = stored(w, 'straight', `${who}'s straight`) ?? false;
  if (from.block === to.block) refuse(`${who}: it joins ${JSON.stringify(from.block)} to itself — name another block at one end`);
  if (typeof straight !== 'boolean') refuse(`${who}: straight is true (drawn straight, not laid along the floor) or false — not ${shown(straight)}`);
  if (straight && (from.port !== null || to.port !== null)) refuse(`${who}: a wire to a port runs along the floor, and a straight one does not — take straight off, or the port`);
  return { name, from, to, straight, who };
}

/** The tool's numbers, checked: {fit: {most, least, grouped, inset, margin}, name: {size, least}, small: {size, least}|null, clear, hold, cover?}. */
export function readIsoPolicy(policy) {
  keysOf(policy, POLICY_KEYS, 'the map policy');
  const part = (key, keys) => { const v = stored(policy, key, `the map policy's ${key}`); keysOf(v, keys, `the map policy's ${key}`); return v; };
  const num = (o, key, what, ok, form) => { const v = stored(o, key, `${what} ${key}`); if (!(fin(v) && ok(v))) refuse(`${what} ${key} is ${form} — not ${shown(v)}`); return v; };
  const f = part('fit', ['most', 'least', 'grouped', 'inset', 'margin']), fw = "the map policy's fit";
  const fit = { most: num(f, 'most', fw, (v) => v >= 2, 'a tile\'s most px, 2 or more'), least: num(f, 'least', fw, (v) => v >= 2, 'a tile\'s least px, 2 or more'), grouped: num(f, 'grouped', fw, (v) => v >= 2, 'a tile\'s least px for a map of groups, 2 or more'),
    inset: num(f, 'inset', fw, (v) => v >= 0, 'the px a fitted picture keeps from the area\'s edges, 0 or more'), margin: num(f, 'margin', fw, (v) => Number.isInteger(v) && v >= 0 && v <= 16, 'the tiles a fitted floor shows round its blocks, a whole number 0 to 16') };
  if (fit.least > fit.most || fit.grouped > fit.most) refuse(`the map policy's fit has least and grouped no more than most — not ${shown([fit.least, fit.grouped, fit.most])}`);
  const size = (key, o) => { const w = `the map policy's ${key}`, s = num(o, 'size', w, (v) => v > 0, 'px above 0'), least = num(o, 'least', w, (v) => v > 0 && v <= s, `px above 0 and no more than its size (${s})`); return { size: s, least }; };
  const name = size('name', part('name', ['size', 'least']));
  const rawSmall = stored(policy, 'small', "the map policy's small");
  let small = null;
  if (rawSmall !== null) { keysOf(rawSmall, ['size', 'least'], "the map policy's small (or null: the small line left as written)"); small = size('small', rawSmall); }
  const clear = num(policy, 'clear', "the map policy's", (v) => v > 0 && v <= 1, "the share of a top's room a name is given, above 0 and at most 1");
  const hold = stored(policy, 'hold', "the map policy's hold");
  if (!ISO_MAP_HOLDS.includes(hold)) refuse(`the map policy's hold is ${ISO_MAP_HOLDS.map((h) => `"${h}"`).join(' or ')} (which floors a fitted picture holds) — not ${shown(hold)}`);
  const cover = stored(policy, 'cover', "the map policy's cover") ?? 'drawn';
  if (!ISO_MAP_COVERS.includes(cover)) refuse(`the map policy's cover is ${ISO_MAP_COVERS.map((c) => `"${c}"`).join(' or ')} (what a block covers of a floor's label: the outline it draws, or the block it stands in), or left out for "drawn" — not ${shown(cover)}`);
  return { fit, name, small, clear, hold, cover };
}

/** A grid in numbers, {tile, origin, rise?}, as `key` gives it: checked by isometric(), kept as given (a tile of one number stays one). */
function gridNumbers(raw, who, key) {
  keysOf(raw, ['tile', 'origin', 'rise'], `${who}'s ${key}`);
  const tile = stored(raw, 'tile', `${who}'s ${key} tile`), rise = stored(raw, 'rise', `${who}'s ${key} rise`) ?? null;
  if (stored(raw, 'origin', `${who}'s ${key} origin`) === undefined) refuse(`${who}'s ${key} gives its origin too: where the floor's far corner stands on the frame, [x, y]`);
  const g = named(`${who}'s ${key}`, () => isometric({ tile: typeof tile === 'number' ? tile : numbers(tile, [2], 'tile', '[width, height]'), origin: stored(raw, 'origin', 'origin'), ...(rise === null ? {} : { rise }) }));
  return { tile: typeof tile === 'number' ? tile : [...g.tile], origin: [...g.origin], ...(rise === null ? {} : { rise: g.rise }) };
}

const SETTINGS_KEYS = ['choices'];
/**
 * The tool's own style choices, handed beside the spec and the policy: `{choices}` (as isoStyle takes them — a tool's
 * `reel:chalk`, footprint-story/human's `sketchyLine` and `hatchTexture`), or none. Gives frozen `{choices}`, the list
 * copied (a later edit of the caller's list reaches nothing), each choice checked once here by isoStyle.
 * WHY a third argument, not the spec or the policy: a choice is code, and the spec is data a tool writes (a record keeps
 * it whole) while the policy is the tool's numbers; the spec's `style` names the choices (`line: 'human:sketchy'`) and
 * the record keeps those names — the code is handed again on every build, as `restyle` takes it.
 */
export function readIsoMapSettings(settings, call = 'buildIsoMap') {
  if (settings === undefined || settings === null) return Object.freeze({ choices: Object.freeze([]) });
  if (!isObject(settings)) refuse(`${call}'s settings are {choices} (a tool's own style choices), or none — not ${shown(settings)}`);
  for (const k of Object.keys(settings)) if (!SETTINGS_KEYS.includes(k)) refuse(`${call}'s settings are {choices} (a tool's own style choices: [sketchyLine, hatchTexture] from footprint-story/human) — not ${shown(k)}`);
  const raw = stored(settings, 'choices', `${call}'s choices`) ?? [];
  if (!Array.isArray(raw) || raw.length > MOST_OWN_CHOICES) refuse(`${call}'s choices are a list of at most ${MOST_OWN_CHOICES} style choices — not ${Array.isArray(raw) ? `${raw.length} of them` : shown(raw)}`);
  const choices = Object.freeze(ownEntries(raw, `${call}'s choices`));
  named(`${call}'s choices`, () => isoStyle(null, { choices }));
  return Object.freeze({ choices });
}

/**
 * The flow's first state: the spec and the policy checked and copied, or a refusal naming the piece and the fix.
 * `settings` are the tool's own style choices ({choices}, readIsoMapSettings): what the spec's style may name besides
 * this package's.
 * `written` is the grid as the map writes it: its numbers, the word 'fit' (the map asks for the fitted grid), or null.
 */
export function readIsoMap(spec, policy, settings = undefined) {
  if (!isObject(spec)) refuse(`a map is {blocks, floors, wires, obstacles, keep, grid, usualGrid, area, style, who} — not ${shown(spec)}`);
  const who = whoOf(spec, 'the map');
  keysOf(spec, MAP_KEYS, who);
  const pol = readIsoPolicy(policy), tools = readIsoMapSettings(settings);
  const rawBlocks = stored(spec, 'blocks', `${who}'s blocks`), rawFloors = stored(spec, 'floors', `${who}'s floors`), rawObstacles = stored(spec, 'obstacles', `${who}'s obstacles`);
  const count = (v) => (Array.isArray(v) ? v.length : 0), pieces = count(rawBlocks) + count(rawFloors) + count(rawObstacles);
  if (pieces > ISO_MAP_LIMITS.pieces) refuse(`${who} holds at most ${ISO_MAP_LIMITS.pieces} blocks, floors and obstacles, and this one has ${pieces} — split it into two maps`);
  const blocks = listOf(rawBlocks, ISO_MAP_LIMITS.pieces, `${who}'s blocks`, '[{name, size, …}]').map(readBlock);
  const floors = listOf(rawFloors, ISO_MAP_LIMITS.pieces, `${who}'s floors`, '[{at, size, label?, group?}]').map(readFloor);
  const obstacles = listOf(rawObstacles, ISO_MAP_LIMITS.pieces, `${who}'s obstacles`, '[{name, at, size}]').map(readObstacle);
  // a map with no block draws its floors and what stands on them (StoryDeck draws a floor alone); with nothing at all it draws nothing
  if (!blocks.length && !floors.length && !obstacles.length) refuse(`${who} draws blocks on a floor — give it blocks: [{name: "you", size: [2, 2, 1]}, …]`);
  const wires = listOf(stored(spec, 'wires', `${who}'s wires`), ISO_MAP_LIMITS.wires, `${who}'s wires`, '[{from: {block}, to: {block}}]').map((w, i) => readWire(w, i, blocks, obstacles));
  const keep = listOf(stored(spec, 'keep', `${who}'s keep`), ISO_MAP_LIMITS.keep, `${who}'s keep`, '[{at, size, name}]').map(readKeepStretch);
  // one name, one piece (a floor with none is named by its place, as its paint items are)
  const names = new Map();
  for (const p of [...blocks, ...floors.map((f, i) => ({ ...f, name: f.name ?? `floors[${i}]` })), ...obstacles, ...wires.filter((w) => w.name !== null)]) {
    if (names.has(p.name)) refuse(`${p.who}: ${JSON.stringify(p.name)} is the name of ${names.get(p.name)} too — a camera frames a piece by its name, so give each its own`);
    names.set(p.name, p.who);
  }
  const unplaced = blocks.filter((b) => b.at === null), byBuild = unplaced.length > 0;
  if (byBuild && unplaced.length < blocks.length) refuse(`${who}: ${unplaced.map((b) => JSON.stringify(b.name)).join(', ')} ${unplaced.length === 1 ? 'has' : 'have'} no at and ${blocks.filter((b) => b.at).map((b) => JSON.stringify(b.name)).join(', ')} ${blocks.length - unplaced.length === 1 ? 'has' : 'have'} one: the blocks are placed from the wires only when none has an at — take at off the others, or give every block one`);
  // what the map places by hand stays where it is put: the build does not place blocks round it (StoryDeck's rule)
  if (byBuild && obstacles.length) refuse(`${obstacles[0].who}: an obstacle stands where the map puts it, and no block has an at: the build places the blocks only when nothing on the floor is placed by hand — give every block an at`);
  if (byBuild && keep.length) refuse(`${who}: keep names floor in tiles, and no block has an at: the build places the blocks only when nothing on the floor is placed by hand — give every block an at`);
  for (const f of floors.filter((x) => x.size === null)) {
    // a sized floor that names a group with no block is a named area; one fitted round its group's blocks needs blocks to be fitted round
    if (f.group !== null && !blocks.some((b) => b.group === f.group)) refuse(`${f.who}: its group ${JSON.stringify(f.group)} has no block — give blocks the group ${JSON.stringify(f.group)}, or take the group off the floor, or give the floor an at and a size of its own`);
    if (!blocks.length && !obstacles.length) refuse(`${f.who}: a floor with no size is fitted round what stands on it, and this map has nothing — give it an at and a size ([0, 0] and [8, 5])`);
  }
  const rawGrid = stored(spec, 'grid', `${who}'s grid`) ?? null;
  if (rawGrid !== null && rawGrid !== 'fit' && !isObject(rawGrid)) refuse(`${who}'s grid is {tile, origin, rise?} in numbers, the word "fit" (the map asks for the fitted grid), or null — not ${shown(rawGrid)}`);
  const written = rawGrid === null || rawGrid === 'fit' ? rawGrid : gridNumbers(rawGrid, who, 'grid');
  const rawUsual = stored(spec, 'usualGrid', `${who}'s usualGrid`) ?? null;
  const usualGrid = rawUsual === null ? null : gridNumbers(rawUsual, who, 'usualGrid');
  const rawArea = stored(spec, 'area', `${who}'s area`) ?? null;
  const area = rawArea === null ? null : numbers(rawArea, [4], `${who}'s area`, '[x0, y0, x1, y1] on the frame, where a fitted picture goes');
  if (area && !(area[2] > area[0] && area[3] > area[1])) refuse(`${who}'s area is [x0, y0, x1, y1] with x1 past x0 and y1 past y0 — not ${shown(rawArea)}`);
  // the grid the steps will choose (mapSteps.js · chooseGrid): fitted unless written in numbers, or the map placed its blocks and the tool hands its usual grid
  const fitted = written === null || written === 'fit' ? written === 'fit' || byBuild || usualGrid === null : false;
  if (fitted && !area) refuse(`${who} gives an area to fit its picture into ([0, 0, 1600, 900]), or a grid in numbers ({tile, origin})`);
  if (fitted && !blocks.length && !obstacles.length) refuse(`${who}: a fitted grid is fitted to what stands on the floor, and this map has nothing — add a block, or write the grid in numbers ({tile, origin})`);
  const rawStyle = stored(spec, 'style', `${who}'s style`) ?? null;
  const style = named(`${who}'s style`, () => isoStyle(rawStyle, tools));
  return { who, blocks, floors, wires, obstacles, keep, written, usualGrid, area, style: { row: style.row, options: style.options, ...(style.look ? { look: style.look } : {}) }, policy: pol };
}
