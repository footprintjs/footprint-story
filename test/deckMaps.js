// A random StoryDeck map, written twice: as the deck's HTML (what StoryDeck 0.32.0's isoDrawn reads) and as
// buildIsoMap's spec (what StoryDeck hands the steps once it builds its maps here). The second is the adapter the
// deck's next pull request writes: its piece names, its floor at [0, 0] for a sized floor with none, its keep-clear
// stretches worked out from each box (deck/keepClear.js · keptFloor), its usual grid in numbers. Shared by
// deck-map-differential.property.test.js; not a test file itself.
import fc from 'fast-check';
import { isometric } from '../isometric.js';
import { keptFloor } from './control/storydeck-0.32.0-keepClear.js';
import { MOST_KEEP } from '../isometric.js';

const LABELS = ['Web', 'Load Balancer Service', 'API gateway', 'Database', 'a', 'Cache cluster primary node'];
const FLOOR_LABELS = ['Production account', 'VPC', 'The very long name of a shared services account'];
const half = (lo, hi) => fc.integer({ min: lo * 2, max: hi * 2 }).map((n) => n / 2);
const portsOf = (size, n) => [{ name: 'p1', at: [size[0], size[1] / 2, 0] }, { name: 'p2', at: [size[0] / 2, size[1], size[2] / 2] }].slice(0, n);

const blockArb = fc.record({
  kind: fc.constantFrom('block', 'block', 'cylinder'), sized: fc.boolean(),
  wide: half(1, 3), deep: half(1, 3), high: fc.constantFrom(0.5, 1, 1.6),
  at: fc.tuple(half(0, 12), half(0, 12), fc.constantFrom(null, 0, 0, 1)),
  label: fc.option(fc.constantFrom(...LABELS), { nil: null }), rule: fc.option(fc.constantFrom('even', 'fill'), { nil: null }),
  group: fc.option(fc.constantFrom('front', 'back'), { nil: null }), ports: fc.constantFrom(0, 0, 1, 2),
});
const floorArb = fc.record({
  given: fc.constantFrom('none', 'size', 'both'), at: fc.tuple(fc.integer({ min: -2, max: 6 }), fc.integer({ min: -2, max: 6 })), size: fc.tuple(fc.integer({ min: 1, max: 14 }), fc.integer({ min: 1, max: 14 })),
  label: fc.option(fc.constantFrom(...FLOOR_LABELS), { nil: null }), icon: fc.boolean(), group: fc.option(fc.constantFrom('front', 'back', 'spare'), { nil: null }),
});
const footArb = fc.record({ at: fc.tuple(fc.integer({ min: -2, max: 12 }), fc.integer({ min: -2, max: 12 })), size: fc.tuple(half(1, 3), half(1, 2), fc.constantFrom(0, 0.3, 1)), ports: fc.constantFrom(0, 1) });
const keepArb = fc.record({ x: fc.integer({ min: 200, max: 1500 }), y: fc.integer({ min: 150, max: 900 }), w: fc.integer({ min: 40, max: 420 }), h: fc.integer({ min: 20, max: 420 }) });

/** A random deck map: {html, options, links, layLinks, spec}, or null for one the deck would not draw as a map (nothing on it). */
export const deckMapArb = fc.record({
  canvas: fc.constantFrom([1920, 1080], [1600, 900]), area: fc.constantFrom(null, [0, 120, 1920, 980], [100, 50, 1500, 850], [0, 0, 300, 200]),
  byHand: fc.boolean(), grouped: fc.boolean(), order: fc.array(fc.nat(), { maxLength: 12 }),
  grid: fc.oneof(fc.constant('none'), fc.constant('fit'), fc.record({ tile: fc.integer({ min: 60, max: 180 }), tall: fc.option(fc.integer({ min: 20, max: 50 }), { nil: null }), x: fc.integer({ min: 0, max: 1600 }), y: fc.integer({ min: 0, max: 400 }), rise: fc.option(fc.integer({ min: 20, max: 120 }), { nil: null }) })),
  blocks: fc.array(blockArb, { minLength: 0, maxLength: 6 }), floors: fc.array(floorArb, { maxLength: 3 }), feet: fc.array(footArb, { maxLength: 2 }), keep: fc.array(keepArb, { maxLength: 2 }),
  wires: fc.array(fc.record({ a: fc.nat(), b: fc.nat(), straight: fc.boolean(), portA: fc.boolean(), portB: fc.boolean() }), { maxLength: 6 }),
}).map(writeDeckMap);

