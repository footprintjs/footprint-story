// The isometric grid: numbers only. Its picture is checked against a parallel camera built here from first principles
// (an independent oracle), its faces against each other, and its drawing order against the one thing that matters: a
// thing that can cover another is drawn after it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { isometric, readThing, backToFront, MOST_ISOMETRIC_THINGS } from '../isometric.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const samePoint = (p, q) => near(p.x, q.x) && near(p.y, q.y);

/** A parallel camera 45° round and asin(h / w) up, looking at the floor's far corner: the oracle. */
function camera(w, h, [ox, oy]) {
  const el = Math.asin(h / w), scale = w / Math.SQRT2;
  const right = [Math.SQRT1_2, 0, -Math.SQRT1_2], up = [-Math.sin(el) * Math.SQRT1_2, Math.cos(el), -Math.sin(el) * Math.SQRT1_2];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (col, row, height) => ({ x: ox + scale * dot([col, height, row], right), y: oy - scale * dot([col, height, row], up) });
}

const coord = fc.double({ min: -50, max: 50, noNaN: true });

test('a tile is twice as wide as tall, col runs down-right, row down-left, height up', () => {
  const grid = isometric({ tile: 120, origin: [960, 240] });
  assert.deepEqual(grid.tile, [120, 60]);
  assert.deepEqual(grid.at(0, 0), { x: 960, y: 240 });
  assert.deepEqual(grid.at(1, 0), { x: 1020, y: 270 });
  assert.deepEqual(grid.at(0, 1), { x: 900, y: 270 });
  assert.ok(near(grid.at(0, 0, 1).y, 240 - grid.rise));
  assert.ok(Object.isFrozen(grid));
  assert.deepEqual(isometric().origin, [0, 0]);
  assert.equal(isometric({ rise: 50 }).rise, 50);
  assert.deepEqual(isometric({ tile: [100, 40] }).tile, [100, 40]);
});

test('a tile as wide as √3 times its height is the true isometric: all three edges of a cube are as long as each other', () => {
  const grid = isometric({ tile: [120, 120 / Math.sqrt(3)] }), o = grid.at(0, 0), col = grid.at(1, 0), row = grid.at(0, 1);
  const along = (p) => Math.hypot(p.x - o.x, p.y - o.y);
  assert.ok(near(along(col), grid.rise) && near(along(row), grid.rise));
  const usual = isometric({ tile: 120 });
  assert.ok(usual.rise > Math.hypot(60, 30), 'from lower down, the edge that stands up looks the longest');
});

test('property: the grid is the picture a parallel camera takes from that corner, so a cube looks like a cube', () => {
  fc.assert(fc.property(fc.double({ min: 20, max: 400, noNaN: true }), fc.double({ min: 0.2, max: 0.9, noNaN: true }), coord, coord, coord, coord, coord, (w, flat, ox, oy, col, row, height) => {
    const h = w * flat, grid = isometric({ tile: [w, h], origin: [ox, oy] }), eye = camera(w, h, [ox, oy]);
    const got = grid.at(col, row, height), want = eye(col, row, height);
    assert.ok(Math.abs(got.x - want.x) < 1e-6 && Math.abs(got.y - want.y) < 1e-6, `${JSON.stringify(got)} is not ${JSON.stringify(want)}`);
  }), { numRuns: 300 });
});

test('property: tileAt is the way back from at, on the floor', () => {
  fc.assert(fc.property(coord, coord, (col, row) => {
    const grid = isometric({ tile: 96, origin: [300, -40] }), p = grid.at(col, row), back = grid.tileAt(p.x, p.y);
    assert.ok(Math.abs(back.col - col) < 1e-9 && Math.abs(back.row - row) < 1e-9);
  }), { numRuns: 200 });
});

