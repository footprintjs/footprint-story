/**
 * Framing a box: how far a view zooms so that a box fills a share of the room it is shown in.
 *
 *   frameZoom([400, 200], [1600, 900], { share: 0.7, least: 1, most: 2.5 })   → 2.5   (0.7 × 4 = 2.8, held at 2.5)
 *
 * The box is scaled until it touches the room on one side — the smaller of room ÷ box across and up (it is "contained",
 * never cropped) — then by `share`, then held between `least` and `most`: zoom = max(least, min(most, share ×
 * min(roomW ÷ boxW, roomH ÷ boxH))). `smallest`, when given, is the least size a box side counts as (a point or a line
 * has no size to fill, so a deck counts it 1 px wide); left out, the box is taken as it is. A room's sides are the
 * caller's: a caller that must not divide by an empty room gives it at least a pixel itself.
 *
 * WHY here: StoryDeck's three cameras (zoom, fit, and the room a mover leaves) each wrote this rule, and StoryReel's
 * focus and its pushes framed a named thing by it too (as share ÷ the larger of box ÷ room, the same rule in another
 * order); one rule, so a deck and a film close in alike. WHY these exact operations, in this order: StoryDeck rounds a
 * view to 4 places, so an answer that differs in its last bit can round the other way (0.21875 and
 * 0.21874999999999997 round to 0.2188 and 0.2187) — the order is the one the deck's pages were built with. StoryReel
 * 0.34.0 took it as it is: its zoom moved in the last bit, which changed no frame.
 *
 * Numbers in, numbers out: any number is taken as IEEE arithmetic answers it (a NaN in is a NaN out, as a writer's
 * unchecked option always gave); a caller that must refuse a value checks it first. Anything that is not a number is
 * refused, and the options are read by their own stored fields.
 */

const own = (o, key) => { const d = Object.getOwnPropertyDescriptor(o, key); return d && 'value' in d ? d.value : undefined; };
function refuse(fix) { throw new Error(`layout: ${fix}`); }
const shown = (v) => (Array.isArray(v) ? 'a list' : v === null ? 'null' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? JSON.stringify(v.slice(0, 40)) : String(v));

/** Two numbers [wide, high], each index its own stored value. */
function pair(v, what) {
  const n = Array.isArray(v) && v.length === 2 ? [Object.hasOwn(v, 0) ? own(v, 0) : undefined, Object.hasOwn(v, 1) ? own(v, 1) : undefined] : null;
  if (!n || !n.every((k) => typeof k === 'number')) refuse(`${what} is [wide, high], two numbers — not ${shown(v)}`);
  return n;
}

/** The zoom at which a box of `size` fills `share` of `room`, held between `least` and `most` (see the module's header). */
export function frameZoom(size, room, options = undefined) {
  const [w, h] = pair(size, 'the box'), [rw, rh] = pair(room, 'the room');
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`frameZoom takes its options as {share, least, most, smallest}, or none — not ${shown(options)}`);
  const given = (key, usual) => {
    const d = options ? Object.getOwnPropertyDescriptor(options, key) : undefined;
    if (d && !('value' in d)) refuse(`frameZoom's ${key} is read as a stored value, and this one is a getter (code, never run) — give the number itself`);
    const v = d?.value;
    if (v !== undefined && typeof v !== 'number') refuse(`frameZoom's ${key} is a number — not ${shown(v)}`);
    return v ?? usual;
  };
  const share = given('share', 1), least = given('least', 0), most = given('most', Infinity), smallest = given('smallest', undefined);
  const bw = smallest === undefined ? w : Math.max(w, smallest), bh = smallest === undefined ? h : Math.max(h, smallest);
  return Math.max(least, Math.min(most, share * Math.min(rw / bw, rh / bh)));
}
