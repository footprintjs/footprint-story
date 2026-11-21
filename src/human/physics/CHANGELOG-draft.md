### Added — light physics and secondary motion (`footprint-story/human`)

- **Models** for the families `throw`, `fall` and `hang`, in the design's one interface (`PHYSICS_MODELS`):
  `throw · ballistic`, `throw · bounce`, `fall · ballistic`, `fall · bounce`, `hang · verlet`. An intent gives a plan
  (plain frozen data with its duration, decided by the physics) and `sample(plan, t)` gives `{x, y, angle?, sx?, sy?, points?}`.
  The usual apex is a 45° throw; a chain's time is how long it swings, until it has been still for half a swing.
- **Wrappers** over any model's plan: `anticipate`, `followThrough`, `hold`, `overshoot` (`PHYSICS_WRAPPERS`), read
  with `sampleWrapped(plan, t, model.sample)`. A wrapped plan is `{wrapper, duration, inner, …its numbers}`; each keeps
  the inner's start and end exactly and adds the time it states.
- **Critics** `spacing`, `volume`, `contact` (`PHYSICS_CRITICS`), measured on a track (`trackOf(plan, sample)`), each
  finding naming the entry and the fix in the intent's keys.
- **The parts underneath**, for a tool's own model: a fixed step (1/240 s) with position Verlet (`verletStep`,
  `simulate`), ballistic flight (`launch`, `flightAt`, `fallSeconds`), bounces (`bounces`), Verlet chains with a pinned
  end (`runChain`, `relax`, `pinAt`; Jakobsen 2001), a floor and boxes (`makeWorld`, `pushOut`, `collide`, `depthIn`),
  settling on the package's spring (`settleLeft`, `settleSeconds`), seeded numbers (`seededRandom`).
- Bounds: plans at most 30 s, chains at most 64 links of at least 4 px and 10 s, 32 boxes, 24 bounces, 4 wrappers deep,
  tracks of 7200 samples. Every refusal starts `human:` and names the entry and the fix.
