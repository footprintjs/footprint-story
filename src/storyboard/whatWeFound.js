/**
 * what-we-found: what a piece of work or a conversation came to, in the order a reader asks: what was looked at, what was
 * found, what is still not known, what happens next. A claim names the messages it rests on, and "not sure" has a part of
 * its own, and must be written even when it is empty, so a story cannot sound surer than the work was.
 */
import { MOST, readLabels } from './words.js';
import { deepFreeze } from './fields.js';
import { checkAnywhere, checkClaim } from './conversation.js';

const LABELS = Object.freeze({ checked: 'What we checked', found: 'What we found', unsure: 'What we are not sure about', next: 'What happens next' });

function readSources(f, value, at) {
  return f.list(value, 'sources', at, { most: 12, optional: true }).map((_, i, all) => f.text(all, i, `${at}.sources`, { most: MOST.source })).filter(Boolean);
}

export const whatWeFound = Object.freeze({
  name: 'what-we-found',
  checksClaims: true,
  about: 'What a piece of work or a conversation came to: what was checked, what was found, what is still not known, what happens next. Claims name their sources, and a number must be in a source.',
  writing: Object.freeze([
    'Say only what the conversation holds, and add no facts of your own.',
    'Each checked and found entry names the ids of the messages it rests on in sources.',
    'Use only numbers found in those messages, in plain digits. Anything that cites nothing uses only numbers found somewhere in the conversation.',
    'Say what is still not known in unsure, and write [] only when nothing is: a story must not sound surer than the work was.',
  ]),
  fills: deepFreeze({
    shape: 'what-we-found', title: 'Why the nightly job slowed down', subtitle: '(optional)', intro: 'what is said on the title',
    checked: [{ what: 'Disk space', found: '40% full, so not the cause', notes: '(optional) what is said', sources: ['m3'] }],
    found: [{ headline: 'The job waits on a lock', line: 'It waited 41 minutes on 3 nights', notes: 'what is said', sources: ['m7', 'm9'] }],
    unsure: [{ what: 'Whether Tuesday had the same cause', why: 'there are no logs from that night', notes: '(optional) what is said' }, '… or [] when nothing is, which you must say'],
    next: ['1 to 4 things that happen next'], closing: 'what is said at the end',
    labels: { checked: '…', found: '…', unsure: '…', next: '…' },
  }),

  read(f, input, base, conversation) {
    const labels = readLabels(f, input, base.lang, LABELS);
    const checked = f.list(input, 'checked', '', { least: 1, most: 6 }).map((v, i) => {
      const at = `checked[${i}]`, c = f.object(v, at, ['what', 'found', 'notes', 'sources']);
      if (!c) return null;
      const what = f.text(c, 'what', at, { most: MOST.line }), found = f.text(c, 'found', at, { most: MOST.headline }), notes = f.text(c, 'notes', at, { most: MOST.notes, optional: true }), sources = readSources(f, c, at);
      checkClaim(f, conversation, at, [what, found, notes].filter(Boolean).join(' '), sources);
      return { id: `checked-${i + 1}`, part: 'checked', look: null, title: found, narration: notes ?? (what && found ? `${what}: ${found}` : null), beat: { kind: 'card', group: 'checked', tone: null, name: what, line: found, sources } };
    });
    const found = f.list(input, 'found', '', { least: 1, most: 3 }).map((v, i) => {
      const at = `found[${i}]`, c = f.object(v, at, ['headline', 'line', 'notes', 'sources']);
      if (!c) return null;
      const title = f.text(c, 'headline', at, { most: MOST.headline }), line = f.text(c, 'line', at, { most: MOST.line }), notes = f.text(c, 'notes', at, { most: MOST.notes }), sources = readSources(f, c, at);
      checkClaim(f, conversation, at, [title, line, notes].filter(Boolean).join(' '), sources);
      return { id: `found-${i + 1}`, part: 'found', look: null, title, narration: notes, beat: { kind: 'card', group: 'found', tone: 'ok', name: line, line: null, sources } };
    });
    const unsure = f.list(input, 'unsure', '', { most: 3 }).map((v, i) => {
      const at = `unsure[${i}]`, c = f.object(v, at, ['what', 'why', 'notes']);
      if (!c) return null;
      const what = f.text(c, 'what', at, { most: MOST.headline }), why = f.text(c, 'why', at, { most: MOST.line }), notes = f.text(c, 'notes', at, { most: MOST.notes, optional: true });
      checkAnywhere(f, conversation, at, [what, why, notes].filter(Boolean).join(' '));
      return { id: `unsure-${i + 1}`, part: 'unsure', look: null, title: what, narration: notes ?? (what && why ? `${what}: ${why}` : null), beat: { kind: 'card', group: 'unsure', tone: 'warn', name: why, line: null, sources: [] } };
    });
    const points = f.list(input, 'next', '', { least: 1, most: 4 }).map((_, i, all) => f.text(all, i, 'next', { most: MOST.point }));
    const intro = f.text(input, 'intro', '', { most: MOST.notes }), closing = f.text(input, 'closing', '', { most: MOST.notes });
    for (const [at, text] of [['title', base.title], ['subtitle', base.subtitle], ['intro', intro], ['closing', closing], ...points.map((p, i) => [`next[${i}]`, p]), ...Object.entries(labels).map(([key, word]) => [`labels.${key}`, word])]) if (text) checkAnywhere(f, conversation, at, text);
    return {
      labels,
      scenes: [
        { id: 'title', part: 'title', look: null, title: base.title, narration: intro, beat: { kind: 'title', subtitle: base.subtitle } },
        ...[...checked, ...found, ...unsure].filter(Boolean),
        { id: 'next', part: 'next', look: null, title: labels.next, narration: closing, beat: { kind: 'points', points } },
      ],
    };
  },
});
