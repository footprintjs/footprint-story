// The colour measures (src/isometric/colour.js): luminance and the contrast ratio (WCAG 2), the ink a name reads in on a
// face (readableInk — StoryReel 0.49.0's nameInk, moved here so StoryDeck writes the same ink), and ΔE76. Pinned: WCAG's
// worked examples, CIELAB's published values, StoryReel's own answers on its golden faces and against its own code
// for any colours (the control test/control/storyreel-0.49.0-nameInk.mjs), and the duotone's tint of an untoned block
// kept apart from the ok / warn / bad faces. FC_RUNS=5000 npm test runs a deeper sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { luminance, contrastRatio, readableInk, deltaE76, isometric, isoStyle, paintPiece, mixColour, DUOTONE } from '../isometric.js';
import { nameInk, ratioOf } from './control/storyreel-0.49.0-nameInk.mjs';

const RUNS = Number(process.env.FC_RUNS) || 300;
const hex = fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 3 }).map((c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not ${b} to ${eps}`);

test('luminance and the contrast ratio are WCAG 2\'s: its worked examples, unrounded, and either order', () => {
  assert.equal(luminance('#ffffff'), 1);
  assert.equal(luminance('#000'), 0);
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#3a7', '#33aa77'), 1);
  // the grey that just misses AA on white, and the one that just makes it (the usual worked pair)
  assert.equal(contrastRatio('#777', '#fff').toFixed(2), '4.48');
  assert.ok(contrastRatio('#777777', '#ffffff') < 4.5, 'unrounded: 4.48 never passes as 4.5');
  assert.equal(contrastRatio('#767676', '#ffffff').toFixed(2), '4.54');
  assert.equal(contrastRatio('#595959', '#ffffff').toFixed(2), '7.00');
  fc.assert(fc.property(hex, hex, (a, b) => {
    assert.equal(contrastRatio(a, b), contrastRatio(b, a));
    const r = contrastRatio(a, b);
    assert.ok(r >= 1 && r <= 21);
    // the same numbers StoryReel's own measure gives (contrast.mjs), to the last bit
    assert.equal(r, ratioOf(a, b));
  }), { numRuns: RUNS });
  assert.throws(() => luminance('red'), /^Error: isometric: the colour is a colour, "#rgb" or "#rrggbb" — not "red"$/);
});

test('ΔE76 is the CIELAB distance under D65: black to white 100, red where the published Lab puts it', () => {
  close(deltaE76('#000000', '#ffffff'), 100, 0.01, 'black to white');
  // sRGB red is L* 53.24, a* 80.09, b* 67.20 (D65): its distance from black (0, 0, 0)
  close(deltaE76('#ff0000', '#000'), Math.hypot(53.24, 80.09, 67.20), 0.05, 'red to black');
  fc.assert(fc.property(hex, hex, (a, b) => { assert.equal(deltaE76(a, b), deltaE76(b, a)); assert.equal(deltaE76(a, a), 0); }), { numRuns: RUNS });
  assert.throws(() => deltaE76('#fff', 7), /^Error: isometric: the second colour is a colour, "#rgb" or "#rrggbb" — not 7$/);
});

// StoryReel's looks: its paper theme (light) and the night palette its test pins (dark)
const light = { bg: '#f3eee3', ink: '#23211c' }, dark = { bg: '#161b22', ink: '#e8e4da' };

test('readableInk is StoryReel\'s nameInk: its golden faces give its answers, and so does any face with any two inks', () => {
  // StoryReel's own test (test/iso-looks.test.mjs): the usual tone, the ok / warn / bad tints, line-art's paper
  for (const face of ['#e1e9f5', '#d9e4f3', '#ffffff', '#c6e0d2', '#ead7bf', '#ecc6c3']) {
    assert.deepEqual(readableInk(face, [light.ink, light.bg]), { ink: light.ink, ratio: contrastRatio(light.ink, face), reads: true }, `${face}: the paper theme's ink`);
    const got = readableInk(face, [dark.ink, dark.bg]);
    assert.equal(got.ink, dark.bg, `${face}: on the dark theme, the ground`);
    assert.ok(got.reads && got.ratio >= 4.5);
    for (const look of [light, dark]) assert.equal(readableInk(face, [look.ink, look.bg]).ink, nameInk(face, look), `${face} on ${look.bg}: StoryReel's own answer`);
  }
  assert.equal(readableInk(dark.bg, [dark.ink, dark.bg]).ink, dark.ink, 'a face of the dark ground: the theme\'s ink');
  // exactly: for any face and any pair of inks, the ink StoryReel 0.49.0 draws (its face null — no fill — is its own rule)
  fc.assert(fc.property(hex, hex, hex, (face, ink, bg) => { assert.equal(readableInk(face, [ink, bg]).ink, nameInk(face, { ink, bg })); }), { numRuns: RUNS * 10 });
});

