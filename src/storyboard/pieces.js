/**
 * Which piece of a storyboard each problem belongs to. A problem's `at` is the place in the data, and its head names the piece:
 * `checked[1].sources` is the entry `checked[1]`. A list at fault as a whole (`checked has 7`) takes its entries with it, so no
 * two pieces overlap. Any other top-level field is the frame, and so is a key the board itself wrote, even one spelt like a
 * place (`"checked[0]": 1`). The board's shape, or text that is not JSON, is no piece at all.
 */
export const FRAME = 'frame';

const HEAD = /^([^.[]+)(?:\[(0|[1-9]\d{0,3})\](?=$|[.[])|(?=$|\.))/;   // a whole name, or a whole entry: `checked[9e999]` is neither

const noPiece = (at, keys) => at === '' || at === 'shape' || (at === 'storyboard' && !keys.has(at));

/**
 * {pieces: [{piece, list, index, fields, problems}], rest}, pieces in the order their first problem came. `lists`: the shape's
 * fields whose entries are pieces of their own. `keys`: the board's top-level keys, as a problem would show them.
 */
export function piecesAt(problems, lists, keys) {
  const pieces = new Map(), rest = [];
  const listsAtFault = new Set(problems.map((p) => p.at).filter((at) => lists.includes(at)));
  for (const problem of problems) {
    const { at } = problem;
    if (noPiece(at, keys)) { rest.push(problem); continue; }
    const written = keys.has(at) && !lists.includes(at), [, head, entry] = (written ? null : HEAD.exec(at)) ?? [];
    const name = head ?? at, listed = lists.includes(name), index = listed && entry !== undefined && !listsAtFault.has(name) ? Number(entry) : null;
    const piece = !listed ? FRAME : index === null ? name : `${name}[${index}]`;
    if (!pieces.has(piece)) pieces.set(piece, { piece, list: listed ? name : null, index, fields: [], problems: [] });
    const held = pieces.get(piece);
    held.problems.push(problem);
    if (!listed && !held.fields.includes(name)) held.fields.push(name);
  }
  return { pieces: [...pieces.values()], rest };
}