test('a block: three faces that share their edges, an outline round them, a box that holds them', () => {
  const grid = isometric({ tile: 120, origin: [960, 240] }), b = grid.block({ at: [2, 1], size: [2, 2, 1.5] });
  const [far, east, front, west] = b.top;
  assert.ok(samePoint(far, grid.at(2, 1, 1.5)) && samePoint(east, grid.at(4, 1, 1.5)) && samePoint(front, grid.at(4, 3, 1.5)) && samePoint(west, grid.at(2, 3, 1.5)));
  assert.ok(samePoint(b.left[0], west) && samePoint(b.left[1], front), 'the left face hangs from the top\'s lower-left edge');
  assert.ok(samePoint(b.right[0], front) && samePoint(b.right[1], east), 'the right face hangs from the top\'s lower-right edge');
  assert.ok(samePoint(b.left[2], b.right[3]) && samePoint(b.left[2], grid.at(4, 3, 0)), 'the two sides meet on the near edge, down to the floor');
  assert.equal(b.outline.length, 6);
  assert.ok(samePoint(b.centre, grid.at(3, 2, 1.5)));
  for (const p of [...b.top, ...b.left, ...b.right]) assert.ok(p.x >= b.box.x - 1e-9 && p.x <= b.box.x + b.box.w + 1e-9 && p.y >= b.box.y - 1e-9 && p.y <= b.box.y + b.box.h + 1e-9);
  assert.ok(near(b.box.w, 240) && near(b.box.x, 900));
  const lifted = grid.block({ at: [2, 1, 1], size: [2, 2, 1.5] });
  assert.ok(near(lifted.box.y, b.box.y - grid.rise) && near(lifted.box.h, b.box.h));
  const flat = grid.block({ at: [0, 0], size: [1, 1, 0] });
  assert.ok(samePoint(flat.left[0], flat.left[3]), 'a block of no height is its top');
});

test('property: a cylinder\'s ellipses are where the camera sees its round top and foot', () => {
  fc.assert(fc.property(fc.double({ min: 0.5, max: 6, noNaN: true }), fc.double({ min: 0, max: 5, noNaN: true }), coord, coord, fc.double({ min: 0, max: 6.28, noNaN: true }), (wide, high, col, row, angle) => {
    const grid = isometric({ tile: 120, origin: [0, 0] }), c = grid.cylinder({ at: [col, row], size: [wide, wide, high] });
    const on = (e, height) => {
      const p = grid.at(col + wide / 2 + wide / 2 * Math.cos(angle), row + wide / 2 + wide / 2 * Math.sin(angle), height);
      return ((p.x - e.cx) / e.rx) ** 2 + ((p.y - e.cy) / e.ry) ** 2;
    };
    assert.ok(Math.abs(on(c.top, high) - 1) < 1e-6 && Math.abs(on(c.bottom, 0) - 1) < 1e-6);
    assert.ok(near(c.box.h, c.bottom.cy - c.top.cy + 2 * c.top.ry) && near(c.box.w, 2 * c.top.rx) && samePoint(c.centre, { x: c.top.cx, y: c.top.cy }));
  }), { numRuns: 200 });
});

test('a floor: every tile line once, its four corners, its box', () => {
  const grid = isometric({ tile: 120, origin: [960, 240] }), f = grid.floor({ cols: 3, rows: 2 });
  assert.equal(f.lines.length, 4 + 3);
  assert.deepEqual(f.lines[0], [960, 240, 840, 300]);          // col 0, along the rows
  assert.deepEqual(f.lines[4], [960, 240, 1140, 330]);         // row 0, along the cols
  assert.deepEqual(f.outline, [grid.at(0, 0), grid.at(3, 0), grid.at(3, 2), grid.at(0, 2)]);
  assert.deepEqual(f.box, { x: 840, y: 240, w: 300, h: 150 });
  assert.deepEqual(grid.floor({ cols: 1, rows: 1, at: [2, 2] }).outline[0], grid.at(2, 2));
});

