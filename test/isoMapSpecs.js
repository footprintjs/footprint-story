// A random isometric map, as buildIsoMap's spec writes it — shared by the differential test (against StoryReel 0.38.0's
// build) and the map flow's test (against buildIsoMap). Not a test file itself: the runner reads test/*.test.js.
import fc from 'fast-check';

/** A random map, as the spec writes it: blocks (placed by hand or not), ports, wires (some straight), floors, a grid or an area. */
const LABELS = ['Web', 'Load Balancer Service', 'API gateway', 'Database', 'a', 'Cache cluster primary node'];
const half = (lo, hi) => fc.integer({ min: lo * 2, max: hi * 2 }).map((n) => n / 2);
const blockArb = fc.record({
  kind: fc.constantFrom('block', 'block', 'cylinder'),
  wide: half(1, 3), deep: half(1, 3), high: fc.constantFrom(0, 0.5, 1, 1.6),
  at: fc.tuple(half(0, 12), half(0, 12), fc.constantFrom(0, 0, 0, 0, 1)),
  label: fc.option(fc.constantFrom(...LABELS), { nil: null }), small: fc.option(fc.constantFrom('a browser', 'nginx and a cache in front of it', 'pg'), { nil: null }),
  rule: fc.option(fc.constantFrom('even', 'fill'), { nil: null }), group: fc.option(fc.constantFrom('front', 'back'), { nil: null }),
  ports: fc.constantFrom(0, 0, 1, 2),
});
export const mapArb = fc.record({
  blocks: fc.array(blockArb, { minLength: 1, maxLength: 6 }),
  byHand: fc.boolean(), grouped: fc.boolean(),
  wires: fc.array(fc.record({ a: fc.nat(), b: fc.nat(), straight: fc.boolean(), portA: fc.boolean(), portB: fc.boolean() }), { maxLength: 6 }),
  floors: fc.array(fc.record({ given: fc.boolean(), at: fc.tuple(fc.integer({ min: -2, max: 6 }), fc.integer({ min: -2, max: 6 })), size: fc.tuple(fc.integer({ min: 1, max: 14 }), fc.integer({ min: 1, max: 14 })),
    label: fc.option(fc.constantFrom('Production account', 'VPC', 'The very long name of a shared services account'), { nil: null }), group: fc.option(fc.constantFrom('front', 'back'), { nil: null }) }), { maxLength: 3 }),
  grid: fc.option(fc.record({ tile: fc.oneof(fc.integer({ min: 40, max: 180 }), fc.tuple(fc.integer({ min: 60, max: 180 }), fc.integer({ min: 20, max: 50 }))), origin: fc.tuple(fc.integer({ min: 0, max: 1600 }), fc.integer({ min: 0, max: 400 })), rise: fc.option(fc.integer({ min: 20, max: 120 }), { nil: undefined }) }), { nil: null, freq: 1 }),
  area: fc.constantFrom([0, 0, 1600, 900], [100, 50, 1500, 850], [0, 0, 300, 200], [800, 0, 1600, 900]),
}).map(({ blocks, byHand, grouped, wires, floors, grid, area }) => {
  const spec = { blocks: blocks.map((b, i) => {
    const kind = b.kind, size = [b.wide, kind === 'cylinder' ? b.wide : b.deep, b.high];
    // ports on a block's sides: the right side's middle, then the left side's (readPorts' faces), at the foot or up it
    const ports = kind === 'cylinder' ? [] : [{ name: 'p1', at: [size[0], size[1] / 2, 0] }, { name: 'p2', at: [size[0] / 2, size[1], size[2] / 2] }].slice(0, b.ports);
    const label = b.label ?? (b.small || b.rule ? 'Server' : null);
    return { name: `b${i}`, kind, at: byHand ? b.at : null, size, label, small: label ? b.small : null, rule: label ? b.rule : null, group: grouped ? b.group : null, ports, who: `blocks[${i}] ("b${i}")` };
  }) };
  const n = spec.blocks.length;
  spec.wires = n < 2 ? [] : wires.map((w, i) => {
    const a = w.a % n, b = (a + 1 + (w.b % (n - 1))) % n, pa = spec.blocks[a].ports, pb = spec.blocks[b].ports;
    const portA = !w.straight && w.portA && pa.length ? pa[i % pa.length].name : null, portB = !w.straight && w.portB && pb.length ? pb[i % pb.length].name : null;
    return { name: `w${i}`, from: { block: `b${a}`, port: portA }, to: { block: `b${b}`, port: portB }, straight: w.straight && !portA && !portB, who: `wires[${i}]` };
  });
  const groups = new Set(spec.blocks.map((b) => b.group).filter(Boolean));
  spec.floors = floors.map((f, i) => ({ name: `f${i}`, at: f.given ? f.at : null, size: f.given ? f.size : null, label: f.label, group: f.group !== null && groups.has(f.group) ? f.group : null, who: `floors[${i}] ("f${i}")` }));
  spec.grid = grid ? { tile: grid.tile, origin: grid.origin, ...(grid.rise === undefined ? {} : { rise: grid.rise }) } : null;
  spec.area = grid ? null : area;
  return spec;
});

