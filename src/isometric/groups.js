/**
 * Groups: things that belong together (an account, a team, a tier), each group on a floor of its own. Each group's
 * things are placed together (`arrange`, on the links inside the group), then the groups are placed as one thing each,
 * from the links between them, the same way: the flow reads left to right across the frame, group by group, and no
 * number is typed.
 *
 *   arrangeByGroup([{name: 'web', size: [2, 2, 1], group: 'front'}, …], [['web', 'api'], …])   → [[col, row, 0], …]
 *
 * WHY arrange twice and not a rule of our own: a group is a thing to the arrangement — a box as big as its things and
 * their floor — so the rule that places things from what joins them places groups the same way, and a deck and a film
 * place them alike. It came from StoryDeck 0.27.0 (deck/groups.js), unchanged in what it gives for what that gave it
 * (a property test against a copy of that code, test/control/); what is new is that every value is checked.
 */
import { arrange } from './arrange.js';
import { MOST_ISOMETRIC_THINGS } from './order.js';
import { numbers, own, refuse, shown, stored } from './thing.js';

/** Tiles a group's floor reaches past its things on every side: a tool that fits each group's floor fits it so. */
export const GROUP_MARGIN = 1;
/** The longest name a group has. */
const MOST_GROUP = 100;
/** What stands for "no group" among the groups: no group's key can be it (a group's key starts "g:"). */
const LOOSE = '\u0001';

/** The things, read by their own stored fields: {name, size, group} — `group` null for a thing in no group. */
function readMembers(things) {
  if (!Array.isArray(things)) refuse(`arrangeByGroup takes a list of things, [{name, size: [wide, deep, high], group?}] — not ${shown(things)}`);
  if (things.length > MOST_ISOMETRIC_THINGS) refuse(`arrangeByGroup places at most ${MOST_ISOMETRIC_THINGS} things, not ${things.length}`);
  const names = new Set();
  return Array.from({ length: things.length }, (_, i) => {
    const thing = Object.hasOwn(things, i) ? own(things, i) : undefined;
    if (!thing || typeof thing !== 'object' || Array.isArray(thing)) refuse(`thing ${i + 1} is {name, size: [wide, deep, high], group?} — not ${shown(thing)}`);
    const name = own(thing, 'name'), group = stored(thing, 'group', `thing ${i + 1}'s group`) ?? null;
    if (typeof name !== 'string' || !name) refuse(`thing ${i + 1} has a name, some text — not ${shown(name)}`);
    if (names.has(name)) refuse(`two things are named ${shown(name)}: a name tells one thing from another, and links say it`);
    names.add(name);
    if (group !== null && (typeof group !== 'string' || !group || group.length > MOST_GROUP)) refuse(`${shown(name)}'s group is a name, some text of 1 to ${MOST_GROUP} characters, or null for none — not ${shown(group)}`);
    return { name, size: numbers(own(thing, 'size'), [3], `${shown(name)}'s size`, '[wide, deep, high], in tiles'), group };
  });
}

/** The links, read by their own stored values: [[from, to], …], each a pair of names. */
function readPairs(links) {
  if (links === undefined || links === null) return [];
  if (!Array.isArray(links)) refuse(`arrangeByGroup takes a list of links, [[from, to], …] by name — not ${shown(links)}`);
  return Array.from({ length: links.length }, (_, i) => {
    const link = Object.hasOwn(links, i) ? own(links, i) : undefined, pair = Array.isArray(link) && link.length === 2 ? [own(link, 0), own(link, 1)] : null;
    if (!pair || typeof pair[0] !== 'string' || typeof pair[1] !== 'string') refuse(`link ${i + 1} is [from, to], the names of two things — not ${shown(link)}`);
    return pair;
  });
}

/**
 * Where each thing stands when things are placed by group: `things` [{name, size, group}] in order (`group` a name, or
 * null or left out for none), `links` [[from, to]] by name. Gives [[col, row, 0], …] in the order of `things`. Things
 * with no group are a group of their own. Every group is arranged on the links inside it; then the groups — each a
 * thing as big as its things and its floor (GROUP_MARGIN tiles all round, and half a tile more, so two floors fitted
 * round them keep a clear tile between) — on the links between them. Across the frame, both times (`arrange` ·
 * `across`). A link to a name that is no thing here is left out; what `arrange` refuses comes out as it is.
 */
export function arrangeByGroup(things, links = []) {
  const solid = readMembers(things), pairs = readPairs(links);
  const keyOf = (p) => (p.group === null ? '' : `g:${p.group}`), keys = [...new Set(solid.map(keyOf))];
  const groupOfName = new Map(solid.map((p) => [p.name, keyOf(p)]));
  // each group's own links, in the order given (one pass, however many groups)
  const inside = new Map(keys.map((key) => [key, []]));
  for (const [a, b] of pairs) { const ga = groupOfName.get(a); if (ga !== undefined && ga === groupOfName.get(b)) inside.get(ga).push([a, b]); }
  const local = keys.map((key) => {
    const members = solid.filter((p) => keyOf(p) === key);
    const placed = arrange(members.map((p) => ({ name: p.name, size: p.size })), inside.get(key), { across: true });
    return { key, members, placed, high: Math.max(...members.map((p) => p.size[2] ?? 0)) };
  });
  // the groups as things: as big as their things and their floor's margin all round, and a tile more each way — a
  // group may stand on half tiles, and a floor fitted round it reaches to the next whole tile (up to half a tile on
  // each side), so the extra tile keeps a clear tile between two floors. arrange's own gaps (by the tallest thing)
  // stand between the groups, so a tall group does not hide the one behind it.
  const pad = GROUP_MARGIN + 0.5;
  // the links between groups, each pair once, in the order first met
  const between = new Map();
  for (const [a, b] of pairs) {
    const ga = groupOfName.get(a), gb = groupOfName.get(b);
    if (ga === undefined || gb === undefined || ga === gb) continue;
    const id = JSON.stringify([ga, gb]);
    if (!between.has(id)) between.set(id, [ga || LOOSE, gb || LOOSE]);
  }
  const groups = arrange(local.map(({ key, placed, high }) => ({ name: key || LOOSE, size: [placed.cols + 2 * pad, placed.rows + 2 * pad, high] })), [...between.values()], { across: true });
  const at = new Array(solid.length);
  local.forEach(({ members, placed }, g) => {
    const [gc, gr] = groups.things[g].at;
    members.forEach((p, i) => { const [c, r] = placed.things[i].at; at[solid.indexOf(p)] = [gc + pad + c, gr + pad + r, 0]; });
  });
  return at;
}
