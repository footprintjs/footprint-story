// draw.mjs lines 21, 23, 25, 26, 38, 40-87 (ISO_LOOK, channels, mix, withAlpha, polygon, drawFloor, drawBlock), at a2f08c2
export const ISO_LOOK = Object.freeze({tone: '#d9e4f3', glow: '#e8a33d', line: 2.5, grid: 0.16, cable: 4, label: 1, smallInk: 0.68, appear: 0.35});
const channels = (hex) => { const h = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); };
export const mix = (hex, other, share) => { const a = channels(hex), b = channels(other); return `#${a.map((v, i) => Math.round(v + (b[i] - v) * share).toString(16).padStart(2, '0')).join('')}`; };
export const withAlpha = (hex, alpha) => `rgba(${channels(hex).join(',')},${alpha})`;
const polygon = (c, points) => { c.beginPath(); points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
export function drawFloor(c, f, look) {
  const {outline, lines} = f.shape;
  if (f.color) { c.fillStyle = f.color; polygon(c, outline); c.fill(); }
  c.strokeStyle = withAlpha(look.ink, ISO_LOOK.grid); c.lineWidth = 1.5; c.lineCap = 'butt';
  c.beginPath(); for (const [x1, y1, x2, y2] of lines) { c.moveTo(x1, y1); c.lineTo(x2, y2); } c.stroke();
  if (!f.place) return;
  // flat on the floor along its front edge: the label's lines, their block's foot on the edge (CSS: matrix, then translateY(-100%))
  const {x, y, matrix: [a, b, cc, d], size, lines: words} = f.place, lh = size * 1.15;
  c.save(); c.translate(x, y); c.transform(a, b, cc, d, 0, 0);
  c.font = `700 ${size}px ${look.sans}`; c.textAlign = 'left'; c.textBaseline = 'middle';
  // a halo of the ground under the letters (as a wire's label has its plate): the tile lines stop at the words, which
  // read against the ground alone; and the ink is whole (StoryDeck draws 72%) — at 72% over the grid the film's contrast
  // check measured 2:1
  c.lineWidth = Math.max(4, size * 0.3); c.lineJoin = 'round'; c.strokeStyle = f.color ?? look.bg;
  words.forEach((line, i) => c.strokeText(line, 0, -lh * words.length + (i + 0.5) * lh));
  c.fillStyle = withAlpha(look.ink, ISO_LOOK.label);
  words.forEach((line, i) => c.fillText(line, 0, -lh * words.length + (i + 0.5) * lh));
  // a little weight on the letters (a stroke of the ink, 6% of the size): words laid flat on the floor are read slantwise,
  // thinner than they stand, and in the box round a slanted line the letters are a small share — the film's contrast check
  // read the plain weight at 2.7:1, under the 3:1 large words need
  c.lineWidth = Math.max(1, size * 0.06); c.strokeStyle = c.fillStyle;
  words.forEach((line, i) => c.strokeText(line, 0, -lh * words.length + (i + 0.5) * lh));
  c.restore();
}

/** A block's faces (or a cylinder's side and top) and its name on its top. */
export function drawBlock(c, b, look) {
  // a tone is the theme's ok / warn / bad colour as a pale tint (60% white): a block's name is ink on its top, and the theme's
  // tones are ink-dark — on the tone itself the name would fail the film's contrast check (StoryDeck colours the block the tone)
  const tone = b.color ?? (b.tone ? mix(look.tones[b.tone], '#ffffff', 0.6) : ISO_LOOK.tone), s = b.shape;
  c.strokeStyle = look.ink; c.lineWidth = ISO_LOOK.line; c.lineJoin = 'round';
  if (s.kind === 'cylinder') {
    const {top: t, bottom: m} = s;
    c.beginPath(); c.moveTo(t.cx - t.rx, t.cy); c.lineTo(m.cx - m.rx, m.cy); c.ellipse(m.cx, m.cy, m.rx, m.ry, 0, Math.PI, 0, true); c.lineTo(t.cx + t.rx, t.cy); c.closePath();
    c.fillStyle = mix(tone, '#000000', 0.18); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(t.cx, t.cy, t.rx, t.ry, 0, 0, 2 * Math.PI); c.fillStyle = mix(tone, '#ffffff', 0.2); c.fill(); c.stroke();
  } else {
    for (const [face, fill] of [[s.left, mix(tone, '#000000', 0.06)], [s.right, mix(tone, '#000000', 0.18)], [s.top, mix(tone, '#ffffff', 0.2)]]) { polygon(c, face); c.fillStyle = fill; c.fill(); c.stroke(); }
  }
  if (!b.fitted?.lines.length) return;
  // the name upright on the top's middle, its lines as wordsToFit broke them; the small line beneath it
  const {lines, size} = b.fitted, lh = size * 1.15, sf = b.smallFitted, small = sf ? sf.size * 1.15 + 2 : 0, height = lines.length * lh + small;
  const [cx, cy] = s.centre, top = cy - height / 2;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = look.ink;
  c.font = `700 ${size}px ${look.sans}`;
  lines.forEach((line, i) => c.fillText(line, cx, top + (i + 0.5) * lh));
  if (sf) { c.font = `500 ${sf.size}px ${look.sans}`; c.fillStyle = withAlpha(look.ink, ISO_LOOK.smallInk); c.fillText(sf.lines.join(' '), cx, top + lines.length * lh + 2 + (small - 2) / 2); }
}
