/** One shot's check as one line of text, for a model to read: what the camera sees, then what to do about what is wrong. */
import { cleanName, cutName } from './fields.js';

const MOST_LABEL = 64, MOST_LISTED = 3;
const quoted = (name) => `"${name}"`;
const under1 = (share, text) => (share > 0 && share < 0.01 ? 'under 1%' : text);
const shareKept = (share) => under1(share, `${Math.floor(share * 100 + 1e-9)}%`);
const shareOfHeight = (share) => under1(share, `${Math.round(share * 100)}%`);
const covered = (share) => under1(share, `${share >= 1 ? 100 : Math.min(99, Math.round(share * 100))}%`);
const figure = (v) => String(Number(v.toPrecision(3)));
const unique = (list) => [...new Set(list)];

const STATES = { behind: 'behind the camera', inside: 'the camera is on it', crosses: 'reaches past the camera' };

const subjectText = (on) => (on.length <= MOST_LISTED ? on.map(quoted).join(', ') : `${on.slice(0, MOST_LISTED).map(quoted).join(', ')} and ${on.length - MOST_LISTED} more`);

function frameText(report, group) {
  const rows = report.rows.filter((r) => r.state === 'seen'), worst = rows.find((r) => r.inFrame === report.inFrame);
  const who = group && report.inFrame < 1 ? ` (${quoted(worst.name)})` : '';
  if (report.inFrame === 0) return `off frame ${worst.sides.join(' and ')}${who}`;
  return report.inFrame < 1 ? `in frame ${shareKept(report.inFrame)}, cut off ${worst.sides.join(' and ')}${who}` : 'in frame 100%';
}

function sizeText(report) {
  if (report.size === null) return 'a point, no size';
  return `${shareOfHeight(report.height)} of height (${report.faults.some((q) => q.kind === 'too-small') ? 'too small' : report.size})`;
}

/** Says what was checked: a clear view means something only against the things it was tested with. */
function clearText({ others }) {
  if (others === 0) return 'no other things given';
  return others === 1 ? 'the 1 other thing is not in front' : `none of the ${others} other things in front`;
}

function frontText(report, group) {
  const [first, ...rest] = report.blockers, crossing = report.through.length ? `, ${quoted(report.through[0])} passes through it` : '';
  if (!first) return `${clearText(report)}${crossing}`;
  const others = unique(rest.map((b) => b.name)).filter((n) => n !== first.name).length;
  return `${quoted(first.name)} covers ${covered(first.share)} of ${group ? quoted(first.of) : 'it'}${others ? `, ${others} more in front` : ''}${crossing}`;
}

function facingText(report) {
  const kinds = report.faults.filter((q) => q.kind === 'edge-on' || q.kind === 'back');
  return kinds.map((q) => `${quoted(q.on)} ${q.kind === 'back' ? 'shows its back' : 'is edge-on'}`);
}

const isReport = (r) => r !== null && typeof r === 'object' && Array.isArray(r.on) && Array.isArray(r.rows) && Array.isArray(r.faults) && Array.isArray(r.blockers) && Array.isArray(r.through);

/**
 * The line: `shot "name" from front-left high (2.6 m, lens normal): in frame 100%, 41% of height (medium), none of the 3 other things in front, sharp`.
 * A fault's fix follows the dash. `about` before a view means the camera stands near that view, not on it. `label` leads the line in quotes, as data, its hidden characters gone. With no fault, the part about what stands in front says how many other things it was tested against.
 */
export function shotLine(report, { label } = {}) {
  if (!isReport(report)) throw new TypeError('shotLine(report) takes what checkShot returned');
  const group = report.on.length > 1, lead = typeof label === 'string' ? cutName(cleanName(label.slice(0, 1024)), MOST_LABEL) : '';
  const place = report.depth === null ? '' : `${figure(report.depth)}${report.unit ? ` ${report.unit}` : ''}, `;
  const head = `${lead ? `${quoted(lead)} ` : ''}shot ${subjectText(report.on)} from ${report.exactView ? '' : 'about '}${report.from} (${place}lens ${report.lens})`;
  const lost = report.rows.filter((r) => r.state !== 'seen').map((r) => `${group ? `${quoted(r.name)} ` : ''}${STATES[r.state]}`);
  const parts = [...lost];
  if (report.rows.some((r) => r.state === 'seen')) {
    parts.push(frameText(report, group));
    if (report.rows.some((r) => r.inFrame > 0)) {
      parts.push(sizeText(report), ...facingText(report), frontText(report, group));
      parts.push(report.faults.some((q) => q.kind === 'soft') ? `soft (${Number(report.blur.toPrecision(2))} px)` : 'sharp');
    }
  }
  const fixes = unique(report.faults.map((q) => q.fix));
  return `${head}: ${parts.join(', ')}${fixes.length ? ` — ${fixes.join('; ')}` : ''}`;
}
