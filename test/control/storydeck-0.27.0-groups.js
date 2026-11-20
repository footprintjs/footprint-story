/** Tiles a group's floor reaches past its blocks on every side (iso.js fits a floor so). */
export const GROUP_MARGIN = 1;

/** A piece's group as its tag writes it (data-iso-group), or null. Throws, naming the piece and the fix. */
export function groupWritten(attrs, told) {
  const a = ownAttribute(attrs, 'data-iso-group');
  if (!a) return null;
  if (a.bare || a.twice) throw new Error(`${told}: its group is written data-iso-group="name", once, with quotes`);
  const name = a.value.trim();
  if (!NAME.test(name)) throw new Error(`${told}: a group's name is 1 to 60 letters, digits, "-" or "_" — not "${name.slice(0, 40)}${name.length > 40 ? '…' : ''}"`);
  return name;
}

/**
 * Where each block stands when the build places them by group: `solid` the map's blocks and cylinders in order
 * ({name, size, group}), `links` [[from, to]] by name, `arrange` footprint-story's. Gives [[col, row, 0], …] in the
 * order of `solid`. Blocks with no group are a group of their own. Every group is arranged on the wires inside it;
 * then the groups, each a thing as big as its blocks and its floor, on the wires between them.
 */
export function arrangeByGroup(solid, links, arrange) {
  const keyOf = (p) => (p.group === null ? '' : `g:${p.group}`), keys = [...new Set(solid.map(keyOf))];
  const groupOfName = new Map(solid.map((p) => [p.name, keyOf(p)]));
  const local = keys.map((key) => {
    const members = solid.filter((p) => keyOf(p) === key), names = new Set(members.map((p) => p.name));
    const placed = arrange(members.map((p) => ({name: p.name, size: p.size})), links.filter(([a, b]) => names.has(a) && names.has(b)), {across: true});
    return {key, members, placed, high: Math.max(...members.map((p) => p.size[2] ?? 0))};
  });
  // the groups as things: as big as their blocks and their floor's margin all round, and a tile more each way — a
  // group may stand on half tiles, and a floor fitted round it reaches to the next whole tile (up to half a tile on
  // each side), so the extra tile keeps a clear tile between two floors. arrange's own gaps (by the tallest thing)
  // stand between the groups, so a tall group does not hide the one behind it.
  const pad = GROUP_MARGIN + 0.5;
  const between = [...new Set(links.map(([a, b]) => [groupOfName.get(a), groupOfName.get(b)]).filter(([a, b]) => a !== undefined && b !== undefined && a !== b).map((pair) => pair.join('\u0000')))].map((pair) => pair.split('\u0000'));
  const groups = arrange(local.map(({key, placed, high}) => ({name: key || '\u0001', size: [placed.cols + 2 * pad, placed.rows + 2 * pad, high]})), between.map((pair) => pair.map((key) => key || '\u0001')), {across: true});
  const at = new Map();
  local.forEach(({members, placed}, g) => {
    const [gc, gr] = groups.things[g].at;
    members.forEach((p, i) => { const [c, r] = placed.things[i].at; at.set(p, [gc + pad + c, gr + pad + r, 0]); });
  });
  return solid.map((p) => at.get(p));
}
