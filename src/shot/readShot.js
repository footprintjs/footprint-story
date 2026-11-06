/**
 * A shot as data: who it is on, where the camera stands, what is sharp, how big, which lens. A film's list writes the
 * subject as `shot`, a deck's click as `on`: the same word's two places. The moving words (`at`, `until`, `seconds`, `ease`,
 * `feel`) belong to whichever tool flies the shot, so they may stand here and this reads nothing from them.
 */
import { deepFreeze, orRefuse, readAll } from './fields.js';
import { sceneFrom, namesFrom } from './scene.js';
import { LENSES, SIZES, viewFrom, wordFrom } from './views.js';

const FIELDS = ['shot', 'on', 'from', 'focus', 'size', 'lens', 'at', 'until', 'seconds', 'ease', 'feel'];

/** Reads a shot into `f` against a read scene; null when it has a problem. */
export function shotFrom(raw, scene, f, at = '') {
  const here = (key) => (at ? `${at}.${key}` : key), own = f.object(raw, at, FIELDS);
  if (!own) return null;
  const before = f.problems.length;
  if (own.shot !== undefined && own.on !== undefined) f.say(here('shot'), 'and on both name the subject: keep one');
  const on = own.on ?? own.shot;
  const names = on === undefined ? f.say(here('on'), 'must name the thing the shot is on') : namesFrom(on, scene, f, here(own.on === undefined ? 'shot' : 'on'));
  const view = own.from === undefined ? f.say(here('from'), "must say where the camera stands, such as 'front-left high'") : viewFrom(own.from, f, here('from'));
  const shot = { on: names, from: view?.name, size: own.size === undefined ? 'medium' : wordFrom(own.size, SIZES, f, here('size'), 'size'), lens: own.lens === undefined ? 'normal' : wordFrom(own.lens, LENSES, f, here('lens'), 'lens') };
  if (own.focus !== undefined) shot.focus = own.focus === 'all' ? 'all' : namesFrom(own.focus, scene, f, here('focus'))?.[0];
  if (Array.isArray(own.focus)) f.say(here('focus'), "must name one thing, or be 'all'");
  return f.problems.length > before ? null : shot;
}

const reading = (raw, scene) => readAll((f) => {
  const read = sceneFrom(scene, f, 'scene');
  return read ? shotFrom(raw, read, f) : null;
});

/** Every problem in a shot on a scene, [{at, message}]; [] when it can be read. Never throws on what it is given. */
export const shotProblems = (raw, scene) => reading(raw, scene).problems;
/** A shot read: frozen {on: [names], from, size, lens, focus?}. Reading its own answer gives the same answer. Throws, listing all its problems. */
export const readShot = (raw, scene) => deepFreeze(orRefuse(reading(raw, scene), 'shot'));
