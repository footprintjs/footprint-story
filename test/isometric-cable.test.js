// A cable on the frame (isometric/cable.js, outline.js, straight.js): its numbers, a label's plate and place, a way
// walked, an outline's edge, a straight wire's lanes, ends, bend, curve and head. Moved in 0.19.0 from StoryDeck 0.29.0
// and StoryReel 0.34.0 (each had a copy; test/cable-differential.property.test.js holds the door to both): these are
// the worked cases and the refusals, which are new — every value is read by its own stored value, a getter is never run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CABLE, LABEL_PLACES, cableLead, cableWay, stopShort, MOST_HIDES, MOST_OUTLINE, MOST_WIRES, arrowHead, bentWire, curveWay, exitBox, exitOutline, headingOf, held, isometric, labelHalf, labelPlace, lanesOf, rounded, roundOutline, straightRun, walkWay } from '../isometric.js';
import { onStops, seenAt, seenTerms } from '../motion.js';

const getter = (o, key, value) => Object.defineProperty(o, key, { get: () => value, enumerable: true });
const square = (left, right) => held([[left, -50], [right, -50], [right, 50], [left, 50]]);

test('the numbers are frozen, and the places run out from the middle by turns', () => {
  assert.ok(Object.isFrozen(CABLE) && Object.isFrozen(CABLE.label) && Object.isFrozen(LABEL_PLACES));
  assert.deepEqual(LABEL_PLACES, [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8]);
  assert.deepEqual(labelHalf(5), [34, 13]);
  assert.deepEqual(labelHalf(0), [4, 13]);
  for (const bad of [-1, NaN, Infinity, '5', null]) assert.throws(() => labelHalf(bad), /^Error: isometric: labelHalf takes how many letters a label shows, a number from 0/);
});