/** The deck's map in its own HTML, and the spec its adapter hands buildIsoMap. */
export function writeDeckMap(m) {
  const [w] = m.canvas;
  // a footprint or floor kept clear stands where its own style puts it: the deck refuses either beside blocks the build places or a fitted grid
  const handPlaced = m.byHand && m.grid !== 'fit', feet = handPlaced ? m.feet : [], clear = handPlaced ? m.keep : [];
  const blocks = m.blocks.map((b, i) => {
    const size = b.sized || b.kind === 'cylinder' ? [b.wide, b.kind === 'cylinder' ? b.wide : b.deep, b.high] : [2, 2, 1];
    const label = b.label ?? (b.rule ? 'Server' : null);
    return { name: `b${i}`, kind: b.kind, sized: b.sized || b.kind === 'cylinder', at: m.byHand ? (b.at[2] === null ? [b.at[0], b.at[1]] : b.at) : null, size, label, rule: label ? b.rule : null, group: m.grouped ? b.group : null, ports: b.kind === 'cylinder' ? [] : portsOf(size, b.ports) };
  });
  const standing = [...blocks.map((b) => ({ name: b.name, ports: b.ports })), ...feet.map((f, i) => ({ name: `fp${i}`, ports: portsOf(f.size, f.ports) }))];
  const n = standing.length;
  const wires = n < 2 ? [] : m.wires.map((x, i) => {
    const a = x.a % n, b = (a + 1 + (x.b % (n - 1))) % n, pa = standing[a].ports, pb = standing[b].ports;
    const portA = !x.straight && x.portA && pa.length ? pa[i % pa.length].name : null, portB = !x.straight && x.portB && pb.length ? pb[i % pb.length].name : null;
    return { from: { name: standing[a].name, port: portA }, to: { name: standing[b].name, port: portB }, straight: x.straight && !portA && !portB };
  });
  const floors = m.floors.map((f, i) => ({ name: `f${i}`, at: f.given === 'both' ? f.at : null, size: f.given === 'none' ? null : f.size, label: f.label, icon: Boolean(f.label) && f.icon, group: m.grouped || f.group === 'spare' ? f.group : null }));
  if (!blocks.length && !floors.length && !feet.length) return null;

  // ---- the deck's HTML -------------------------------------------------------------------------------------------
  const ports = (list) => (list.length ? ` data-ports="${list.map((p) => `${p.name}: ${p.at.join(' ')}`).join(' | ')}"` : '');
  const gridTag = m.grid === 'none' ? '' : m.grid === 'fit' ? '<i data-iso-grid="fit"></i>' : `<i data-iso-grid="${m.grid.tile}${m.grid.tall === null ? '' : ` ${m.grid.tall}`} at ${m.grid.x} ${m.grid.y}${m.grid.rise === null ? '' : ` rise ${m.grid.rise}`}"></i>`;
  const tags = [
    ...floors.map((f) => `<div data-k="${f.name}" data-iso="floor"${f.at ? ` data-at="${f.at.join(' ')}"` : ''}${f.size ? ` data-size="${f.size.join(' ')}"` : ''}${f.label ? ` data-label="${f.label}"` : ''}${f.icon ? ' data-icon="acc"' : ''}${f.group ? ` data-iso-group="${f.group}"` : ''}></div>`),
    ...blocks.map((b) => `<div data-k="${b.name}" data-iso="${b.kind}"${b.at ? ` data-at="${b.at.join(' ')}"` : ''}${b.sized ? ` data-size="${b.size.join(' ')}"` : ''}${b.group ? ` data-iso-group="${b.group}"` : ''}${ports(b.ports)}${b.rule ? ` data-break="${b.rule}"` : ''}>${b.label ? `<b>${b.label}</b><small>a note</small>` : ''}</div>`),
    ...feet.map((f, i) => `<img data-k="fp${i}" data-footprint="${f.at.join(' ')} ${f.size.join(' ')}"${ports(portsOf(f.size, f.ports))} style="left:300px;top:420px;width:180px;height:120px">`),
    ...clear.map((k, i) => `<div data-k="k${i}" class="name" data-keep-clear style="left:${k.x}px;top:${k.y}px;width:${k.w}px;height:${k.h}px">Words</div>`),
  ];
  // the pieces in a shuffled order of writing: the deck reads them in the order written, the spec keeps each list in it
  const written = tags.map((t, i) => [m.order[i] ?? i, i, t]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).map((p) => p[2]);
  const html = gridTag + written.join('');
  const solidOrder = written.filter((t) => / data-iso="(block|cylinder)"/.test(t)).map((t) => / data-k="([^"]+)"/.exec(t)[1]);
  const floorOrder = written.filter((t) => / data-iso="floor"/.test(t)).map((t) => / data-k="([^"]+)"/.exec(t)[1]);
  const footOrder = written.filter((t) => /data-footprint/.test(t)).map((t) => Number(/ data-k="fp(\d+)"/.exec(t)[1]));
  const keepOrder = written.filter((t) => /data-keep-clear/.test(t)).map((t) => Number(/ data-k="k(\d+)"/.exec(t)[1]));
  const options = { canvas: m.canvas, area: m.area, icons: { acc: { viewBox: '0 0 24 24', body: '<path d="M0 0h24v24H0z"/>' } } };

  // ---- the spec, as the deck's adapter hands it --------------------------------------------------------------------
  const blockByName = new Map(blocks.map((b) => [b.name, b])), floorByName = new Map(floors.map((f) => [f.name, f]));
  const writtenGrid = m.grid === 'none' || m.grid === 'fit' ? m.grid === 'fit' ? 'fit' : null : { tile: m.grid.tall === null ? m.grid.tile : [m.grid.tile, m.grid.tall], origin: [m.grid.x, m.grid.y], ...(m.grid.rise === null ? {} : { rise: m.grid.rise }) };
  const usualGrid = { tile: 120, origin: [w / 2, 240] };
  const spec = {
    blocks: solidOrder.map((name) => { const b = blockByName.get(name); return { name, kind: b.kind, at: b.at, size: b.size, label: b.label, rule: b.rule, group: b.group, ports: b.ports }; }),
    floors: floorOrder.map((name) => { const f = floorByName.get(name); return { name, at: f.size ? f.at ?? [0, 0] : null, size: f.size, label: f.label, icon: f.icon, group: f.group }; }),
    obstacles: footOrder.map((i) => ({ name: `fp${i}`, at: feet[i].at, size: feet[i].size, ports: portsOf(feet[i].size, feet[i].ports) })),
    wires: wires.map((x) => ({ from: { block: x.from.name, port: x.from.port }, to: { block: x.to.name, port: x.to.port }, straight: x.straight })),
    grid: writtenGrid, usualGrid, area: m.area ?? [0, 0, ...m.canvas],
  };
  // the floor kept clear, as the deck works it out (iso.js · place): under each box, at each height something stands at,
  // on the grid that does not move (written, else the usual one)
  spec.keep = () => {
    if (!keepOrder.length) return [];
    const grid = isometric(writtenGrid ?? usualGrid), lifts = [...new Set([...spec.blocks, ...spec.obstacles].map((p) => p.at[2] ?? 0))], budget = { left: MOST_KEEP, most: MOST_KEEP };
    return keepOrder.flatMap((k) => lifts.flatMap((lift) => keptFloor(clear[k], grid, lift, `"k${k}" (data-keep-clear)`, budget).map(({ at, size }) => ({ at, size, name: `k${k}` }))));
  };
  return { html, options, links: wires.map((x) => [x.from.name, x.to.name]), layLinks: wires.map((x) => (x.straight ? null : [x.from, x.to])), spec, solidOrder };
}
