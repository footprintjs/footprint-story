/**
 * Styles for an isometric map: a style is a row of named choices, one per column, and each choice is a strategy behind
 * one interface (docs/design/2026-11-iso-styles.md).
 *
 *   const style = isoStyle({ line: { name: 'ink', width: 5 } })   → { row: {shape: 'box', shading: 'tones', line: 'ink', …}, options: {line: {width: 5}} }
 *   paintPiece(style, { name: 'server', kind: 'block', at: [2, 1], size: [2, 2, 1] }, grid, { base: '#d9e4f3', ink: '#14181f' })
 *                                                                  → { box, centre, outline, items }: the piece's paint list (paint.js)
 *
 * The columns run in order, each reading only what the one before gave: `shape` (the faces) → `shading` (a fill per
 * face) → `line` (strokes) → `palette` (recoloured) → `texture` (marks over the faces) → `effects` (a list, each adding
 * to the whole). A style left out, or a column left out, is today's look (USUAL_STYLE).
 *
 * A choice is `{ column, name, apply(input, context), options: [names it reads], unseeded?: [those that are timing], check(options)?, clashes: [{column, name, fix}] }`;
 * `check` refuses an option value it cannot take, once, when the style is made.
 * `shape`'s apply takes `{piece, grid}` and gives `{box, centre, outline, items}` — the box round it, where its name
 * stands, the outline round it (what a cable's end and a label keep clear of) — every other apply takes the items and gives items.
 * `context` is `{piece, colours, options, random}`: the piece (`name`, `kind`, `at`, `size`), the colours the caller
 * gave (`base`, `ink`: `#rrggbb`, or null when the page decides), the options written for this choice, and `random()`
 * — numbers from 0 to 1 seeded by the style, the piece's name and the column, so a wobble or a grain is the same every
 * time it is drawn, in a deck and in a film. A tool's own choice is named with its own prefix (`'reel:chalk'`) and
 * handed to `isoStyle` in `choices`; the package's names have none. What a choice gives back is checked
 * (paint.js · checkPaint) before the next column reads it; what it throws comes out as it is (the tool's own code).
 *
 * WHY a style is plain data: the record keeps it whole (`style.row`, `style.options`), so "which choices drew this
 * map" is answered from the record. The choices themselves are held apart (a WeakMap), never on the style.
 * WHY clashes are refused here: a pairing that cannot work (a small fixed palette and a gradient) is said once, with
 * the fix, before anything is drawn — never found in the frames.
 *
 * A row may name a look (looks.js · ISO_LOOKS, 0.34.0): `{ look: 'line-art' }` is that look's row, and a column
 * written beside it replaces the look's entry for that column, whole. The style is the row it comes to — named or
 * written out, the same row, options and seeds — with the look's name kept beside it (`style.look`) for the record.
 */
import { BUILT_IN_CHOICES } from './styleChoices.js';
import { ISO_LOOKS } from './looks.js';
import { checkPaint, ownEntries, readColour, MOST_PAINT_POINTS } from './paint.js';
import { FAR, fin, finite, own, refuse, shown, stored } from './thing.js';
// numbers from 0 to 1 seeded by a text (FNV-1a, then mulberry32): the one rule, shared with the human door
import { seeded } from '../seed/seeded.js';

/** The columns, in the order they run; the look a column takes when none is written; the most effects and own choices. */
export const ISO_STYLE_COLUMNS = Object.freeze(['shape', 'shading', 'line', 'palette', 'texture', 'effects']);
export const USUAL_STYLE = Object.freeze({ shape: 'box', shading: 'tones', line: 'ink', palette: 'theme', texture: 'none', effects: Object.freeze([]) });
export const MOST_EFFECTS = 8;
export const MOST_OWN_CHOICES = 64;
/** The names of the choices this package ships, by column. */
export const ISO_STYLE_CHOICES = Object.freeze(Object.fromEntries(ISO_STYLE_COLUMNS.map((col) => [col, Object.freeze(BUILT_IN_CHOICES.filter((c) => c.column === col).map((c) => c.name))])));

const BUILT_IN = /^[a-z][a-z0-9-]{0,31}$/, OWN = /^[a-z][a-z0-9-]{0,15}:[a-z][a-z0-9-]{0,31}$/;
const KINDS = ['block', 'cylinder', 'floor'];
const chosen = new WeakMap();   // a style → its choices, by column (effects: a list)

