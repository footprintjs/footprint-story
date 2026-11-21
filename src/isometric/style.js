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
 * A choice is `{ column, name, apply(input, context), options: [names it reads], check(options)?, clashes: [{column, name, fix}] }`;
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
 */
import { BUILT_IN_CHOICES } from './styleChoices.js';
import { checkPaint, ownEntries, readColour, MOST_PAINT_POINTS } from './paint.js';
import { FAR, fin, finite, own, refuse, shown, stored } from './thing.js';

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
  if (!Array.isArray(rawOptions) || rawOptions.length > 16) refuse(`${what} (${name})'s options are the names it reads, at most 16, lower case — not ${shown(rawOptions)}`);
  if (!Array.isArray(rawClashes) || rawClashes.length > 32) refuse(`${what} (${name})'s clashes are a list of at most 32 {column, name, fix} — not ${shown(rawClashes)}`);
  const options = ownEntries(rawOptions, `${what} (${name})'s options`), clashes = ownEntries(rawClashes, `${what} (${name})'s clashes`);
  if (check !== null && typeof check !== 'function') refuse(`${what} (${name})'s check is a function (options) that refuses what it cannot take, or none — not ${shown(check)}`);
  if (options.some((o) => typeof o !== 'string' || !BUILT_IN.test(o))) refuse(`${what} (${name})'s options are the names it reads, at most 16, lower case — not ${shown(options)}`);
  const read = clashes.map((x, k) => {
    const w = `${what} (${name})'s clashes[${k}]`;
    if (!x || typeof x !== 'object') refuse(`${w} is {column, name, fix} — not ${shown(x)}`);
    const col = stored(x, 'column', `${w}'s column`), nm = stored(x, 'name', `${w}'s name`), fix = stored(x, 'fix', `${w}'s fix`);
    if (!ISO_STYLE_COLUMNS.includes(col) || typeof nm !== 'string' || typeof fix !== 'string' || !fix.trim() || fix.length > 200) refuse(`${w} is {column, name, fix}: a column, a choice's name and the fix in words (at most 200 letters) — not ${shown([col, nm, fix])}`);
    return Object.freeze({ column: col, name: nm, fix });
  });
  return Object.freeze({ column, name, apply, check, options: Object.freeze([...options]), clashes: Object.freeze(read) });
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
  for (const k of keys) if (!ISO_STYLE_COLUMNS.includes(k)) refuse(`a style's columns are ${ISO_STYLE_COLUMNS.join(', ')} — not ${shown(k)}`);
  const find = (column, name) => {
    const c = all.find((x) => x.column === column && x.name === name);
    if (!c) refuse(`the style's ${column} has no choice ${shown(name)} — the ${column} choices are ${all.filter((x) => x.column === column).map((x) => `"${x.name}"`).join(', ') || 'none yet'}`);
    return c;
  };
  const out = {}, options = {}, picked = {};
  for (const column of ISO_STYLE_COLUMNS) {
    const written = row ? stored(row, column, `the style's ${column}`) : undefined;
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
    for (const x of c.clashes) if (inRow(x.column, x.name)) refuse(`the style's ${c.column} "${c.name}" cannot sit with ${x.column} "${x.name}" — ${x.fix}`);
  }
  const style = Object.freeze({ row: Object.freeze(out), options: Object.freeze(options) });
  chosen.set(style, picked);
  return style;
}

function checkOptions(choice, options, column) {
  for (const key of Object.keys(options)) if (!choice.options.includes(key)) refuse(`the style's ${column} "${choice.name}" takes ${choice.options.length ? choice.options.join(', ') : 'no options'} — not ${shown(key)}`);
  // the values, once, before anything is drawn: the choice's own check (what it throws comes out as it is)
  if (choice.check) choice.check(Object.freeze({ ...options }));
}

