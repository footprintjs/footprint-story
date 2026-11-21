// layout.mjs lines 293-306 (wrap, balancedLines), at e611fb4
/** Words wrapped greedily into lines no wider than `width` (a word wider than that has a line to itself). */
export function wrap(ctx, words, width) {
  const out = [''];
  for (const word of words) { const next = out.at(-1) ? `${out.at(-1)} ${word}` : word; if (ctx.measureText(next).width > width && out.at(-1)) out.push(word); else out[out.length - 1] = next; }
  return out;
}
/** Wrapped, then balanced: the narrowest width that keeps the same number of lines, so no line ends with a word alone. */
export function balancedLines(ctx, text, width) {
  const words = text.split(/\s+/).filter(Boolean), lines = wrap(ctx, words, width);
  if (lines.length < 2) return lines;
  let lo = 0, hi = width;
  for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (wrap(ctx, words, mid).length > lines.length) lo = mid; else hi = mid; }
  return wrap(ctx, words, hi);
}
// endcard.mjs lines 11-16 (wrap, renamed wrapEndCard)
/** Words wrapped greedily into lines no wider than `width` (a word wider than that has a line to itself). */
export function wrapEndCard(ctx, text, width) {
  const out = [''];
  for (const word of text.split(/\s+/).filter(Boolean)) { const next = out.at(-1) ? `${out.at(-1)} ${word}` : word; if (ctx.measureText(next).width > width && out.at(-1)) out.push(word); else out[out.length - 1] = next; }
  return out;
}
// kits/paper/paper.mjs lines 352-356 (wrap, renamed wrapPaper)
export const wrapPaper = (P, text, size, width) => {
  const lines = [''];
  for (const wd of text.split(' ')) { const next = lines.at(-1) ? `${lines.at(-1)} ${wd}` : wd; if (P.measure(next, size, {display: true, weight: 600}) > width && lines.at(-1)) lines.push(wd); else lines[lines.length - 1] = next; }
  return lines;
};
// captions.mjs lines 50-74 (captionLines)
export function captionLines(ctx, caption, [x, y, w, h], size, {balance = false} = {}) {
  const space = ctx.measureText(' ').width, widths = caption.words.map(word => ctx.measureText(word.text).width);
  // Greedy wrap into lines no wider than `limit`.
  const wrapAt = limit => {
    const out = [[]]; let lineWidth = 0;
    caption.words.forEach((_, i) => {
      const add = (out.at(-1).length ? space : 0) + widths[i];
      if (out.at(-1).length && lineWidth + add > limit) { out.push([]); lineWidth = 0; }
      lineWidth += (out.at(-1).length ? space : 0) + widths[i]; out.at(-1).push(i);
    });
    return out;
  };
  let lines = wrapAt(w - size);
  if (balance && lines.length > 1) {
    let lo = 0, hi = w - size;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (wrapAt(mid).length > lines.length) lo = mid; else hi = mid; }
    lines = wrapAt(hi);
  }
  const lineH = size * 1.25, top = y + h / 2 - (lines.length * lineH) / 2;
  const placed = lines.map((line, n) => {
    const lw = line.reduce((s, i, k) => s + widths[i] + (k ? space : 0), 0);
    return {line, x: x + w / 2 - lw / 2, cy: top + lineH * (n + .5), lw};
  });
  return {lines: placed, rects: placed.map(l => [l.x - size * .35, l.cy - lineH / 2, l.x + l.lw + size * .35, l.cy + lineH / 2]), widths, space, lineH};
}
