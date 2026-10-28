/**
 * Transitions: how one picture becomes the next. This is the collection a video editor keeps (Premiere's Video
 * Transitions, Final Cut's Transitions browser), as DATA: each one has a family, a default length, an ease, a sound
 * name and a few settings, chosen by name at the change of picture —
 *
 *   "enter": "push"                                         the default settings
 *   "enter": {"type": "push", "from": "left", "seconds": 0.5, "ease": "out", "sound": "whoosh"}
 *
 *   family     transitions
 *   cut        cut                 the new picture, whole, at once
 *   dissolve   fade · dip          a cross-fade; a dip through a colour (black by default)
 *   wipe       wipe · split · clock an edge crosses the frame; doors open from the middle; a clock hand sweeps
 *   iris       iris                a circle opens from a point
 *   motion     push · slide · whip the new picture pushes the old out; slides over it; a fast push that streaks
 *   zoom       zoom                the old picture rushes forward and fades while the new one settles
 *   page       page                the old picture is a page that lifts and turns over
 *   match      through · match     through a thing in the old picture (a window, a screen) into the new one;
 *                                  a thing in the old picture becomes the same thing in the new one
 *
 * Nothing here draws. What draws is an adapter: StoryReel paints every one of these on a canvas (and adds its own
 * paper ones); css.mjs turns the ones a web page can do into keyframes (CSS_TRANSITIONS says which). A drawer adds its
 * own by `extendTransitions`, checked the same way. Points (`at`) are on the frame the change is drawn on; a point's
 * default 'centre' is that frame's middle, whatever its size.
 */
import { easeNamed, overshoots } from './ease.js';
import { readSettings, SETTING_FLAGS } from './settings.js';

export const DIRECTIONS = Object.freeze(['left', 'right', 'top', 'bottom']);
const side = (fallback) => ({ oneOf: DIRECTIONS, default: fallback });
const centre = { point: true, default: 'centre' };

function deepFreeze(v) { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; }

/** The shared collection, by family. A transition: {family, seconds, ease, sound (a name, or null), overshoot?, params, regions?}. */
export const TRANSITIONS = deepFreeze({
  cut: { family: 'cut', seconds: 0, ease: 'jump', sound: null, params: {} },
  fade: { family: 'dissolve', seconds: .8, ease: 'inOut', sound: null, params: {} },
  dip: { family: 'dissolve', seconds: 1, ease: 'inOut', sound: null, params: { color: { color: true, default: '#000000' } } },
  wipe: { family: 'wipe', seconds: .8, ease: 'inOut', sound: 'slide', params: { from: side('left') } },
  split: { family: 'wipe', seconds: .8, ease: 'inOut', sound: 'slide', params: { line: { oneOf: ['vertical', 'horizontal'], default: 'vertical' } } },
  clock: { family: 'wipe', seconds: .9, ease: 'inOut', sound: 'slide', params: {} },
  iris: { family: 'iris', seconds: .8, ease: 'inOut', sound: 'slide', params: { at: centre } },
  push: { family: 'motion', seconds: .7, ease: 'inOut', sound: 'slide', params: { from: side('right') } },
  slide: { family: 'motion', seconds: .7, ease: 'out', sound: 'slide', overshoot: true, params: { from: side('right') } },
  whip: { family: 'motion', seconds: .4, ease: 'inOut', sound: 'whoosh', params: { from: side('right') } },
  zoom: { family: 'zoom', seconds: .6, ease: 'inOut', sound: 'whoosh', params: { at: centre } },
  page: { family: 'page', seconds: 1.1, ease: 'inOut', sound: 'slide', params: {} },
  through: { family: 'match', seconds: 1.2, ease: 'inOut', sound: 'whoosh', params: { region: { name: true }, shape: { oneOf: ['box', 'round'], default: 'box' } }, regions: (p) => ({ from: [p.region] }) },
  match: { family: 'match', seconds: 1, ease: 'inOut', sound: null, params: { region: { name: true }, into: { name: true, default: null } }, regions: (p) => ({ from: [p.region], to: [p.into ?? p.region] }) },
});
export const TRANSITION_NAMES = Object.freeze(Object.keys(TRANSITIONS));
export const FAMILIES = Object.freeze([...new Set(Object.values(TRANSITIONS).map((t) => t.family))]);

