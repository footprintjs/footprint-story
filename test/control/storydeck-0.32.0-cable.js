// storydeck deck/cable.js at fc9e4ca (0.32.0), lines 17 and 23–58 (its import, CLEAR/CORNER, layRoutes, reachOf); the import points at ../deckDoor.js.
import {hairpins, routes, CABLE, MOST_ROUTES, NO_ROUTE} from '../deckDoor.js';
const {clear: CLEAR, corner: CORNER} = CABLE;

/**
 * The wires of a map, laid along the floor: tiles in, tiles out — nothing of a slide yet. `links`: one entry a wire,
 * [from, to] by piece name, or null for a wire that is not laid; `solids`: every block and cylinder of the map, each
 * {name, at: [col, row, lift], size: [wide, deep, high], kind} — those that share a name too: a wire cannot end at one
 * of them, and must still go round it. Gives, in the same order, null for a wire that was not asked (or an end that
 * is not the one piece of its name), and else {route, lift}: `route` what the kit says of it (its points in tiles,
 * its feet, its bends, what it passes behind — or `why` it has none), `lift` the height of the floor it lies on.
 *
 * The kit knows each piece by a number of ours, not by its name: two pieces may share a name, and a name may be any
 * text a deck holds (the kit keeps names to 200 characters, and would refuse the whole map for one).
 */
export function layRoutes(links, solids, keep = []) {
  const idOf = new Map(), twice = new Set();
  solids.forEach(({name}, i) => { if (idOf.has(name)) twice.add(name); else idOf.set(name, String(i)); });
  for (const name of twice) idOf.delete(name);
  // an end is a piece's name, or {name, port}: a port of that piece
  const nameOf = (end) => (typeof end === 'string' ? end : end.name), kitEnd = (end) => (typeof end === 'string' || end.port === null ? idOf.get(nameOf(end)) : {thing: idOf.get(end.name), port: end.port});
  const asked = links.map((link, i) => (link && idOf.has(nameOf(link[0])) && idOf.has(nameOf(link[1])) ? i : -1)).filter((i) => i >= 0);
  const laid = links.map(() => null);
  if (!asked.length) return laid;
  const things = solids.map(({at, size, kind, ports}, i) => ({name: String(i), at, size, round: kind === 'cylinder', ...(ports?.length ? {ports} : {})}));
  const first = asked.slice(0, MOST_ROUTES);   // the kit lays so many
  // floor kept clear (keepClear.js): a cost to the kit, never a wall; asked only when a map keeps some, so every other map lays as before
  const found = routes(things, first.map((i) => links[i].map(kitEnd)), keep.length ? {keep: keep.map(({at, size, name}) => ({at, size, name}))} : undefined);
  const liftOf = (end) => solids[Number(idOf.get(nameOf(end)))].at[2] ?? 0;
  // the kit's words, with the deck's names back in them
  first.forEach((i, k) => { laid[i] = {route: {...found[k], from: nameOf(links[i][0]), to: nameOf(links[i][1]), ...(found[k].behind && {behind: found[k].behind.map((id) => solids[Number(id)].name)}), ...(found[k].under && {under: [...new Set(found[k].under.map((id) => keep.find((stretch) => stretch.name === id)?.piece ?? String(id)))]})}, lift: liftOf(links[i][0])}; });
  // a wire past what the kit lays stays the straight wire it was, and says why
  for (const i of asked.slice(MOST_ROUTES)) laid[i] = {route: {from: nameOf(links[i][0]), to: nameOf(links[i][1]), points: null, why: NO_ROUTE.work}, lift: liftOf(links[i][0])};
  return laid;
}

/** The floor points laid routes reach, [[col, row, lift], …]: what the floor and the picture are fitted to beside the blocks. */
export const reachOf = (laid) => laid.flatMap((entry) => (entry?.route.points ? (entry.route.path ?? entry.route.points.map(([col, row]) => [col, row, entry.lift])).map(([col, row, height]) => [col, row, height ?? entry.lift]) : []));
