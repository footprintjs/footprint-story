/**
 * How a model is chosen for an intent, as data: a first-match table in the shape of footprintjs decide() rules —
 * `{when: {fact: {op: value}}, then, label}` — read over the intent's facts. WHY data, not an if: the choice lands on a
 * record as the rule that matched and its words (the intent decider, src/human/intents/), and a reader or a test reads
 * the table, not the code. planMove (registry.js · chooseModel) and the decider read this one table, so they never
 * choose apart.
 *
 *   facts        {do, family, named: true when the intent names a model, usual: its family's usual model, or null}
 *   CHOOSE_RULES → 'named' (the model the intent names) | 'usual' (its family's usual); no rule matches → refused
 *
 * The family is the other half of the choice, and data too: registry.js · HUMAN_DOS, the family each `do` word means.
 */

/** The ops a rule's test may use: the two the table needs, as decide()'s are named. */
const OPS = Object.freeze({ eq: (a, b) => a === b, ne: (a, b) => a !== b });

const rule = (when, then, label) => Object.freeze({ when: Object.freeze(Object.fromEntries(Object.entries(when).map(([k, t]) => [k, Object.freeze(t)]))), then, label });

/** The rules, first match wins. */
export const CHOOSE_RULES = Object.freeze([
  rule({ named: { eq: true } }, 'named', 'the intent names its model'),
  rule({ usual: { ne: null } }, 'usual', "the intent names none: its family's usual"),
]);

/** The first rule whose every test holds of `facts`, or null. */
export function firstRule(rules, facts) {
  return rules.find((r) => Object.entries(r.when).every(([key, test]) => Object.entries(test).every(([op, value]) => OPS[op](facts[key], value)))) ?? null;
}