/** The keys every transition takes, besides its own settings. */
export const COMMON = Object.freeze(['type', 'seconds', 'ease', 'sound']);
/** How long a change of picture may take, in seconds: the one range. */
export const SECONDS = Object.freeze([.2, 4]);
const inRange = (s) => typeof s === 'number' && s >= SECONDS[0] && s <= SECONDS[1];
/** The names no setting may take: every transition's own keys, and `move` (an entrance by a move is not a transition). */
export const RESERVED = Object.freeze([...COMMON, 'move']);
const DEF_KEYS = ['family', 'seconds', 'ease', 'sound', 'hitAt', 'overshoot', 'params', 'regions'];
const KINDS = ['oneOf', 'point', 'color', 'number', 'box', 'name'];

/**
 * A transition as a drawer defines one, checked: {family, seconds, ease, sound, hitAt?, overshoot?, params?, regions?}
 * plus the keys the drawer itself asks for (`extra`: StoryReel's `draw`). A sound is null or a name; which names
 * exist is the drawer's to say. Returns a frozen copy with params filled in ({} when left out).
 */
export function checkTransition(def, who, { extra = [] } = {}) {
  if (!def || typeof def !== 'object' || Array.isArray(def)) throw new Error(`${who} must be {family, seconds, ease, sound, params?${extra.map((k) => `, ${k}`).join('')}}`);
  const keys = [...DEF_KEYS, ...extra];
  for (const key of Object.keys(def)) if (!keys.includes(key)) throw new Error(`${who} has unsupported key ${key} (a transition has ${keys.join(', ')})`);
  if (typeof def.family !== 'string' || !def.family.trim()) throw new Error(`${who} needs a family (e.g. "wipe"; a browser groups by it)`);
  if (!inRange(def.seconds)) throw new Error(`${who}: seconds must be between ${SECONDS[0]} and ${SECONDS[1]}`);
  easeNamed(def.ease, `${who}: ease`);
  if (def.sound !== null && !(typeof def.sound === 'string' && def.sound.trim())) throw new Error(`${who}: sound must be null or a sound's name`);
  if (def.hitAt !== undefined && !(typeof def.hitAt === 'number' && def.hitAt >= 0 && def.hitAt < 1)) throw new Error(`${who}: hitAt is where in the change its sound hits, the e its draw reaches it at, from 0 (its first moment, the default) to below 1 (e.g. 0.3 for a pop three tenths of the way in)`);
  if (def.overshoot !== undefined && typeof def.overshoot !== 'boolean') throw new Error(`${who}: overshoot must be true or false`);
  if (def.regions !== undefined && typeof def.regions !== 'function') throw new Error(`${who}: regions must be p => ({from?: [names], to?: [names]}): the things it looks for in the picture it leaves and the one it arrives at`);
  if (def.regions === undefined && Object.values(def.params ?? {}).some((spec) => spec?.name)) throw new Error(`${who} has a setting that names a thing in the picture, and no regions(p) to look it up: add regions: p => ({from: [p.yourSetting]}) (or to: …)`);
  const params = def.params ?? {};
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error(`${who}: params must be {name: {oneOf | point | color | number | box, default}}`);
  for (const [name, spec] of Object.entries(params)) {
    if (RESERVED.includes(name)) throw new Error(`${who}: a setting may not be called "${name}" (${name === 'move' ? 'an entrance that names a move is a move entrance' : 'every entrance has it'})`);
    const kinds = KINDS.filter((k) => spec?.[k] !== undefined);
    if (kinds.length !== 1 || (SETTING_FLAGS.includes(kinds[0]) && spec[kinds[0]] !== true) || !(spec.name === true || 'default' in spec)) throw new Error(`${who}: the setting "${name}" must be one of {oneOf: [...]}, {point: true}, {color: true}, {number: [min, max]}, {box: true}, with a default (a colour's may be null: your draw picks one, e.g. the theme's; a point's may be 'centre'); or {name: true} (a thing in the picture; default: null when it may be left out)`);
    if (spec.oneOf && !(Array.isArray(spec.oneOf) && spec.oneOf.length && spec.oneOf.every((v) => typeof v === 'string'))) throw new Error(`${who}: the setting "${name}" lists its choices as words`);
    if (spec.number && !(Array.isArray(spec.number) && spec.number.length === 2 && spec.number.every(Number.isFinite) && spec.number[0] < spec.number[1])) throw new Error(`${who}: the setting "${name}" gives number as [min, max]`);
    if (!(spec.name && spec.default === undefined)) readSettings({ [name]: spec }, { type: 'transition' }, who);   // the default must pass its own check
  }
  return Object.freeze({ ...def, params });
}