test('a route runs along the floor and turns once', () => {
  const grid = isometric({ tile: 120, origin: [960, 240] });
  assert.deepEqual(grid.route([0, 3], [3, 1]), [grid.at(0, 3), grid.at(3, 3), grid.at(3, 1)]);
  assert.deepEqual(grid.route([0, 3], [3, 1], { first: 'row' }), [grid.at(0, 3), grid.at(0, 1), grid.at(3, 1)]);
  assert.deepEqual(grid.route([0, 3], [4, 3]), [grid.at(0, 3), grid.at(4, 3)]);
  assert.deepEqual(grid.route([2, 0], [2, 5]), [grid.at(2, 0), grid.at(2, 5)]);
  assert.deepEqual(grid.route([0, 3, 1], [3, 1]), [grid.at(0, 3, 1), grid.at(3, 3, 1), grid.at(3, 1, 1)]);
});

test('every refusal says what to give', () => {
  const grid = isometric();
  const refused = (run, message) => assert.throws(run, (e) => { assert.match(e.message, /^isometric: /); assert.match(e.message, message); return true; });
  refused(() => isometric({ tile: 0 }), /a tile is wider than it is tall, both above 0/);
  refused(() => isometric({ tile: [60, 60] }), /a tile is wider than it is tall/);
  refused(() => isometric({ tile: [60] }), /tile is a tile's width in pixels/);
  refused(() => isometric({ tile: 'big' }), /tile is a tile's width/);
  refused(() => isometric({ tile: NaN }), /a tile is wider than it is tall/);
  refused(() => isometric({ origin: [1] }), /origin is \[x, y\]/);
  refused(() => isometric({ origin: [1, Infinity] }), /origin is \[x, y\]/);
  refused(() => isometric({ rise: 0 }), /rise is a unit of height in pixels, above 0 — not 0/);
  refused(() => grid.at(1, 'a'), /at\(col, row, height\?\) takes numbers/);
  refused(() => grid.at(1, 2, 1e9), /takes numbers/);
  refused(() => grid.tileAt(1), /tileAt\(x, y\) takes a place on the frame/);
  refused(() => grid.block(), /a block is \{at: \[col, row, lift\?\], size: \[wide, deep, high\]\}/);
  refused(() => grid.block([1, 2]), /a block is \{at/);
  refused(() => grid.block({ size: [1, 1, 1] }), /a block's at is \[col, row\] on the floor/);
  refused(() => grid.block({ at: [1], size: [1, 1, 1] }), /a block's at is/);
  refused(() => grid.block({ at: [0, 0], size: [1, 1] }), /a block's size is \[wide, deep, high\], in tiles/);
  refused(() => grid.block({ at: [0, 0], size: [0, 1, 1] }), /wide and deep above 0 and high 0 or more/);
  refused(() => grid.block({ at: [0, 0], size: [1, 1, -1] }), /high 0 or more/);
  refused(() => grid.block(Object.create({ at: [0, 0], size: [1, 1, 1] })), /a block's at is/);   // own fields only
  refused(() => grid.cylinder({ at: [0, 0], size: [2, 1, 1] }), /a cylinder is round: give it the same width and depth/);
  refused(() => grid.cylinder({ at: [0, 0] }), /a cylinder's size/);
  refused(() => grid.floor(), /a floor is cols × rows tiles, whole numbers from 1 to 256/);
  refused(() => grid.floor({ cols: 1.5, rows: 2 }), /whole numbers/);
  refused(() => grid.floor({ cols: 257, rows: 2 }), /from 1 to 256/);
  refused(() => grid.floor({ cols: 2, rows: 2, at: [1] }), /a floor's at is \[col, row\]/);
  refused(() => grid.route([0], [1, 1]), /a route's start is \[col, row\]/);
  refused(() => grid.route([0, 0], 'there'), /a route's end is/);
  refused(() => grid.route([0, 0], [1, 1], { first: 'up' }), /along the cols first or the rows first/);
  assert.deepEqual(readThing({ at: [1, 2], size: [1, 1, 1] }), { at: [1, 2, 0], size: [1, 1, 1] });
  refused(() => readThing(null), /a thing is \{at/);
});

test('back to front: what can cover another is drawn after it', () => {
  const things = [{ n: 'front', at: [2, 2], size: [1, 1, 1] }, { n: 'back', at: [0, 0], size: [1, 1, 1] }, { n: 'on', at: [0, 0, 1], size: [1, 1, 1] }, { n: 'side', at: [0, 3], size: [1, 1, 1] }];
  const order = backToFront(things).map((t) => t.n);
  for (const [first, then] of [['back', 'front'], ['back', 'on'], ['back', 'side']]) assert.ok(order.indexOf(first) < order.indexOf(then), `${first} before ${then} in ${order}`);
  assert.deepEqual(backToFront([]), []);
  assert.deepEqual(backToFront([{ box: { at: [1, 1], size: [1, 1, 1] } }, { box: { at: [0, 0], size: [1, 1, 1] } }], (t) => t.box).map((t) => t.box.at), [[0, 0], [1, 1]]);
  assert.deepEqual(backToFront([{ id: 1, at: [5, 0], size: [1, 1, 1] }, { id: 2, at: [0, 5], size: [1, 1, 1] }]).map((t) => t.id), [1, 2], 'no order between them: as given');
});

test('back to front: a ring of long boxes, each behind the next, still gives every thing once, the first given first', () => {
  // a behind b (below it), b behind c (smaller cols), c behind a (smaller rows): no order satisfies all three
  const a = { n: 'a', at: [0, 2, 0], size: [3, 1, 1] }, b = { n: 'b', at: [0, 0, 1], size: [1, 3, 1] }, c = { n: 'c', at: [1, 0, 0], size: [1, 2, 3] };
  const out = backToFront([a, b, c]);
  assert.deepEqual(out.map((t) => t.n).sort(), ['a', 'b', 'c']);
  assert.equal(out[0].n, 'a');
});

test('back to front: refusals', () => {
  assert.throws(() => backToFront('things'), /backToFront takes a list of things/);
  assert.throws(() => backToFront(Array.from({ length: MOST_ISOMETRIC_THINGS + 1 }, () => ({ at: [0, 0], size: [1, 1, 1] }))), /at most 256 things, not 257/);
  assert.throws(() => backToFront([], 'box'), /takes a function that gives an item's \{at, size\}/);
  assert.throws(() => backToFront([{ at: [0, 0], size: [1, 1, 1] }, {}]), /thing 2's at is/);
});

test('property: unit cubes on whole tiles come out so no cube is drawn before one it can cover', () => {
  const cube = fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 3 }));
  fc.assert(fc.property(fc.uniqueArray(cube, { maxLength: 40, selector: (c) => c.join(',') }), (cubes) => {
    const things = cubes.map((at) => ({ at, size: [1, 1, 1] })), out = backToFront(things);
    assert.equal(out.length, things.length);
    assert.equal(new Set(out).size, things.length);
    // a covers b only from nearer the viewer: no smaller col, row or lift, and not the same place
    const covers = (a, b) => a.at.every((v, i) => v >= b.at[i]) && a.at.some((v, i) => v > b.at[i]);
    out.forEach((later, j) => out.slice(0, j).forEach((earlier) => assert.ok(!covers(earlier, later), `${earlier.at} is drawn before ${later.at}, which it covers`)));
  }), { numRuns: 200 });
});

// ── the README's picture and example ────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const n = (v) => String(Math.round(v * 10) / 10);
const points = (list) => list.map((p) => `${n(p.x)},${n(p.y)}`).join(' ');

/** The picture in src/isometric/README.md, drawn from the grid's numbers: a floor, three things, a line along the floor. */
function examplePicture() {
  const grid = isometric({ tile: 96, origin: [330, 70] });
  const things = [
    { kind: 'block', name: 'server', at: [3, 1], size: [2, 2, 1.4], faces: ['#dbe8f8', '#b9d0ee', '#a3c0e6'] },
    { kind: 'block', name: 'you', at: [0, 3], size: [2, 2, 0.3], faces: ['#f3ecdf', '#ddd2bf', '#cfc2ab'] },
    { kind: 'cylinder', name: 'data', at: [6, 0], size: [1.6, 1.6, 1.2], faces: ['#e6dcf5', '#c9b8e8', '#c9b8e8'] },
  ];
  const floor = grid.floor({ cols: 8, rows: 5 }), wire = grid.route([2, 4], [4, 3], { first: 'col' });
  const drawn = backToFront(things).map((t) => {
    if (t.kind === 'cylinder') {
      const c = grid.cylinder(t), { top, bottom } = c;
      return `<path d="M${n(top.cx - top.rx)},${n(top.cy)} L${n(bottom.cx - bottom.rx)},${n(bottom.cy)} A${n(bottom.rx)},${n(bottom.ry)} 0 0 0 ${n(bottom.cx + bottom.rx)},${n(bottom.cy)} L${n(top.cx + top.rx)},${n(top.cy)} Z" fill="${t.faces[1]}"/>`
        + `<ellipse cx="${n(top.cx)}" cy="${n(top.cy)}" rx="${n(top.rx)}" ry="${n(top.ry)}" fill="${t.faces[0]}"/><text x="${n(c.centre.x)}" y="${n(c.centre.y + 5)}">${t.name}</text>`;
    }
    const b = grid.block(t);
    return `<polygon points="${points(b.left)}" fill="${t.faces[1]}"/><polygon points="${points(b.right)}" fill="${t.faces[2]}"/><polygon points="${points(b.top)}" fill="${t.faces[0]}"/><text x="${n(b.centre.x)}" y="${n(b.centre.y + 5)}">${t.name}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 400" width="760" height="400" font-family="ui-monospace, monospace" font-size="15" text-anchor="middle" stroke="#1f2430" stroke-width="1.5" stroke-linejoin="round">\n`
    + `<rect width="760" height="400" fill="#faf6ee" stroke="none"/>\n`
    + `<g stroke="#d9cfbd" stroke-width="1">${floor.lines.map(([x1, y1, x2, y2]) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`).join('')}</g>\n`
    + `<polyline points="${points(wire)}" fill="none" stroke-width="3"/>\n`
    + `<g>${drawn.join('</g>\n<g>')}</g>\n`
    + `<text x="${n(grid.at(8.4, 0).x)}" y="${n(grid.at(8.4, 0).y)}">col →</text><text x="${n(grid.at(0, 5.5).x)}" y="${n(grid.at(0, 5.5).y)}">← row</text>\n</svg>\n`;
  return svg.replaceAll('<text ', '<text stroke="none" fill="#1f2430" ');
}

test('the picture in the isometric README is what the grid draws today', () => {
  const file = fileURLToPath(new URL('../src/isometric/example.svg', import.meta.url)), picture = examplePicture();
  if (process.env.WRITE_EXAMPLE) writeFileSync(file, picture);
  assert.equal(readFileSync(file, 'utf8'), picture, 'run WRITE_EXAMPLE=1 node --test test/isometric.test.js to draw it again');
});

test('the README example runs as written', () => {
  const grid = isometric({ tile: 120, origin: [960, 240] });
  assert.deepEqual(grid.at(2, 1), { x: 1020, y: 330 });
  const server = { at: [2, 1], size: [2, 2, 1.5] }, faces = grid.block(server);
  assert.deepEqual(faces.box, { x: 900, y: 219.77296157475698, w: 240, h: 230.22703842524302 });
  assert.deepEqual(backToFront([{ name: 'front', at: [4, 4], size: [1, 1, 1] }, { name: 'server', ...server }]).map((t) => t.name), ['server', 'front']);
});