/** A tool's own choice, checked: the interface, a prefixed name, and plain lists of options and clashes. */
function readOwn(c, i) {
  const what = `isoStyle's choices[${i}]`;
  if (!c || typeof c !== 'object' || Array.isArray(c)) refuse(`${what} is a choice {column, name, apply, options?, clashes?} — not ${shown(c)}`);
  const column = stored(c, 'column', `${what}'s column`), name = stored(c, 'name', `${what}'s name`), apply = stored(c, 'apply', `${what}'s apply`);
  if (!ISO_STYLE_COLUMNS.includes(column)) refuse(`${what}'s column is one of ${ISO_STYLE_COLUMNS.join(', ')} — not ${shown(column)}`);
  if (typeof name !== 'string' || !OWN.test(name)) refuse(`${what}'s name is the tool's prefix and a name, lower case ("reel:chalk"): a name with no prefix is this package's — not ${shown(name)}`);
  if (typeof apply !== 'function') refuse(`${what} (${name}) gives its apply(input, context) — not ${shown(apply)}`);
  const rawOptions = stored(c, 'options', `${what}'s options`) ?? [], rawClashes = stored(c, 'clashes', `${what}'s clashes`) ?? [], check = stored(c, 'check', `${what}'s check`) ?? null;
  const rawUnseeded = stored(c, 'unseeded', `${what}'s unseeded`) ?? [];
  if (!Array.isArray(rawOptions) || rawOptions.length > 16) refuse(`${what} (${name})'s options are the names it reads, at most 16, lower case — not ${shown(rawOptions)}`);
  if (!Array.isArray(rawClashes) || rawClashes.length > 32) refuse(`${what} (${name})'s clashes are a list of at most 32 {column, name, fix} — not ${shown(rawClashes)}`);
  const options = ownEntries(rawOptions, `${what} (${name})'s options`), clashes = ownEntries(rawClashes, `${what} (${name})'s clashes`);
  if (check !== null && typeof check !== 'function') refuse(`${what} (${name})'s check is a function (options) that refuses what it cannot take, or none — not ${shown(check)}`);
  if (options.some((o) => typeof o !== 'string' || !BUILT_IN.test(o))) refuse(`${what} (${name})'s options are the names it reads, at most 16, lower case — not ${shown(options)}`);
  // the options that say when, not what (a pen's speed): left out of the seed, so a slower draw keeps its wobble's shape
  if (!Array.isArray(rawUnseeded)) refuse(`${what} (${name})'s unseeded are the options it reads that are timing, left out of the seed — not ${shown(rawUnseeded)}`);
  const unseeded = ownEntries(rawUnseeded, `${what} (${name})'s unseeded`);
  for (const u of unseeded) if (!options.includes(u)) refuse(`${what} (${name})'s unseeded names options it reads (${options.join(', ') || 'none'}) — not ${shown(u)}`);
  const read = clashes.map((x, k) => {
    const w = `${what} (${name})'s clashes[${k}]`;
    if (!x || typeof x !== 'object') refuse(`${w} is {column, name, fix} — not ${shown(x)}`);
    const col = stored(x, 'column', `${w}'s column`), nm = stored(x, 'name', `${w}'s name`), fix = stored(x, 'fix', `${w}'s fix`);
    if (!ISO_STYLE_COLUMNS.includes(col) || typeof nm !== 'string' || typeof fix !== 'string' || !fix.trim() || fix.length > 200) refuse(`${w} is {column, name, fix}: a column, a choice's name and the fix in words (at most 200 letters) — not ${shown([col, nm, fix])}`);
    return Object.freeze({ column: col, name: nm, fix });
  });
  return Object.freeze({ column, name, apply, check, options: Object.freeze([...options]), unseeded: Object.freeze([...new Set(unseeded)]), clashes: Object.freeze(read) });
}