/** Numbers from 0 to 1, the same for the same seed (FNV-1a of the text, then mulberry32). */
function seeded(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The piece as a style reads it, checked: {name, kind, at, size}. */
function readPiece(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) refuse(`paintPiece takes a piece {name, kind, at, size} — not ${shown(p)}`);
  const name = own(p, 'name'), kind = own(p, 'kind') ?? 'block', at = own(p, 'at'), size = own(p, 'size');
  if (typeof name !== 'string' || !name || name.length > 64) refuse(`a piece's name is 1 to 64 letters (its paint items carry it) — not ${shown(name)}`);
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

/**
 * A piece's paint list, by a style: {box, centre, outline, items}, frozen. `grid` is the map's (`isometric(...)`); `colours` the base
 * and the ink, or none (each item then carries its recipe and no colour, and a page's CSS colours it by role).
 */
export function paintPiece(style, piece, grid, colours = undefined) {
  const picked = chosen.get(style);
  if (!picked) refuse(`paintPiece takes a style isoStyle made — not ${shown(style)}`);
  const p = readPiece(piece), cs = readColours(colours);
  if (!grid || typeof grid !== 'object' || !['block', 'cylinder', 'floor'].every((k) => typeof grid[k] === 'function')) refuse(`paintPiece draws on a map's grid (isometric(...)) — not ${shown(grid)}`);
  const seedOf = JSON.stringify([style.row, style.options, p.name]);
  const context = (column, options, k = 0) => Object.freeze({ piece: p, colours: cs, options: options ?? Object.freeze({}), random: seeded(`${seedOf}|${column}|${k}`) });
  const shape = picked.shape, made = shape.apply(Object.freeze({ piece: p, grid }), context('shape', style.options.shape));
  const who = (c) => `the style's ${c.column} "${c.name}"`;
  if (!made || typeof made !== 'object') refuse(`${who(shape)} gives back {box, items} — not ${shown(made)}`);
  // what a tool reads of the shape besides its items: the box round it, where its name stands, the outline round it
  const box = stored(made, 'box', `${who(shape)}'s box`), centre = stored(made, 'centre', `${who(shape)}'s centre`), outline = stored(made, 'outline', `${who(shape)}'s outline`);
  if (!box || typeof box !== 'object') refuse(`${who(shape)} gives back a box {x, y, w, h} round what it draws — not ${shown(box)}`);
  for (const k of ['x', 'y', 'w', 'h']) { const v = stored(box, k, `${who(shape)}'s box ${k}`); if (!finite(v) || ('wh'.includes(k) && v < 0)) refuse(`${who(shape)}'s box ${k} is a finite number${'wh'.includes(k) ? ', from 0' : ''} — not ${shown(v)}`); }
  const pt = (p, what) => {
    const xy = Array.isArray(p) && p.length === 2 ? ownEntries(p, `${who(shape)}'s ${what}`) : null;   // by index: a getter never runs
    if (!(xy && finite(xy[0]) && finite(xy[1]))) refuse(`${who(shape)}'s ${what} is a point [x, y], finite numbers — not ${shown(p)}`);
    return Object.freeze(xy);
  };
  if (!Array.isArray(outline) || outline.length < 3 || outline.length > MOST_PAINT_POINTS) refuse(`${who(shape)} gives back its outline, 3 to ${MOST_PAINT_POINTS} points round what it draws — not ${shown(outline)}`);
  const round = Object.freeze(ownEntries(outline, `${who(shape)}'s outline`).map((q) => pt(q, 'outline point')));
  let items = checkPaint(own(made, 'items'), who(shape), p.name);
  for (const column of ['shading', 'line', 'palette', 'texture']) items = checkPaint(picked[column].apply(items, context(column, style.options[column])), who(picked[column]), p.name);
  picked.effects.forEach((c, k) => { items = checkPaint(c.apply(items, context('effects', style.options.effects?.[k], k)), who(c), p.name); });
  return Object.freeze({ box: Object.freeze({ x: box.x, y: box.y, w: box.w, h: box.h }), centre: pt(centre, 'centre'), outline: round, items });
}
