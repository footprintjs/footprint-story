// footprint-story/geometry — angles, turns and places on a sphere, as numbers: the angle at a point and the twist about a
// line, angles that wrap round, quaternions (a turn with no gimbal lock), slerp and squad (even turns, Shoemake), spherical
// places and great circles, a camera's look and how far its horizon leans. Pure: runs anywhere (browser or Node), imports
// nothing outside src/geom/, and loads only when imported. WHY its own door: camera moves use it (footprint-story/shot),
// and so will joint angles and rolling, which are not camera work; every public name has one door.
//
//   angleAt([1, 0], [0, 0], [0, 1])               → π/2
//   shortestTurn(170 * DEG, -170 * DEG)           → +20°
//   slerp(a, b, 0.25)                             → a quarter of the angle, at constant speed, the shorter way round
//   horizonRoll(lookAt([0, 2, 10], [0, 2, 0]))    → 0: aimed at the target, horizon level

export { angleAt, dihedral, wrapAngle, shortestTurn, unwrapAngles } from './src/geom/angles.js';
export { quatFromAxisAngle, quatMultiply, quatNormalize, quatRotate, quatAngle, quatLook, quatForward, quatFromAxes } from './src/geom/quat.js';
export { slerp, squad } from './src/geom/slerp.js';
export { toSpherical, fromSpherical, greatCircle } from './src/geom/sphere.js';
export { lookAt, horizonRoll } from './src/geom/look.js';