test('walkWay: a point each 6 px at most, never more than 512 runs, from a share to a share', () => {
  const way = rounded([[0, 0], [300, 0]]);
  assert.equal(walkWay(way).length, 51);
  assert.deepEqual(walkWay(way, 0.5, 1).at(0), [150, 0]);
  assert.equal(walkWay(rounded([[0, 0], [9e5, 0]])).length, CABLE.walkMost + 1);
  assert.throws(() => walkWay(way, -0.1), /walkWay's from is a share of the way, 0 to 1 — not -0\.1/);
  assert.throws(() => walkWay(way, 0, '1'), /walkWay's to is a share of the way/);
  assert.throws(() => walkWay({ at: 1, length: 3 }), /walkWay's way is a way, as rounded\(\) gives one: its own at\(share\) and length/);
  assert.throws(() => walkWay([1, 2]), /walkWay's way is a way, as rounded\(\) gives one \(\{start, pieces, length, at\}\)/);
  assert.throws(() => walkWay(getter({ at: way.at }, 'length', 300)), /its own at\(share\) and length — not an object/);
});

test('held: the box round points, each point its own [x, y]', () => {
  assert.deepEqual(held([[3, 9], [-4, 2], [10, 5]]), { points: [[3, 9], [-4, 2], [10, 5]], left: -4, top: 2, right: 10, bottom: 9 });
  assert.deepEqual(held([]), { points: [], left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  assert.throws(() => held('x'), /held takes points, \[\[x, y\], …\] — not "x"/);
  assert.throws(() => held([[1, 2], [3]]), /point 2 of held is \[x, y\], two numbers — not \[3\]/);
  assert.throws(() => held([[1, 2], , [3, 4]]), /point 2 of held is \[x, y\], two numbers — not undefined/);   // eslint-disable-line no-sparse-arrays
  assert.throws(() => held([getter([0, 0], 0, 1)]), /point 1 of held is \[x, y\], two numbers/);
  assert.throws(() => held({ length: 5 }), /held takes points/);
  assert.throws(() => held(new Array(CABLE.walkMost * 64 + 1)), /held takes at most 32768 points — not 32769/);
});

test('labelPlace: the middle when nothing is in the way, the next place clear when something is, the least hidden when none is', () => {
  const run = rounded([[0, 0], [300, 0]]);
  assert.deepEqual(labelPlace(run, [30, 13], []), [150, 0]);
  assert.deepEqual(labelPlace(run, [30, 13], [square(110, 190)]), [75, 0]);
  assert.deepEqual(labelPlace(run, [30, 13], [square(-100, 235)]), [240, 0]);   // four fifths of the way: the least of it covered
  // another cable through the middle: passed over when it is this cable's own
  const own = { ...held(walkWay(run)), of: run }, across = { ...held(Array.from({ length: 41 }, (_, k) => [150, -100 + 5 * k])), of: rounded([[150, -100], [150, 100]]) };
  assert.deepEqual(labelPlace(run, [30, 13], [], [own]), [150, 0]);
  assert.notDeepEqual(labelPlace(run, [30, 13], [], [own, across]), [150, 0]);
  // the looks: each place spends its own; none left, the middle
  const looks = { left: CABLE.looks };
  labelPlace(run, [30, 13], [square(110, 190)], [], looks);
  assert.ok(looks.left < CABLE.looks);
  assert.deepEqual(labelPlace(run, [30, 13], [square(110, 190)], [], { left: 0 }), [150, 0]);
  assert.deepEqual(labelPlace(run, [30, 13], [square(110, 190)], [], { left: 1 }), [150, 0]);
});

test('labelPlace refuses what it cannot read, by name — and never runs a getter', () => {
  const run = rounded([[0, 0], [300, 0]]);
  assert.throws(() => labelPlace(null, [30, 13], []), /labelPlace's way is a way/);
  assert.throws(() => labelPlace(run, [30], []), /labelPlace's half \(labelHalf\) is \[x, y\], two numbers — not \[30\]/);
  assert.throws(() => labelPlace(run, [30, 13], 'x'), /labelPlace's hides is a list of points held \(held\(\)\) — not "x"/);
  assert.throws(() => labelPlace(run, [30, 13], [[1, 2]]), /labelPlace's hides\[0\] is points held, as held\(\) gives them \(\{points, left, top, right, bottom\}\) — not \[1,2\]/);
  assert.throws(() => labelPlace(run, [30, 13], [{ points: [], left: 0, top: 0, right: 1 }]), /labelPlace's hides\[0\] is points held, as held\(\) gives them: its own points and the four numbers of its box/);
  assert.throws(() => labelPlace(run, [30, 13], [], [null]), /labelPlace's runs\[0\] is points held/);
  assert.throws(() => labelPlace(run, [30, 13], [], [], 5), /labelPlace's looks is \{left\}, the looks the map has left — not 5/);
  assert.throws(() => labelPlace(run, [30, 13], [], [], getter({}, 'left', 5)), /labelPlace's looks\.left is read as a stored value, and this one is a getter/);
  assert.throws(() => labelPlace(run, [30, 13], [], [], { left: '5' }), /labelPlace's looks\.left is a finite number, the looks the map has left — not "5"/);
  // a plate or a count of looks that is no finite number would switch the map's shared budget off: refused
  for (const left of [NaN, Infinity, -Infinity]) assert.throws(() => labelPlace(run, [30, 13], [], [], { left }), /labelPlace's looks\.left is a finite number/);
  for (const half of [[NaN, 13], [30, Infinity], [-1, 13], [30, -0.5]]) assert.throws(() => labelPlace(run, half, [square(110, 190)]), /labelPlace's half \(labelHalf\) is \[wide, high\], two finite numbers from 0/);
  assert.throws(() => labelPlace(run, [30, 13], [], [], undefined, [1]), /labelPlace's tip is \[x, y\]/);
  assert.throws(() => labelPlace(run, [30, 13], new Array(MOST_HIDES + 1)), /labelPlace's hides is at most 1000000 entries/);
  // too few looks left to ask what is near: the middle, and no entry is read (a million unread entries cost nothing)
  const many = new Array(MOST_HIDES).fill(null), looks = { left: 10 }, t0 = performance.now();
  assert.deepEqual(labelPlace(run, [30, 13], many, [], looks), [150, 0]);
  assert.equal(looks.left, 10, 'no look spent');
  assert.ok(performance.now() - t0 < 100, 'unread');
  // a near outline's points are read when it is asked: a bad point there is refused, by its place
  const bad = { points: [[110, -50], [190, -50], [190], [110, 50]], left: 110, top: -50, right: 190, bottom: 50 };
  assert.throws(() => labelPlace(run, [30, 13], [bad]), /point 3 of labelPlace's hides\[0\] is \[x, y\], two numbers — not \[190\]/);
});

test('exitOutline and exitBox: how far a ray from inside runs before it leaves', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(exitOutline(sq, [5, 5], [1, 0]), 5);
  assert.equal(exitOutline(sq, [5, 0], [1, 0]), 5);   // along a side: it leaves by the next one
  assert.equal(exitOutline(sq, [20, 5], [1, 0]), Infinity);
  assert.equal(exitOutline([], [0, 0], [1, 0]), Infinity);
  assert.equal(exitBox({ x: 0, y: 0, w: 10, h: 10 }, [2, 5], [-1, 0]), 2);
  assert.equal(exitBox({ x: 0, y: 0, w: 10, h: 10 }, [2, 5], [0, 0]), Infinity);
  assert.throws(() => exitOutline('x', [0, 0], [1, 0]), /an outline is points on the frame/);
  assert.throws(() => exitOutline(new Array(MOST_OUTLINE + 1), [0, 0], [1, 0]), /an outline is at most 65536 points/);
  assert.throws(() => exitOutline(sq, [0], [1, 0]), /the ray's start is \[x, y\], two numbers/);
  assert.throws(() => exitOutline(sq, [0, 0], null), /the ray's way is \[x, y\]/);
  assert.throws(() => exitBox([0, 0, 1, 1], [0, 0], [1, 0]), /exitBox's box is a box \{x, y, w, h\} — not \[0,0,1,1\]/);
  assert.throws(() => exitBox({ x: 0, y: 0, w: 1 }, [0, 0], [1, 0]), /exitBox's box is a box \{x, y, w, h\}, four numbers — not \[0,0,1,undefined\]/);
});

test('roundOutline: a cylinder\'s outline, the upper half of its top then the lower half of its foot', () => {
  const c = isometric({ tile: 120 }).cylinder({ at: [0, 0], size: [2, 2, 1] }), o = roundOutline(c.top, c.bottom);
  assert.equal(o.length, 26);
  assert.deepEqual(o[0], { x: c.top.cx - c.top.rx, y: c.top.cy + c.top.ry * Math.sin(Math.PI) });
  assert.equal(roundOutline(c.top, c.bottom, 2).length, 6);
  assert.throws(() => roundOutline(null, c.bottom), /roundOutline's top is an ellipse \{cx, cy, rx, ry\} \(grid\.cylinder's top or bottom\)/);
  assert.throws(() => roundOutline(c.top, { cx: 0, cy: 0, rx: 1 }), /roundOutline's bottom is an ellipse \{cx, cy, rx, ry\}, four numbers/);
  for (const steps of [0, 1.5, 2000, '12']) assert.throws(() => roundOutline(c.top, c.bottom, steps), /roundOutline draws each half in 1 to 1024 steps, a whole number/);
});

test('lanesOf: a pair\'s wires across its line, those running its own way first, each flipped that runs back', () => {
  const lanes = lanesOf([['a', 'b'], null, ['b', 'a'], ['a', 'b'], ['c', 'a']]);
  assert.deepEqual(lanes, [{ k: 0, count: 3, flip: false }, null, { k: 2, count: 3, flip: true }, { k: 1, count: 3, flip: false }, { k: 0, count: 1, flip: true }]);
  assert.deepEqual(lanesOf([]), []);
  assert.throws(() => lanesOf('ab'), /lanesOf takes one entry a wire, \[from, to\] or null — not "ab"/);
  assert.throws(() => lanesOf([['a', 1]]), /wire 1 of lanesOf is \[from, to\], two names, or null — not \["a",1\]/);
  assert.throws(() => lanesOf([undefined]), /wire 1 of lanesOf is \[from, to\], two names, or null/);
  assert.throws(() => lanesOf(new Array(MOST_WIRES + 1)), /lanesOf takes at most 65536 wires/);
});

test('straightRun: from 6 px off one edge to 6 px off the other, lanes apart, and the two cases it cannot draw', () => {
  const box = (x) => ({ middle: [x + 50, 50], box: { x, y: 0, w: 100, h: 100 } });
  assert.deepEqual(straightRun(box(0), box(300)), { start: [106, 50], end: [294, 50] });
  const outline = (x) => ({ middle: [x + 50, 50], outline: [[x, 0], [x + 100, 0], [x + 100, 100], [x, 100]] });
  assert.deepEqual(straightRun(outline(0), outline(300)), { start: [106, 50], end: [294, 50] });
  const [one, two] = [0, 1].map((k) => straightRun(box(0), box(300), { k, count: 2 }));
  assert.deepEqual([one.start[1], two.start[1]], [10, 90], 'two lanes, 80 px apart at most, inside both');
  assert.deepEqual(straightRun(box(0), box(0)), { why: 'middle' });
  assert.deepEqual(straightRun(box(0), box(105)), { why: 'close' });
  assert.throws(() => straightRun(null, box(0)), /straightRun's a is \{middle, outline\} or \{middle, box\}/);
  assert.throws(() => straightRun({ middle: [0] }, box(0)), /straightRun's a's middle is \[x, y\]/);
  assert.throws(() => straightRun({ middle: [0, 0] }, box(0)), /straightRun's a's box is a box \{x, y, w, h\}/);
  assert.throws(() => straightRun({ middle: [0, 0], outline: 'x' }, box(0)), /straightRun's a's outline is points on the frame/);
  assert.throws(() => straightRun(box(0), box(300), null), /straightRun's lane is \{k, count\} \(lanesOf\) — not null/);
  for (const lane of [{ k: 2, count: 2 }, { k: 0, count: 0 }, { k: -1, count: 1 }, { k: 0.5, count: 2 }]) assert.throws(() => straightRun(box(0), box(300), lane), /straightRun's lane is \{k, count\}: lane k \(from 0\) of count/);
});

test('bentWire, curveWay, headingOf, arrowHead: the bend, the curve as a way, the way it arrives, the head', () => {
  const b = bentWire([0, 0], [100, 0], 40, 14.4);
  assert.deepEqual(b.corner, [50, 40]);
  assert.ok(Math.abs(Math.hypot(b.tip[0] - 100, b.tip[1]) - 14.4) < 1e-9);
  assert.deepEqual(bentWire([0, 0], [100, 0]), { corner: [50, 0], tip: [100, 0], heading: [1, 0] });
  assert.deepEqual(bentWire([5, 5], [5, 5]).heading, [0, 0], 'a point onto itself: no NaN');
  assert.throws(() => bentWire([0, 0], [1, 1], '4'), /bentWire's bend and back are numbers of px — not \["4",0\]/);
  assert.throws(() => bentWire([0], [1, 1]), /bentWire's a is \[x, y\]/);
  const way = curveWay([0, 0], [50, 0], [100, 0]);
  assert.deepEqual(way.start, [0, 0]);
  assert.deepEqual(way.pieces, [{ corner: [50, 0], to: [100, 0] }]);
  assert.ok(Math.abs(way.length - 100) < 1e-9);
  assert.deepEqual(way.at(0.5), [50, 0]);
  assert.deepEqual(way.at(2), way.at(1), 'a share past the end is held at the end');
  assert.equal(curveWay([0, 0], [0, 0], [0, 0]).at(0.5)[0], 0, 'a curve of no length stands at its start');
  for (const runs of [0, 1.5, 5000]) assert.throws(() => curveWay([0, 0], [1, 1], [2, 2], runs), /curveWay walks a curve in 1 to 4096 runs/);
  assert.throws(() => curveWay([0, 0], 'c', [2, 2]), /point 2 of curveWay's a, c and e is \[x, y\], two numbers/);
  assert.deepEqual(headingOf([0, 0], [0, 10]), [0, 1]);
  assert.throws(() => headingOf([0, 0], null), /headingOf's to is \[x, y\]/);
  assert.deepEqual(arrowHead([100, 0], [1, 0], 10), [[100, 0], [90, 6], [90, -6]]);
  assert.equal(arrowHead([100, 0], [1, 0]).length, 3);
  assert.throws(() => arrowHead([100, 0], [1, 0], -1), /arrowHead's size is its length in px, 0 or more — not -1/);
  assert.throws(() => arrowHead([100], [1, 0]), /arrowHead's tip is \[x, y\]/);
});

test('onStops, seenTerms, seenAt: a value at a moment, and how much of a packet a block\'s ramps show', () => {
  assert.equal(onStops([[0, 0], [1, 1]], 0.25), 0.25);
  assert.equal(onStops([[0, 0], [1, 1]], -1), 0);
  assert.equal(onStops([[0, 0], [1, 1]], 2), 1);
  assert.equal(onStops([[0, 0], [0.5, 1], [0.5, 0.2], [1, 0.2]], 0.5), 1);
  assert.equal(onStops([[0, 0], [0.5, 0], [0.5, 0.8]], 0.6), 0.8);
  assert.throws(() => onStops([], 0.5), /ride: stops are \[\[time, value\], …\], 1 to 4096 of them — not a list of 0/);
  assert.throws(() => onStops([[0, 0], [1]], 0.5), /ride: stop 2 is \[time, value\], two finite numbers/);
  assert.throws(() => onStops([[0, 0]], '1'), /ride: a moment on stops is a number — not "1"/);
  assert.deepEqual(seenTerms([[0.2, 0.25, 0.5, 0.6], [0, 0, 1, 1]]), [[{ from: 0.2, to: 0.25, falling: true }, { from: 0.5, to: 0.6, falling: false }], []]);
  assert.equal(seenAt([], 0.3), 1);
  assert.equal(seenAt([[0.2, 0.3, 0.5, 0.6]], 0.4), 0);
  assert.equal(seenAt([[0.2, 0.3, 0.5, 0.6]], 0.25), 0.5);
  assert.equal(seenAt([[0, 0, 1, 1]], 0.1), 0);
  assert.throws(() => seenTerms([[0, 1, 2]]), /ride: ramp 1 is \[outFrom, outTo, backFrom, backTo\], four finite numbers/);
  assert.throws(() => seenTerms('x'), /ride: ramps are \[\[outFrom, outTo, backFrom, backTo\], …\] \(hiddenRamps\)/);
  assert.throws(() => seenTerms(new Array(4097)), /ride: ramps are at most 4096/);
  assert.throws(() => seenAt([], null), /ride: a share of the line is a number — not null/);
});

test('the README example runs as written', () => {
  const api = { middle: [300, 200], outline: [[240, 150], [360, 150], [360, 250], [240, 250]] };
  const db = { middle: [700, 260], box: { x: 640, y: 200, w: 120, h: 120 } };
  const [lane] = lanesOf([['api', 'db']]);
  assert.deepEqual(lane, { k: 0, count: 1, flip: false });
  const run = straightRun(api, db, lane);
  assert.ok(Math.abs(run.start[0] - 366) < 1 && Math.abs(run.end[0] - 634) < 1, `6 px off each edge: ${run.start} → ${run.end}`);
  const bend = bentWire(run.start, run.end, 24, CABLE.head * CABLE.headShort), line = curveWay(run.start, bend.corner, bend.tip);
  assert.equal(arrowHead(run.end, bend.heading).length, 3);
  assert.deepEqual(labelHalf('SQL'.length), [22, 13]);
  const at = labelPlace(line, labelHalf(3), [held(api.outline)], [], { left: CABLE.looks }, run.end);
  assert.deepEqual(at, line.at(0.5), 'nothing in its way: the middle');
});

test('cableWay: the tip pulled back for a head, corners rounded — and what it refuses', () => {
  const way = cableWay({ points: [[0, 0], [100, 0], [100, 100]], radius: 20 }, 10);
  assert.deepEqual(way.at(1), [100, 90]);
  assert.deepEqual(way.pieces[1].corner, [100, 0], 'its corner is rounded as rounded() rounds it');
  assert.deepEqual(cableWay({ points: [[0, 0], [200, 0], [200, 20]], radius: 30 }, CABLE.head * CABLE.headShort).at(1), [200, 5.6], 'the README\'s example');
  assert.deepEqual(cableWay({ points: [[0, 0], [100, 0]] }).at(1), [100, 0], 'no pull, no radius: the points as they are');
  assert.deepEqual(cableWay({ points: [[0, 0], [0.5, 0]] }, 10).at(1), [0.5, 0], 'a last run under 1 px is never pulled');
  assert.deepEqual(cableWay({ points: [[0, 0], [100, 0]] }, Infinity).at(1), [1, 0], 'at most to 1 px past the run\'s start');
  for (const bad of [null, [], 'a', 5]) assert.throws(() => cableWay(bad), /^Error: isometric: cableWay takes a cable, \{points, radius\}/);
  for (const bad of [undefined, [[0, 0]], 'ab']) assert.throws(() => cableWay({ points: bad }), /^Error: isometric: cableWay takes a cable whose points are a way of 2 to 4096 points/);
  for (const bad of [-1, NaN, '3', null]) assert.throws(() => cableWay({ points: [[0, 0], [9, 0]] }, bad), /^Error: isometric: cableWay pulls the cable's tip back a number of px, 0 or more/);
  assert.throws(() => cableWay({ points: [[0, 0], [9, NaN]] }), /the cable's last point/);
  assert.throws(() => cableWay({ points: [[0, 0], [0, 0]] }), /^Error: isometric: rounded takes a way that goes somewhere/);
  assert.throws(() => cableWay({ points: [[0, 0], [9, 0]], radius: null }), /^Error: isometric: rounded takes a radius of 0 or more/, 'a radius given is read as rounded reads it');
  const points = [[0, 0], [100, 0], [100, 100]];
  assert.deepEqual(stopShort(points, 10), [[0, 0], [100, 0], [100, 90]], 'stopShort: the points, the last pulled back');
  assert.deepEqual(points, [[0, 0], [100, 0], [100, 100]], 'a new list: the cable\'s own points are left as they were');
  for (const bad of [-1, NaN, '3']) assert.throws(() => stopShort(points, bad), /^Error: isometric: stopShort pulls the cable's tip back a number of px, 0 or more/);
  for (const bad of [null, [[0, 0]]]) assert.throws(() => stopShort(bad), /^Error: isometric: stopShort takes a cable's points, a way of 2 to 4096 points/);
  assert.throws(() => stopShort([undefined, [9, 0]]), /the point before the cable's last/);
  // the size is asked before any point is read: a sparse list of ten million is refused at once, never copied
  const huge = new Array(10_000_000); huge[0] = [0, 0]; huge[9_999_999] = [9, 0];
  let read = 0;
  const counted = new Proxy(huge, { get: (o, k) => { if (/^\d+$/.test(String(k))) read += 1; return o[k]; }, getOwnPropertyDescriptor: (o, k) => { if (/^\d+$/.test(String(k))) read += 1; return Reflect.getOwnPropertyDescriptor(o, k); } });
  assert.throws(() => stopShort(counted), /a way of 2 to 4096 points/);
  assert.throws(() => cableWay({ points: counted }), /a way of 2 to 4096 points/);
  assert.ok(read <= 32, `refused before the points are read: only the eight its message shows, each time (${read})`);
  assert.equal(stopShort(Array.from({ length: 4096 }, (_, k) => [k, 0]), 10).length, 4096, '4096 points, the most a way has, are taken');
  assert.throws(() => stopShort(getter([[0, 0], [9, 0]], 1, [9, 0])), /the cable's last point/, 'a point behind a getter is never read');
  // read by its own stored values: a getter is never run
  assert.throws(() => cableWay(getter({}, 'points', [[0, 0], [9, 0]])), /points are a way of 2 to 4096 points/);
});

test('cableLead: the lead from a port through its floor corner, its pieces and their length — and what it refuses', () => {
  // a port at [0, -40] above the floor, out of its side to [0, 0], along the floor to [100, 0], then on to [100, 100]
  const cable = { points: [[0, -40], [0, 0], [100, 0], [100, 100]], radius: 20 };
  const start = cableLead(cable, 0, 2);
  assert.deepEqual(start.pieces.map((p) => Boolean(p.corner)), [false, true], 'the run out of the port, then the floor corner');
  assert.ok(start.length > 40 && start.length < 40 + 20 + 20, `through the corner: ${start.length}`);
  const end = cableLead(cable, 1, 2, 10);
  assert.deepEqual(end.way.start, [100, 90], 'from the end, its tip pulled back for its head');
  assert.ok(Math.abs(end.length - (cableLead(cable, 1, 2).length - 10)) < 1e-9, 'the head\'s stretch is not the lead\'s');
  assert.equal(cableLead(cable, 0, 3).pieces.length, 4, 'a riser: two runs and two corners');
  for (const bad of [2, -1, '0', null]) assert.throws(() => cableLead(cable, bad, 2), /^Error: isometric: cableLead's end is 0 \(the cable's start\) or 1/);
  for (const bad of [1, 5, 2.5, '2']) assert.throws(() => cableLead(cable, 0, bad), /^Error: isometric: cableLead's count is how many of the cable's points its lead holds, a whole number from 2 to 4/);
  for (const bad of [-1, NaN]) assert.throws(() => cableLead(cable, 1, 2, bad), /^Error: isometric: cableLead pulls the tip back/);
  assert.throws(() => cableLead(null, 0, 2), /^Error: isometric: cableLead takes a cable, \{points, radius\}/);
  const huge = new Array(10_000_000); huge[0] = [0, 0]; huge[9_999_999] = [9, 0];
  assert.throws(() => cableLead({ points: huge }, 0, 2), /a way of 2 to 4096 points/, 'the size is asked before a point is read');
});
