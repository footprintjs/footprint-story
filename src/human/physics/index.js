// footprint-story/human · physics — light physics and secondary motion: ballistic flight, bounces, hanging chains,
// floor and box collisions on a fixed step; the throw, fall and hang models; the animation principles as wrappers;
// the spacing, volume and contact critics. Pure, seeded, plain data out: nothing here draws.
//
//   const m = PHYSICS_MODELS.find((x) => x.family === 'throw' && x.name === 'ballistic')
//   const plan = m.plan({ do: 'throw', from: [100, 600], to: [700, 600] }, { who: 'blocks[2] ("ball")' })
//   m.sample(plan, 0.3)                                        → { x, y, angle }
//   sampleWrapped(overshoot(plan, { by: 12 }), 0.3, m.sample)  → the same throw, landing 12 px past and settling back
//   spacing.finding(spacing.measure(trackOf(plan, m.sample)), plan.who)   → null, or { level, message, fix }

// models — the throw, fall and hang strategies, as a registry takes them
export { PHYSICS_MODELS, SQUASH_SECONDS, MOST_LINKS, MOST_CHAIN_SECONDS } from './models.js';

// wrappers — a plan → a plan, over any model's plan
export { anticipate, followThrough, hold, overshoot, sampleWrapped, basePlan, isWrapped, PHYSICS_WRAPPERS, WRAPPER_NAMES, BY_SHARE, MIN_TRAVEL, MOST_WRAPPERS } from './wrap.js';

// critics — measured on a sampled track, said in words with the fix
export { spacing, volume, contact, PHYSICS_CRITICS, trackOf, SPACING_LIMIT, VOLUME_LIMIT, CONTACT_LIMIT, MOST_SAMPLES } from './critics.js';

// the parts underneath, for a tool's own model: flight, bounce, chain, collisions, the fixed step, seeded numbers
export { launch, flightAt, headingAt, fallSeconds, APEX_SHARE, MIN_APEX } from './flight.js';
export { bounces, bounceAt, MIN_BOUNCE, MOST_BOUNCES } from './bounce.js';
export { runChain, relax, pinAt, ITERATIONS, REST_SPEED, LENGTH_TOLERANCE, MIN_LINK } from './chain.js';
export { makeWorld, pushOut, collide, depthIn, MOST_BOXES } from './collide.js';
export { verletStep, simulate, STEP, EVERY, GRAVITY } from './step.js';
export { settleLeft, settleSeconds } from './settle.js';
export { seededRandom, FAR, MOST_SECONDS } from './read.js';
