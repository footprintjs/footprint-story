// footprint-storyreel src/kits/isometric/draw.mjs at 502044a (0.34.0): line 17 (its import of ISO_CABLE, pointed at the cables control) and lines 89–94 (drawHead). 'export' added.
import {ISO_CABLE} from './storyreel-0.34.0-cables.mjs';
/** An arrow's head at `tip`, pointing from `before` (deck/transforms.js · headAt). */
export function drawHead(c, tip, before, colour) {
  const far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1, ux = (tip[0] - before[0]) / far, uy = (tip[1] - before[1]) / far, H = ISO_CABLE.head;
  const back = [tip[0] - ux * H, tip[1] - uy * H], nx = -uy * H * 0.6, ny = ux * H * 0.6;
  c.fillStyle = colour; c.beginPath(); c.moveTo(tip[0], tip[1]); c.lineTo(back[0] + nx, back[1] + ny); c.lineTo(back[0] - nx, back[1] - ny); c.closePath(); c.fill();
}
