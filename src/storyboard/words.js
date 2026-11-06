/** The words a shape keeps as limits, and the labels of its parts. */

/** The most characters each kind of text may be, so what a model writes fits what a film or a deck can show. */
export const MOST = Object.freeze({ title: 90, subtitle: 120, headline: 120, notes: 1000, name: 40, line: 70, callout: 140, call: 24, point: 90, analogy: 58, label: 40, icon: 40, id: 40, source: 80 });

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
/** An item's id: lower case letters, digits and dashes, so a tool can name a piece or a scene by it. */
export const isSafeId = (id) => typeof id === 'string' && SAFE_ID.test(id) && id.length <= MOST.id;

/** A part's labels: each one given, else the shape's English default. Another language gives its own: English words on a slide of another language would be wrong. */
export function readLabels(fields, input, lang, defaults) {
  const given = input.labels === undefined ? {} : fields.object(input.labels, 'labels', Object.keys(defaults)) ?? {};
  const english = !lang || /^en(-|$)/i.test(lang);
  return Object.fromEntries(Object.entries(defaults).map(([key, word]) => {
    const own = fields.text(given, key, 'labels', { most: MOST.label, optional: true });
    if (!own && !english && !fields.problems.some((p) => p.at === `labels.${key}`)) fields.say(`labels.${key}`, `is needed: this story is in "${lang}", and the label is "${word}" in English`);
    return [key, own ?? word];
  }));
}

/** Whether a text says a name: as a whole word, in any case, so "API" is not found in "rapid". */
export function saysName(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}