/** One column's entry: a name, or {name, ...options}. Gives {name, options}. */
function readEntry(entry, column) {
  const what = `the style's ${column}`;
  if (typeof entry === 'string') return { name: entry, options: {} };
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) refuse(`${what} is a choice's name, or {name, …its options} — not ${shown(entry)}`);
  const name = stored(entry, 'name', `${what}'s name`);
  if (typeof name !== 'string') refuse(`${what} names its choice: {name: "ink", width: 5} — not ${shown(name)}`);
  // in the order of their names, so a style written {a, b} and one written {b, a} are the same style, seeded the same;
  // made with fromEntries, so a key "__proto__" (from JSON) is an own key, refused as an option the choice does not take
  const entries = Object.keys(entry).filter((k) => k !== 'name').sort().map((key) => {
    const v = stored(entry, key, `${what}'s ${key}`);
    if (!((typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= FAR) || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 64))) refuse(`${what}'s ${key} is a number, a word or true/false — not ${shown(v)}`);
    return [key, v];
  });
  return { name, options: Object.fromEntries(entries) };
}

/**
 * A style, checked: `row` (a name per column, or {name, …options}), the columns left out today's look, and `choices`
 * (a tool's own). Gives a frozen plain {row, options} — the record of it — or refuses, naming the column and the fix.
 */