test('readableInk: the first ink that reads, else the best with reads false; least is the caller\'s; the refusals name the fix', () => {
  // the first that reads, not the best: a caller's order is its preference
  assert.deepEqual(readableInk('#ffffff', ['#767676', '#000000']), { ink: '#767676', ratio: contrastRatio('#767676', '#ffffff'), reads: true });
  // none reads: the best, with its ratio, and reads false — never a failing ink as if it passed
  const none = readableInk('#808080', ['#999999', '#ffffff', '#000000'], { least: 7 });
  assert.deepEqual(none, { ink: '#000000', ratio: contrastRatio('#000000', '#808080'), reads: false });
  assert.ok(none.ratio < 7 && Object.isFrozen(none));
  // a tie goes to the earlier; large text asks 3 : 1
  assert.equal(readableInk('#808080', ['#7f7f7f', '#7f7f7f'], { least: 4.5 }).ink, '#7f7f7f');
  assert.equal(readableInk('#ffffff', ['#949494', '#000000'], { least: 3 }).ink, '#949494');
  assert.equal(readableInk('#ffffff', ['#949494', '#000000']).ink, '#000000');
  // as this package reads a colour: #rgb or any case in, lower-case #rrggbb out
  assert.equal(readableInk('#FFF', ['#ABC', '#000']).ink, '#000000');
  assert.deepEqual(readableInk('#fff', ['#000'], null), readableInk('#fff', ['#000'], { least: undefined }));
  fc.assert(fc.property(hex, fc.array(hex, { minLength: 1, maxLength: 6 }), fc.double({ min: 1, max: 21, noNaN: true }), (face, inks, least) => {
    const got = readableInk(face, inks, { least }), ratios = inks.map((i) => contrastRatio(i, face)), first = ratios.findIndex((r) => r >= least);
    assert.equal(got.reads, first >= 0);
    assert.equal(got.ink, inks[first >= 0 ? first : ratios.indexOf(Math.max(...ratios))]);
    assert.equal(got.ratio, contrastRatio(got.ink, face));
  }), { numRuns: RUNS });
  const refused = (args, re) => assert.throws(() => readableInk(...args), re);
  refused(['#fff', []], /^Error: isometric: the inks are a list of at least one colour — not an empty list$/);
  refused(['#fff', '#000'], /^Error: isometric: the inks is a plain list — not "#000"$/);
  refused(['#fff', ['#000', 'navy']], /^Error: isometric: ink 2 is a colour, "#rgb" or "#rrggbb" — not "navy"$/);
  refused([null, ['#000']], /^Error: isometric: the face the ink stands on is a colour, "#rgb" or "#rrggbb" — not null$/);
  refused(['#fff', ['#000'], { least: 0.5 }], /^Error: isometric: readableInk's least is a contrast ratio from 1 to 21 \(4\.5 for small text, 3 for large\) — not 0\.5$/);
  refused(['#fff', ['#000'], { least: '4.5' }], /least is a contrast ratio from 1 to 21/);
  refused(['#fff', ['#000'], { least: 4.5, large: true }], /^Error: isometric: readableInk's options hold least only — not \["least","large"\]$/);
  refused(['#fff', ['#000'], 4.5], /^Error: isometric: readableInk's options are \{least\} — not 4\.5$/);
  refused(['#fff', ['#000'], Object.defineProperty({}, 'least', { get: () => 3, enumerable: true })], /getter \(code, never run\)/);
});

// The duotone's tint of a block with no tone, beside the ok / warn / bad faces the page gives. StoryReel 0.49.0 hands
// an untoned block its colour (the tools' usual tone, #d9e4f3) so the duotone tints it toward its orange accent; the
// warn tones are orange too. Ours: the floor is ΔE76 10, the one the ok / warn / bad faces keep from each other
// (isometric-looks-grain-duotone.test.js) — WHY the same: a block that means nothing mistaken for warn is the same
// mistake as warn mistaken for bad, so one number for "read apart at a glance" (about 2.3 is the least an eye tells).
const APART = 10;
const grid = isometric({ tile: 100, origin: [500, 100] }), block = { name: 'server', kind: 'block', at: [1, 1], size: [2, 2, 1] };
const UNTONED = '#d9e4f3';
// the status tones: this package's test set, StoryReel's paper and storybook themes, and StoryReel's defaults (StoryDeck's tokens)
const TONES = {
  ours: { ok: '#2e7d32', warn: '#b26a00', bad: '#c62828' },
  paper: { ok: '#2c7a58', warn: '#b4650c', bad: '#b33f36' },
  storybook: { ok: '#2f6b3a', warn: '#b4650c', bad: '#a8362c' },
  deck: { ok: '#1a7a3e', warn: '#8f5c00', bad: '#c0322b' },
};
const pageFaces = (items, base) => items.map((it) => (it.fill.colour ?? mixColour(base, it.fill.mix[0], it.fill.mix[1])));

test('the duotone\'s tint of an untoned block stays ΔE76 over 10 from every ok / warn / bad face, on a light page and a dark one', () => {
  const pages = { light: isoStyle({ look: 'duotone' }), dark: isoStyle({ palette: { name: 'duotone', paper: dark.bg, ink: dark.ink, accent: DUOTONE.accent } }) };
  let worst = { d: Infinity };
  for (const [page, style] of Object.entries(pages)) {
    const untoned = paintPiece(style, block, grid, { base: UNTONED, ink: '#14181f' }).items.map((it) => it.fill.colour);
    const recipe = paintPiece(style, block, grid).items;
    for (const [theme, tones] of Object.entries(TONES)) {
      for (const [tone, c] of Object.entries(tones)) {
        // a tone as the tools give it: the theme's colour as a pale tint (60% white), the page's at draw time
        pageFaces(recipe, mixColour(c, '#ffffff', 0.6)).forEach((face, i) => {
          const d = deltaE76(face, untoned[i]);
          assert.ok(d > APART, `${page} page, ${theme} ${tone}, face ${recipe[i].role}: ΔE ${d.toFixed(1)}`);
          if (d < worst.d) worst = { d, page, theme, tone, role: recipe[i].role };
        });
      }
    }
  }
  // the nearest: warn on StoryReel's paper and storybook themes, on the lit top — the margin over the floor, stated
  assert.deepEqual({ ...worst, d: worst.d.toFixed(1) }, { d: '12.2', page: 'light', theme: 'paper', tone: 'warn', role: 'top' });
  // StoryReel 0.49.0's review: 12.2 to 16.5 from its warn face (paper theme), all three faces
  const untoned = paintPiece(pages.light, block, grid, { base: UNTONED, ink: '#14181f' }).items.map((it) => it.fill.colour);
  const warn = pageFaces(paintPiece(pages.light, block, grid).items, mixColour(TONES.paper.warn, '#ffffff', 0.6));
  assert.deepEqual(warn.map((f, i) => deltaE76(f, untoned[i]).toFixed(1)), ['12.6', '16.5', '12.2']);
});
