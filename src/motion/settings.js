/**
 * Settings, the one reader. A transition's settings (`enter.<name>`) — and anything else described the same way —
 * are written as {oneOf: [words]}, {point: true}, {color: true}, {number: [min, max]}, {box: true} or {name: true},
 * each with its default (a colour's may be null: whatever draws it picks one; a point's may be 'centre': the frame's
 * middle, whatever size the frame is). They are read here, each value checked against its kind and the defaults filled
 * in, and a bad one refuses with the same words wherever it is written.
 */

/** A hex colour: #rgb, #rrggbb or #rrggbbaa. */
export const isColor = (v) => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);

/** A box on the frame: [x0, y0, x1, y1], numbers, x0 < x1 and y0 < y1. */
export const isBox = (v) => Array.isArray(v) && v.length === 4 && v.every(Number.isFinite) && v[0] < v[2] && v[1] < v[3];

/** The setting kinds written as a flag ({point: true}); the others carry their choices or range. */
export const SETTING_FLAGS = Object.freeze(['point', 'color', 'box', 'name']);

/**
 * The settings `params` describes, read from `given` (the recipe's object), each checked against its kind, the defaults
 * filled in; frozen. A refusal names the setting as it is written, `<key>.<name>` (key: 'enter' for a transition), and
 * what it must be; `type` names what takes it (a "push"); `frame` is the frame's size, for the words of a refusal.
 */
export function readSettings(params, given, where, { key = 'enter', type = given?.type, frame = [1600, 900] } = {}) {
  const out = {};
  for (const [name, spec] of Object.entries(params)) {
    const fallback = spec.point && spec.default === 'centre' ? [frame[0] / 2, frame[1] / 2] : spec.default;
    const v = given[name] ?? fallback, bad = (what) => new Error(`${where}: ${key}.${name} must be ${what}`);
    if (spec.name && v === undefined) throw new Error(`${where}: a ${type} needs ${key}.${name}: the name of a thing in the picture (a kit names what it draws: regionsAt → {box, path, name})`);
    if (spec.name && v !== null && !(typeof v === 'string' && v.trim())) throw bad('the name of a thing in the picture');
    if (spec.oneOf && !spec.oneOf.includes(v)) throw bad(spec.oneOf.join(', '));
    if (spec.point && !(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))) throw bad('[x, y]');
    if (spec.color && !(v === null && spec.default === null) && !isColor(v)) throw bad('a hex colour such as "#000000"');
    if (spec.box && !isBox(v)) throw bad(`a box [x0, y0, x1, y1] on the ${frame[0]}×${frame[1]} frame, with x0 < x1 and y0 < y1`);
    if (spec.number && !(typeof v === 'number' && v >= spec.number[0] && v <= spec.number[1])) throw bad(`a number ${spec.number[0]}–${spec.number[1]}`);
    out[name] = Array.isArray(v) ? Object.freeze([...v]) : v;
  }
  return Object.freeze(out);
}
