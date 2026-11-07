/**
 * Over the part of the frame two things share, how much of it the other reaches first. Two cards compare exactly: on the frame
 * one over depth is linear, so "nearer" is a straight cut. Things that do not touch keep one order on every ray. Only a ball
 * passing through something leaves a curved border, and that alone is sampled, and says so.
 */
import { add, dot, mul, rayAt, sub } from './lens.js';
import { areaOf, keep, middleOf } from './polygon.js';
import { meet } from './solid.js';

const SAMPLES = 144, MOST_INSET = 0.01, TIE = 1e-12;

/** How far along a ray a thing's nearest part sits, for things that do not touch: a card's plane, the middle of a ball's chord. */
function along(solid, eye, ray) {
  const to = sub(solid.thing.at, eye);
  return solid.n ? dot(solid.n, to) / dot(solid.n, ray) : dot(to, ray) / dot(ray, ray);
}

const inBall = (p, ball) => Math.hypot(...sub(p, ball.thing.at)) <= ball.r;
/** Whether all of a thing lies inside a ball. */
const withinBall = (solid, ball) => (solid.n ? solid.corners.every((p) => inBall(p, ball)) : Math.hypot(...sub(solid.thing.at, ball.thing.at)) + solid.r <= ball.r);

function touch(a, b) {
  if (!a.n && !b.n) return Math.hypot(...sub(a.thing.at, b.thing.at)) < a.r + b.r;
  const [card, ball] = a.n ? [a, b] : [b, a], off = sub(ball.thing.at, card.thing.at);
  const u = Math.max(-card.w, Math.min(card.w, dot(off, card.right))), v = Math.max(-card.h, Math.min(card.h, dot(off, card.up)));
  return Math.hypot(...sub(ball.thing.at, add(add(card.thing.at, mul(card.right, u)), mul(card.up, v)))) < ball.r;
}

/** Two cards: the exact part of the shared polygon where `other` is nearer. */
function nearerCard(lens, solid, other, shared) {
  const toOwn = dot(solid.n, sub(solid.thing.at, lens.eye)), toOther = dot(other.n, sub(other.thing.at, lens.eye));
  if (!toOwn || !toOther) return 0;
  const g = ([x, y]) => { const ray = rayAt(lens, x, y), own = dot(solid.n, ray) / toOwn; return dot(other.n, ray) / toOther - own - Math.abs(own) * TIE; };
  return areaOf(keep(shared, g));
}

/** Calls `visit(x, y, weight)` over a convex polygon, evenly by area, however thin it is. */
function overPolygon(shared, visit) {
  const [a] = shared;
  const total = areaOf(shared);
  for (let i = 1; i < shared.length - 1; i++) {
    const b = shared[i], c = shared[i + 1], part = areaOf([a, b, c]);
    if (!part) continue;
    const m = Math.ceil(Math.sqrt(SAMPLES * part / total)), weight = part / (m * m);
    const at = (p, q) => visit(a[0] + (b[0] - a[0]) * p + (c[0] - a[0]) * q, a[1] + (b[1] - a[1]) * p + (c[1] - a[1]) * q, weight);
    for (let p = 0; p < m; p++) for (let q = 0; q < m - p; q++) {
      at((p + 1 / 3) / m, (q + 1 / 3) / m);
      if (p + q < m - 1) at((p + 2 / 3) / m, (q + 2 / 3) / m);
    }
  }
}

/** A ball passing through something: the part `other` reaches first, sampled; a polygon corner catches a sliver the samples step over. */
function nearerThrough(lens, solid, other, shared) {
  const first = (x, y) => { const ray = rayAt(lens, x, y), own = meet(solid, lens.eye, ray); return own < Infinity && meet(other, lens.eye, ray) < own; };
  let area = 0;
  overPolygon(shared, (x, y, weight) => { if (first(x, y)) area += weight; });
  if (area) return { area, through: false };
  const [mx, my] = middleOf(shared), sliver = shared.some(([x, y]) => first(x + (mx - x) * MOST_INSET, y + (my - y) * MOST_INSET));
  return { area: sliver ? areaOf(shared) * MOST_INSET * MOST_INSET : 0, through: !sliver };
}

/** Of the polygon two things share on the frame, the area `other` reaches first: {area, through}; `through` says they cross and no ray found it in front. */
export function nearerArea(lens, solid, other, shared) {
  if (solid.n && other.n) return { area: nearerCard(lens, solid, other, shared), through: false };
  const whole = areaOf(shared);
  if (!solid.n && withinBall(other, solid)) return { area: 0, through: false };   // first, so of two equal balls neither is nearer
  if (!other.n && withinBall(solid, other)) return { area: Math.hypot(...sub(lens.eye, other.thing.at)) < other.r ? 0 : whole, through: false };
  if (touch(solid, other)) return nearerThrough(lens, solid, other, shared);
  const [x, y] = middleOf(shared), ray = rayAt(lens, x, y);
  return { area: along(other, lens.eye, ray) < along(solid, lens.eye, ray) ? whole : 0, through: false };
}