export function isoStyle(row = undefined, settings = undefined) {
  if (row !== undefined && row !== null && (typeof row !== 'object' || Array.isArray(row))) refuse(`isoStyle takes a row of choices {shape, shading, line, palette, texture, effects}, or none — not ${shown(row)}`);
  if (settings !== undefined && settings !== null && (typeof settings !== 'object' || Array.isArray(settings))) refuse(`isoStyle's settings are {choices}, or none — not ${shown(settings)}`);
  const ownList = (settings ? stored(settings, 'choices', "isoStyle's choices") : undefined) ?? [];
  if (!Array.isArray(ownList) || ownList.length > MOST_OWN_CHOICES) refuse(`isoStyle's choices are a list of at most ${MOST_OWN_CHOICES} — not ${Array.isArray(ownList) ? `${ownList.length}` : shown(ownList)}`);
  const all = [...BUILT_IN_CHOICES], seen = new Set(all.map((c) => `${c.column}:${c.name}`));
  ownEntries(ownList, "isoStyle's choices").forEach((c, i) => {
    const read = readOwn(c, i), key = `${read.column}:${read.name}`;
    if (seen.has(key)) refuse(`isoStyle's choices[${i}]: ${read.column} "${read.name}" is given twice`);
    seen.add(key); all.push(read);
  });
  // a clash names a choice there is: a misspelt one would never fire
  for (const c of all) for (const x of c.clashes) if (!seen.has(`${x.column}:${x.name}`)) refuse(`${c.column} "${c.name}" clashes with ${x.column} ${shown(x.name)}, which is no choice — the ${x.column} choices are ${all.filter((y) => y.column === x.column).map((y) => `"${y.name}"`).join(', ') || 'none yet'}`);
  const keys = row ? Object.keys(row) : [];
  const looks = Object.keys(ISO_LOOKS).map((n) => `"${n}"`).join(', ');
  for (const k of keys) if (k !== 'look' && !ISO_STYLE_COLUMNS.includes(k)) refuse(`a style's columns are ${ISO_STYLE_COLUMNS.join(', ')} — not ${shown(k)} (a row may also name a look: {look: ${looks}})`);
  // a named look: its row, under what is written (a column written replaces the look's entry for it, whole)
  const lookName = (row ? stored(row, 'look', "the style's look") : undefined) ?? null;
  if (lookName !== null && (typeof lookName !== 'string' || !Object.hasOwn(ISO_LOOKS, lookName))) refuse(`the style's look is one of ${looks} (a row of choices under a name), or none — not ${shown(lookName)}`);
  const look = lookName === null ? null : ISO_LOOKS[lookName], fromLook = new Set();
  /** What a refusal adds when the entry came from the look, not the row: where to change it. */
  const whence = (column) => (fromLook.has(column) ? ` (from the look "${lookName}": write ${column} beside it to change it)` : '');
  const find = (column, name) => {
    const c = all.find((x) => x.column === column && x.name === name);
    if (!c) refuse(`the style's ${column} has no choice ${shown(name)} — the ${column} choices are ${all.filter((x) => x.column === column).map((x) => `"${x.name}"`).join(', ') || 'none yet'}${typeof name === 'string' && OWN.test(name) ? `; "${name}" is a tool's own choice (its name has a prefix), which is code no record holds: hand the choice itself in {choices} (${name.startsWith('human:') ? 'footprint-story/human has the "human:" ones' : 'the tool that names it has it'})` : ''}`);
    return c;
  };
  const out = {}, options = {}, picked = {};
  for (const column of ISO_STYLE_COLUMNS) {
    let written = row ? stored(row, column, `the style's ${column}`) : undefined;
    if (written === undefined && look && Object.hasOwn(look, column)) { written = look[column]; fromLook.add(column); }
    if (column === 'effects') {
      const list = written ?? [];
      if (!Array.isArray(list) || list.length > MOST_EFFECTS) refuse(`the style's effects are a list of at most ${MOST_EFFECTS} — not ${shown(list)}`);
      const read = ownEntries(list, "the style's effects").map((e) => readEntry(e, 'effects'));
      picked.effects = read.map((e) => find('effects', e.name));
      out.effects = Object.freeze(read.map((e) => e.name));
      read.forEach((e, i) => { checkOptions(picked.effects[i], e.options, 'effects'); });
      if (read.some((e) => Object.keys(e.options).length)) options.effects = Object.freeze(read.map((e) => Object.freeze(e.options)));
      continue;
    }
    const { name, options: o } = written === undefined ? { name: USUAL_STYLE[column], options: {} } : readEntry(written, column);
    picked[column] = find(column, name);
    checkOptions(picked[column], o, column);
    out[column] = name;
    if (Object.keys(o).length) options[column] = Object.freeze(o);
  }
  // a pairing that cannot work, said once with its fix (each choice names what it cannot sit with)
  const inRow = (column, name) => (column === 'effects' ? out.effects.includes(name) : out[column] === name);
  for (const c of [...ISO_STYLE_COLUMNS.filter((x) => x !== 'effects').map((x) => picked[x]), ...picked.effects]) {
    for (const x of c.clashes) if (inRow(x.column, x.name)) refuse(`the style's ${c.column} "${c.name}"${whence(c.column)} cannot sit with ${x.column} "${x.name}"${whence(x.column)} — ${x.fix}`);
  }
  // the look's name only when one is named: a style that names none is the record it always was
  const style = Object.freeze({ row: Object.freeze(out), options: Object.freeze(options), ...(lookName === null ? {} : { look: lookName }) });
  chosen.set(style, picked);
  return style;
}

function checkOptions(choice, options, column) {
  for (const key of Object.keys(options)) if (!choice.options.includes(key)) refuse(`the style's ${column} "${choice.name}" takes ${choice.options.length ? choice.options.join(', ') : 'no options'} — not ${shown(key)}`);
  // the values, once, before anything is drawn: the choice's own check (what it throws comes out as it is)
  if (choice.check) choice.check(Object.freeze({ ...options }));
}

/** The piece as a style reads it, checked: {name, kind, at, size}. */
function readPiece(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) refuse(`a style paints a piece {name, kind, at, size} — not ${shown(p)}`);
  const name = own(p, 'name'), kind = own(p, 'kind') ?? 'block', at = own(p, 'at'), size = own(p, 'size');
  // counted in letters (code points), as the map's spec counts a name: a name of 40 letters outside the BMP is 40, not 80
  if (typeof name !== 'string' || !name || [...name].length > 64) refuse(`a piece's name is 1 to 64 letters (its paint items carry it) — not ${shown(name)}`);
  if (!KINDS.includes(kind)) refuse(`a piece's kind is ${KINDS.join(', ')} — not ${shown(kind)}`);
  const list = (v, n, what) => { if (!(Array.isArray(v) && n.includes(v.length) && v.every(fin))) refuse(`"${name}"'s ${what} — not ${shown(v)}`); return Object.freeze([...v]); };
  return Object.freeze({ name, kind,
    // a floor lies on the ground: a lift written on its at is dropped, as StoryDeck reads it
    at: kind === 'floor' ? list(at, [2, 3], 'at is [col, row]').slice(0, 2) : list(at, [2, 3], 'at is [col, row] or [col, row, lift]'),
    size: list(size, kind === 'floor' ? [2] : [3], kind === 'floor' ? 'size is [cols, rows]' : 'size is [wide, deep, high]') });
}