/**
 * A collection with a drawer's own transitions added: {...base, ...yours}, each of yours checked. Yours may not take a
 * name the base has. `extra`: the keys your drawer's definitions carry besides the shared ones (StoryReel: ['draw']).
 */
export function extendTransitions(base, yours, { who = 'a transition', extra = [] } = {}) {
  const out = { ...base };
  for (const [name, def] of Object.entries(yours)) {
    if (Object.hasOwn(base, name)) throw new Error(`${who} "${name}" has a name the collection already has; name it something else (taken: ${Object.keys(base).join(', ')})`);
    if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) throw new Error(`${who} "${name}": a transition's name is one word in camelCase (e.g. "swirl", "inkBleed")`);
    out[name] = checkTransition(def, `${who} "${name}"`, { extra });
  }
  return Object.freeze(out);
}

/**
 * A change of picture as it is asked for — a transition's name, or {type, seconds?, ease?, sound?, …its settings} —
 * checked against `catalog` (the shared one by default) and read: {type, family, seconds, ease (the curve's name or
 * CSS cubic-bezier text), sound, p (the settings, defaults filled in)}. `sound` is false (none: null), left out (the
 * transition's own) or whatever was given, for the drawer to check against its sounds. A cut takes nothing else.
 * `frame` is the frame's size (a point's 'centre'); `more` is added to the refusal of an unknown type, naming any
 * other shape the caller takes.
 */
export function readTransition(enter, where, { catalog = TRANSITIONS, frame = [1600, 900], more = '' } = {}) {
  const e = typeof enter === 'string' ? { type: enter } : enter;
  if (!e || typeof e !== 'object' || Array.isArray(e) || typeof e.type !== 'string' || !Object.hasOwn(catalog, e.type)) {
    const named = typeof e === 'object' && e && typeof e.type === 'string' ? ` (not "${e.type}")` : '';
    throw new Error(`${where}: enter must be a transition: ${Object.keys(catalog).join(', ')}${named}${more}`);
  }
  const tr = catalog[e.type], params = tr.params ?? {};
  if (e.type === 'cut') {
    if (Object.keys(e).length > 1) throw new Error(`${where}: a cut takes no seconds and no centre`);
    return Object.freeze({ type: 'cut', family: 'cut', seconds: 0, ease: 'jump', sound: null, p: Object.freeze({}) });
  }
  const allowed = [...COMMON, ...Object.keys(params)];
  for (const key of Object.keys(e)) if (!allowed.includes(key)) throw new Error(`${where}: enter has unsupported key ${key} (a ${e.type} takes ${allowed.slice(1).join(', ')})`);
  const seconds = e.seconds ?? tr.seconds;
  if (!inRange(seconds)) throw new Error(`${where}: enter.seconds must be between ${SECONDS[0]} and ${SECONDS[1]}`);
  const ease = e.ease ?? tr.ease;
  easeNamed(ease, `${where}: enter.ease`);
  if (overshoots(ease) && !tr.overshoot) throw new Error(`${where}: a ${e.type} cannot take the ease "${ease}" (it goes past the end, and the frame's edge would show); ${Object.entries(catalog).filter(([, t]) => t.overshoot).map(([n]) => n).join(', ')} can`);
  const sound = e.sound === false ? null : e.sound === undefined ? tr.sound : e.sound;
  const p = readSettings(params, e, where, { frame });
  return Object.freeze({ type: e.type, family: tr.family, seconds, ease, sound, p });
}
