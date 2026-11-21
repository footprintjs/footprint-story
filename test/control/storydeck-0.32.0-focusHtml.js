// storydeck focusHtml.js at fc9e4ca (0.32.0), lines 15–92 (readPieces and what it calls); its import points at the pieceRules control.
import {attrRule as ATTR, closeOf, ownAttribute, pieceTags, styleLength, tagsWith} from './storydeck-0.32.0-pieceRules.js';

/** An attribute's value in a run of attributes, single or double quoted, or null. */
const attrOf = (at, name) => ATTR(name).exec(at)?.[2] ?? null;
/** A run of attributes with `add` joined to attribute `name` (by `sep`), keeping its quotes; added when absent. */
function joinAttr(at, name, add, sep) {
  if (!add) return at;
  return ATTR(name).test(at) ? at.replace(ATTR(name), (_, q, v) => ` ${name}=${q}${v ? v.replace(sep === ';' ? /;\s*$/ : /\s+$/, '') + sep : ''}${add}${q}`) : `${at} ${name}="${add}"`;
}

/** A CSS length in px (or a bare 0) from an inline style, or null. */
const px = (style, prop) => styleLength(style, prop)?.value ?? null;

/**
 * The pieces of a slide: every element carrying `attr` (data-k) — its names, its box when its inline style
 * places it, its twin, a wire's ends (data-ends: the pieces it joins), whether it is ground (data-ground: it lies
 * under the picture, so no camera frames it), and the stage it stands on when not the main one (data-stage="panel": a
 * stage has its own view, and a click's camera moves one of them). A piece that joins others or is about one (a wire, a
 * callout: data-ends) and names no stage stands on theirs when they share one, so it moves with what it touches.
 * Returns {html, pieces}: the same HTML with each piece numbered (data-sd-i), and the
 * pieces in order. Which tags are pieces is pieceRules.js · pieceTags, read in one pass.
 */
export function readPieces(html, {attr = 'data-k'} = {}) {
  const pieces = [], opens = [];   // opens: each piece's opening tag as it will be written, and the text before it
  let from = 0;
  for (const {start, end, tag, before, quote: q, value: k, after} of pieceTags(html, attr)) {
    const at = before + after, style = attrOf(at, 'style') ?? '';
    const attrPx = name => { const v = attrOf(at, name); return v !== null && /^[\d.]+$/.test(v) ? Number(v) : null; };
    const x = px(style, 'left'), y = px(style, 'top'), w = px(style, 'width') ?? attrPx('width'), h = px(style, 'height') ?? attrPx('height');
    const twin = attrOf(at, 'data-twin')?.trim().split(/\s+/), ends = attrOf(at, 'data-ends')?.trim().split(/\s+/).filter(Boolean);
    // it lies under the picture (a floor, a backdrop): no camera frames it. Read as the tag's own attribute, so the
    // words "data-ground" inside a title are not it; data-ground="false" says it is part of the picture after all
    const marked = /data-ground/i.test(at) ? ownAttribute(at, 'data-ground') : null, ground = !!marked && String(marked.value).trim().toLowerCase() !== 'false';
    // the stage it stands on, when it names one: one word, so it can be written into the page as it is
    const on = /data-stage/i.test(at) ? ownAttribute(at, 'data-stage') : null, stage = on ? String(on.value).trim() : '';
    if (on && (on.bare || !/^[\w-]+$/.test(stage))) throw new Error(`data-stage${on.bare ? '' : `="${on.value}"`}: a stage is written data-stage="panel" — one name of letters, digits, - and _, in lower case and with quotes`);
    // a stage's piece is cut out of the map and drawn in its stage's element: a part of an <svg> drawing would stop being one there
    if (stage && SVG_PARTS.has(tag.toLowerCase())) throw new Error(`data-stage="${stage}" on <${tag}>: a part of an <svg> drawing cannot stand on a stage by itself — put data-stage on the <svg> it is in`);
    // a cable's lead into a port (deck/transforms.js · leadSvg): the build's own, drawn again over a block; no file holds it
    const lead = /data-sd-lead/i.test(at) && Boolean(ownAttribute(at, 'data-sd-lead'));
    pieces.push({keys: k.trim().split(/\s+/), box: x === null || y === null ? null : {x, y, w: w ?? 0, h: h ?? 0}, ...(twin ? {twin} : {}), ...(ends?.length ? {ends} : {}), ...(ground ? {ground: true} : {}), ...(stage ? {stage} : {}), ...(lead ? {lead: true} : {})});
    opens.push({lead: html.slice(from, start), tag: `<${tag}${before} ${attr}=${q}${k}${q} data-sd-i="${pieces.length - 1}"${after}`, name: tag, start, end, alone: VOID.has(tag.toLowerCase()) || /(^|\s)\/\s*$/.test(after)});
    from = end;
  }
  if (pieces.some(p => p.stage)) refuseNested(html, pieces, opens);
  // A piece that names no stage and touches others (data-ends) stands where they do, when they all stand on one stage
  // of their own: a wire between two pieces of the panel is the panel's, a callout about one is too.
  // (the pieces of each name, found once: a map of thousands of wires costs its length, not its square)
  const called = new Map();
  if (pieces.some(p => p.stage)) pieces.forEach(p => p.keys.forEach(k => { if (!called.has(k)) called.set(k, []); called.get(k).push(p); }));
  if (called.size) pieces.forEach((p, i) => {
    if (p.stage || !p.ends) return;
    const theirs = p.ends.map(name => (called.get(name) ?? []).filter(o => o !== p).map(o => o.stage ?? ''));
    const names = new Set(theirs.flat());
    if (theirs.some(l => !l.length) || names.size !== 1 || names.has('')) return;
    p.stage = [...names][0];
    opens[i].tag += ` data-stage="${p.stage}"`;
  });
  return {html: `${opens.map(o => `${o.lead}${o.tag}>`).join('')}${html.slice(from)}`, pieces};
}

/** The parts of an <svg> drawing a map may name as pieces: none of them is an element of the page on its own. */
const SVG_PARTS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'use', 'image', 'defs', 'symbol', 'marker', 'mask', 'clippath', 'lineargradient', 'radialgradient', 'pattern', 'foreignobject']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/**
 * On a map with stages, pieces must not be inside each other: a stage's piece is cut out whole and drawn in its
 * stage's element, so a piece inside it would go along to a stage it does not stand on, and one it is inside would
 * lose it. (Pieces never nest on any map; here it is checked, because here it would draw wrong without a word.)
 */
function refuseNested(html, pieces, opens) {
  let last = null;
  opens.forEach((o, i) => {
    const end = o.alone ? o.end : closeOf(html, o.name, o.end, `piece "${pieces[i].keys[0]}"`).end;
    if (last && o.start < last.end) throw new Error(`piece "${pieces[i].keys[0]}" is inside piece "${pieces[last.i].keys[0]}": on a map with stages, pieces stand beside each other, never inside — move it out, and give it the same data-stage if it belongs with it`);
    if (!last || end > last.end) last = {end, i};
  });
}