function readColours(c) {
  if (c === undefined || c === null) return Object.freeze({ base: null, ink: null });
  if (typeof c !== 'object' || Array.isArray(c)) refuse(`paintPiece's colours are {base, ink}, or none (the page decides) — not ${shown(c)}`);
  const one = (key) => { const v = stored(c, key, `the colours' ${key}`); return v === undefined || v === null ? null : readColour(v, `the colours' ${key}`); };
  return Object.freeze({ base: one('base'), ink: one('ink') });
}

/** The style's choices (isoStyle made it), or a refusal naming the call. */
function pickedOf(style, call) {
  const picked = chosen.get(style);
  if (!picked) refuse(`${call} takes a style isoStyle made — not ${shown(style)}`);
  return picked;
}

function checkGrid(grid, call) {
  if (!grid || typeof grid !== 'object' || !['block', 'cylinder', 'floor'].every((k) => typeof grid[k] === 'function')) refuse(`${call} draws on a map's grid (isometric(...)) — not ${shown(grid)}`);
}

/**
 * The options the seed reads: the style's, less those a choice names `unseeded` (timing — a pen's speed). A column left
 * with none is left out, as if none were written, so a style that writes no timing option is seeded as it always was.
 * WHY: the seed rule (src/seed/seeded.js, and the human door's UNSEEDED_KEYS): the same thing wobbles the same however
 * fast it is drawn, and wherever it was written (`who` is never in a style).
 */
function seededOptions(style, picked) {
  const less = (o, choice) => {
    if (!o || !choice.unseeded.length) return o;
    const kept = Object.fromEntries(Object.entries(o).filter(([k]) => !choice.unseeded.includes(k)));
    return Object.keys(kept).length ? kept : null;
  };
  const out = {};
  for (const [column, o] of Object.entries(style.options)) {
    if (column === 'effects') { const list = o.map((e, k) => less(e, picked.effects[k]) ?? {}); if (list.some((e) => Object.keys(e).length)) out.effects = list; continue; }
    const kept = less(o, picked[column]);
    if (kept) out[column] = kept;
  }
  return out;
}

/** What each column's apply is handed beside its input: the piece, the colours, its options and its seeded numbers. */
function contextOf(style, p, cs) {
  const seedOf = JSON.stringify([style.row, seededOptions(style, chosen.get(style)), p.name]);
  return (column, options, k = 0) => Object.freeze({ piece: p, colours: cs, options: options ?? Object.freeze({}), random: seeded(`${seedOf}|${column}|${k}`) });
}
const whoOf = (c) => `the style's ${c.column} "${c.name}"`;

/** The shape column run and checked: {box, centre, outline, items}, frozen. */
function shapeWith(picked, style, p, cs, grid) {
  const shape = picked.shape, made = shape.apply(Object.freeze({ piece: p, grid }), contextOf(style, p, cs)('shape', style.options.shape));
  const who = whoOf(shape);
  if (!made || typeof made !== 'object') refuse(`${who} gives back {box, items} — not ${shown(made)}`);
  // what a tool reads of the shape besides its items: the box round it, where its name stands, the outline round it
  const box = stored(made, 'box', `${who}'s box`), centre = stored(made, 'centre', `${who}'s centre`), outline = stored(made, 'outline', `${who}'s outline`);
  if (!box || typeof box !== 'object') refuse(`${who} gives back a box {x, y, w, h} round what it draws — not ${shown(box)}`);
  for (const k of ['x', 'y', 'w', 'h']) { const v = stored(box, k, `${who}'s box ${k}`); if (!finite(v) || ('wh'.includes(k) && v < 0)) refuse(`${who}'s box ${k} is a finite number${'wh'.includes(k) ? ', from 0' : ''} — not ${shown(v)}`); }
  const pt = (q, what) => {
    const xy = Array.isArray(q) && q.length === 2 ? ownEntries(q, `${who}'s ${what}`) : null;   // by index: a getter never runs
    if (!(xy && finite(xy[0]) && finite(xy[1]))) refuse(`${who}'s ${what} is a point [x, y], finite numbers — not ${shown(q)}`);
    return Object.freeze(xy);
  };
  if (!Array.isArray(outline) || outline.length < 3 || outline.length > MOST_PAINT_POINTS) refuse(`${who} gives back its outline, 3 to ${MOST_PAINT_POINTS} points round what it draws — not ${shown(outline)}`);
  const round = Object.freeze(ownEntries(outline, `${who}'s outline`).map((q) => pt(q, 'outline point')));
  return Object.freeze({ box: Object.freeze({ x: box.x, y: box.y, w: box.w, h: box.h }), centre: pt(centre, 'centre'), outline: round, items: checkPaint(own(made, 'items'), who, p.name) });
}

