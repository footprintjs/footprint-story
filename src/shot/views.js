/**
 * The camera words: where it stands, how big the subject is, which lens. A view is a place round the subject and a height.
 * The camera stands at the named side: `front` is on the scene's +z side looking towards -z, with +x to the right of the
 * frame, so `left` stands on the -x side. The shares and lenses are starting choices, not measurements.
 */
import { deepFreeze, orRefuse, readAll } from './fields.js';

const DEG = Math.PI / 180, SAME = 1e-9;
const table = (entries) => deepFreeze(Object.assign(Object.create(null), entries));

/** Where the camera stands round the subject, in degrees. */
export const ROUNDS = table({ front: 0, 'front-right': 45, right: 90, 'back-right': 135, back: 180, 'back-left': -135, left: -90, 'front-left': -45 });
/** How high it stands, in degrees. */
export const HEIGHTS = table({ high: 30, level: 0, low: -30 });
/** How much of the frame's height the subject fills, by size word. */
export const SIZES = table({ wide: 0.2, medium: 0.4, close: 0.7, insert: 0.95 });
/** A lens as a share of the frame's height: `normal` sees about 44 degrees top to bottom. */
export const LENSES = table({ wide: 0.8, normal: 1.25, long: 2.2 });

const FORMS = "a named view such as 'front-left high': one of the eight round the subject, one of high, level, low, or both";

/** Reads a view into `f`. Degrees are the room left in this shape: a later {azimuth, elevation} comes in under the same `from`. */
export function viewFrom(v, f, at) {
  if (typeof v !== 'string') return f.say(at, `must be ${FORMS}; degrees are not read yet`);
  const parts = v.length <= 32 ? v.split(' ') : [], round = parts.find((p) => p in ROUNDS), height = parts.find((p) => p in HEIGHTS);
  if (!parts.length || parts.length > 2 || parts.length !== (round ? 1 : 0) + (height ? 1 : 0)) return f.say(at, `must be ${FORMS}`);
  const name = `${round ?? 'front'} ${height ?? 'level'}`;
  return deepFreeze({ name, azimuth: ROUNDS[round ?? 'front'] * DEG, elevation: HEIGHTS[height ?? 'level'] * DEG });
}

/** A named view: frozen {name, azimuth, elevation}, the angles in radians as a camera holds them. Throws, naming the words. */
export const readView = (from) => orRefuse(readAll((f) => viewFrom(from, f, 'from')), 'view');

/** The named view nearest a camera's angles, and whether the camera stands exactly there. */
export function viewOf(azimuth, elevation) {
  const c = Math.cos(elevation), az = Math.atan2(c * Math.sin(azimuth), c * Math.cos(azimuth)) / DEG, el = Math.asin(Math.sin(elevation)) / DEG;
  const nearest = (names, wanted, gap) => names.reduce((a, b) => (gap(b, wanted) < gap(a, wanted) ? b : a));
  const round = nearest(Object.keys(ROUNDS), az, (n, w) => { const d = Math.abs(ROUNDS[n] - w) % 360; return Math.min(d, 360 - d); });
  const height = nearest(Object.keys(HEIGHTS), el, (n, w) => Math.abs(HEIGHTS[n] - w));
  const off = Math.abs(ROUNDS[round] - az) % 360;
  return { name: `${round} ${height}`, exact: Math.min(off, 360 - off) < SAME && Math.abs(HEIGHTS[height] - el) < SAME };
}

/** The size word nearest a share of the frame's height. */
export const sizeWord = (share) => Object.keys(SIZES).reduce((a, b) => (Math.abs(SIZES[b] - share) < Math.abs(SIZES[a] - share) ? b : a));

/** A lens's word, or the number when no word fits it. */
export const lensWord = (focal) => Object.keys(LENSES).find((n) => Math.abs(LENSES[n] - focal) < SAME) ?? Number(focal.toPrecision(3));

/** One word from a table of words, or null with a problem naming them. */
export function wordFrom(v, words, f, at, what) {
  if (typeof v === 'string' && Object.hasOwn(words, v)) return v;
  return f.say(at, `must be a ${what}: ${Object.keys(words).join(', ')}`);
}

