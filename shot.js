// footprint-story/shot — a camera in 3D as plain data: where it stands, what it is on, and what it really sees. Pure: runs
// anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws.
//
//   readShot({ on: 'door', from: 'front-left high', size: 'medium' }, scene)   → { on, from, size, lens }
//   frameOf(shot, scene)                                                       → { target, azimuth, elevation, distance, focal, aperture }
//   project(point, camera, [1280, 720])                                        → { x, y, depth }
//   shotLine(checkShot(scene, camera, [1280, 720], shot))                      → one line of text a model reads
//   planCameraMove({ do: 'fly', from: shotA, to: shotB }, scene)               → a move: slerp, arc or cut, its reason, its seconds
//   cameraTrack(move).samples / checkCameraMove(move, { scene, frame })        → the path in time; what still looks wrong, in words
//
// The geometry (angles, quaternions, slerp, squad, spherical places, look-at) is a shared leaf, src/geom/, handed out here;
// the moves' timing is the minimum-jerk law, a shared leaf (src/timing/) the human door hands out.

export { ROUNDS, HEIGHTS, SIZES, LENSES, readView } from './src/shot/views.js';
export { MOST_THINGS } from './src/shot/fields.js';
export { readScene, sceneProblems } from './src/shot/scene.js';
export { readShot, shotProblems } from './src/shot/readShot.js';
export { readCamera, frameOf, distanceFor, apertureFor } from './src/shot/camera.js';
export { project, unproject, boxOf } from './src/shot/project.js';
export { checkShot } from './src/shot/check.js';
export { shotLine } from './src/shot/line.js';

// geometry — the shared leaf src/geom/: angles, quaternions, even turns, places on a sphere, a camera's look
export { angleAt, dihedral, wrapAngle, shortestTurn, unwrapAngles } from './src/geom/angles.js';
export { quatFromAxisAngle, quatMultiply, quatNormalize, quatRotate, quatAngle, quatLook, quatForward, quatFromAxes } from './src/geom/quat.js';
export { slerp, squad } from './src/geom/slerp.js';
export { toSpherical, fromSpherical, greatCircle } from './src/geom/sphere.js';
export { lookAt, horizonRoll } from './src/geom/look.js';

// camera moves — between two views, planned from an intent, sampled in time, checked by critics
export { CAMERA_MOVE_DOS, MOST_MOVE_SECONDS, MOST_ORBIT, MOST_LIFT } from './src/shot/moveRead.js';
export { CAMERA_MOVES, CAMERA_MOVE_RULES, CAMERA_MOVE_KINDS, MOST_CAMERA_SAMPLES, planCameraMove, sampleCameraMove, cameraTrack } from './src/shot/move.js';
export { CAMERA_CRITICS, SIGHT_DROP, HORIZON_MOST } from './src/shot/moveCritics.js';
export { checkCameraMove } from './src/shot/moveCheck.js';