/** The columns after the shape, in order, over the shape's items: the paint list. */
function paintWith(picked, style, p, cs, shapeItems) {
  const context = contextOf(style, p, cs);
  let items = shapeItems;
  for (const column of ['shading', 'line', 'palette', 'texture']) items = checkPaint(picked[column].apply(items, context(column, style.options[column])), whoOf(picked[column]), p.name);
  picked.effects.forEach((c, k) => { items = checkPaint(c.apply(items, context('effects', style.options.effects?.[k], k)), whoOf(c), p.name); });
  return items;
}

/**
 * A piece's paint list, by a style: {box, centre, outline, items}, frozen. `grid` is the map's (`isometric(...)`); `colours` the base
 * and the ink, or none (each item then carries its recipe and no colour, and a page's CSS colours it by role).
 */
export function paintPiece(style, piece, grid, colours = undefined) {
  const picked = pickedOf(style, 'paintPiece'), p = readPiece(piece), cs = readColours(colours);
  checkGrid(grid, 'paintPiece');
  const shaped = shapeWith(picked, style, p, cs, grid);
  return Object.freeze({ box: shaped.box, centre: shaped.centre, outline: shaped.outline, items: paintWith(picked, style, p, cs, shaped.items) });
}

/**
 * The shape column alone: {box, centre, outline, items} — the faces, no fill, no stroke — as paintPiece makes them
 * first. With paintShaped after it, the same list paintPiece gives. WHY two halves: the map flow keeps a piece's shape
 * as a step of its own (mapSteps.js · shape), read by the names and the floor labels, and paints it last (· style).
 */
export function shapePiece(style, piece, grid, colours = undefined) {
  const picked = pickedOf(style, 'shapePiece'), p = readPiece(piece), cs = readColours(colours);
  checkGrid(grid, 'shapePiece');
  return shapeWith(picked, style, p, cs, grid);
}

/** The other columns over a shape's items (shapePiece gave them): the paint list, as paintPiece gives its items. */
export function paintShaped(style, piece, items, colours = undefined) {
  const picked = pickedOf(style, 'paintShaped'), p = readPiece(piece), cs = readColours(colours);
  return paintWith(picked, style, p, cs, checkPaint(items, `${whoOf(picked.shape)}'s items`, p.name));
}

/**
 * A style made again from its record (the frozen {row, options} isoStyle gave): the same choices, the same seeds.
 * WHY: a step of the map flow holds only plain data — a record keeps it, and a structured copy loses what made the style
 * (the choices are held apart, never on it). A tool's own choices are code, which no record holds: hand them again in
 * `settings.choices` (as to isoStyle), and a record that names one is made again with it. A tool painting what the map
 * flow does not (a cable) gets the map's style back this way: `restyle(map.style, {choices})`.
 */
export function restyle(record, settings = undefined) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) refuse(`a style's record is {row, options}, as isoStyle gives it — not ${shown(record)}`);
  const row = stored(record, 'row', "the style's row"), options = stored(record, 'options', "the style's options") ?? {};
  if (!row || typeof row !== 'object' || Array.isArray(row) || !options || typeof options !== 'object' || Array.isArray(options)) refuse(`a style's record is {row, options}, as isoStyle gives it — not ${shown([row, options])}`);
  const entry = (name, o) => (o && Object.keys(o).length ? { ...o, name } : name);
  // the look's name, kept for the record: every column is written out below, so the row is the record's own
  const look = stored(record, 'look', "the style's look");
  const written = look === undefined || look === null ? {} : { look };
  for (const column of ISO_STYLE_COLUMNS) {
    const name = stored(row, column, `the style's ${column}`), o = stored(options, column, `the style's ${column} options`);
    if (name === undefined) continue;
    written[column] = column === 'effects' ? (Array.isArray(name) ? ownEntries(name, "the style's effects").map((n, k) => entry(n, Array.isArray(o) ? o[k] : undefined)) : name) : entry(name, o);
  }
  return isoStyle(written, settings);
}
