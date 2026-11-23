// footprint-story/body — a body as data: a rig (a tree of parts, each owning the joint at its start), a pose (the root's
// place and turn, and every part's angle relative to its parent), where a pose puts each part and the body's centre of
// mass, joint limits read in a window and the facing mirror, and two-bone IK in closed form. Pure: runs anywhere
// (browser or Node), imports nothing outside src/body/, and loads only when imported. Nothing here draws, and nothing
// here reads an intent: footprint-story/human's body moves (a later round) reach this door, never the reverse.
//
//   const ana = humanRig({ name: 'ana', height: 350 })          → 17 parts, chains arm-n, arm-f, leg-n, leg-f, spine
//   const pose = restPose(ana, { root: [400, 500] })            → standing, arms down, facing +x
//   twoBone(ana, pose, 'arm-n', [470, 420])                     → {pose, miss: 0, stretched: false, folded: false, clamped: [], moved: []}
//   centreOf(ana, placeParts(ana, pose))                        → the centre of mass, [x, y]

export { readRig, humanRig, MOST_PARTS, MOST_CHAIN, MOST_LENGTH } from './src/body/rig.js';
export { restPose, placeParts, centreOf } from './src/body/pose.js';
export { windowAngle, clampPose, mirrorPose } from './src/body/limits.js';
export { twoBone, REACH_TOLERANCE } from './src/body/twoBone.js';
