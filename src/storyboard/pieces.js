/**
 * Which piece of a storyboard each problem belongs to. A problem's `at` is the place in the data, and its head names the piece:
 * `checked[1].sources` is the entry `checked[1]`. A list at fault as a whole (`checked has 7`) takes its entries with it, so no
 * two pieces overlap. Any other top-level field is the frame. The board's shape, or text that is not JSON, is no piece at all.
 */
export const FRAME = 'frame';

const HEAD = /^([^.[]+)(?:\[(\d+)\])?/;
const WHOLE_BOARD = new Set(['', 'shape', 'storyboard']);

/** {pieces: [{piece, list, index, fields, problems}], rest}, pieces in the order their first problem came. `lists`: the shape's fields whose entries are pieces of their own. */
export function piecesAt(problems, lists) {
  const pieces = new Map(), rest = [];
  const listsAtFault = new Set(problems.map((p) => p.at).filter((at) => lists.includes(at)));
  for (const problem of problems) {
    if (WHOLE_BOARD.has(problem.at)) { rest.push(problem); continue; }
    const [, name = problem.at, entry] = HEAD.exec(problem.at) ?? [];
    const listed = lists.includes(name), index = listed && entry !== undefined && !listsAtFault.has(name) ? Number(entry) : null;
    const piece = !listed ? FRAME : index === null ? name : `${name}[${index}]`;
    if (!pieces.has(piece)) pieces.set(piece, { piece, list: listed ? name : null, index, fields: [], problems: [] });
    const held = pieces.get(piece);
    held.problems.push(problem);
    if (!listed && !held.fields.includes(name)) held.fields.push(name);
  }
  return { pieces: [...pieces.values()], rest };
}
