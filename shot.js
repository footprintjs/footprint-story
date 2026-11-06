// footprint-story/shot — a camera in 3D as plain data: where it stands, what it is on, and what it really sees. Pure: runs
// anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws.
//
//   readShot({ on: 'door', from: 'front-left high', size: 'medium' }, scene)   → { on, from, size, lens }
//   frameOf(shot, scene)                                                       → { target, azimuth, elevation, distance, focal, aperture }
//   project(point, camera, [1280, 720])                                        → { x, y, depth }
//   shotLine(checkShot(scene, camera, [1280, 720], shot))                      → one line of text a model reads

export { ROUNDS, HEIGHTS, SIZES, LENSES, readView } from './src/shot/views.js';
export { MOST_THINGS } from './src/shot/fields.js';
export { readScene, sceneProblems } from './src/shot/scene.js';
export { readShot, shotProblems } from './src/shot/readShot.js';
export { readCamera, frameOf, distanceFor, apertureFor } from './src/shot/camera.js';
export { project, unproject, boxOf } from './src/shot/project.js';
export { checkShot } from './src/shot/check.js';
export { shotLine } from './src/shot/line.js';
