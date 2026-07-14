# Crystal System — hidden emotional graph

> Source of truth for the emotional layer. Mirrors `src/game/simulation/emotionalGraph.ts`. Supersedes the root `EMOTIONAL_SYSTEM.md` (kept as a short historical note).

## 1. Principle

The emotional layer is **hidden and state-based** — never a set of visible numeric meters. The player reads their whole interior through **one crystal** above the producer's head. This preserves the design pillar "emotion is a system, not a meter."

## 2. Nodes

Seven `EmotionalVariable` nodes, each in one of three states — `low`, `steady`, `high`:

`loneliness · burnout · hope · love · obsession · addiction · creativeFlow`

**Initial state** (`INITIAL_EMOTIONAL_GRAPH`): loneliness `high`, burnout `steady`, hope `low`, love `low`, obsession `steady`, addiction `low`, creativeFlow `low`. The producer starts isolated and low on hope — the game is about moving out of that.

## 3. Propagation

A resolution step (`resolveEmotionGraph`) does two things in order:

1. Apply the action's `emotionalEffects` (shift named nodes up/down one state).
2. Apply **one** propagation pass over the directed relationship graph.

Each shift moves a node one step along `low → steady → high` (clamped). No emotional quantity is ever stored as a number.

### Relationship edges (`EMOTIONAL_RELATIONSHIPS`)

| When source is | it pushes | direction |
|---|---|---|
| burnout `high` | creativeFlow | down |
| loneliness `high` | obsession | up |
| love `high` | hope | up |
| hope `low` | burnout | up |
| creativeFlow `high` | hope | up |
| addiction `high` | love | down |
| obsession `high` | burnout | up |

These form the feedback loops that make coping choices matter: isolation → obsession → burnout → loss of flow; while love → hope and flow → hope pull the other way.

## 4. The crystal read-out

`crystalState(graph)` compresses the graph to one of three colors (`CrystalState`):

- **red** — if hope is `low`, **or** loneliness is `high`, **or** burnout is `high`. (Any single alarm shows red.)
- **green** — only if hope `high` **and** love `high` **and** loneliness `low` **and** addiction ≠ `high`. (Every anchor must be in place.)
- **yellow** — everything in between.

Green is deliberately hard to reach and easy to lose: it is the gate for finishing the album.

## 5. Consequences (drift)

`emotionalNeedDrift(graph)` turns emotional state into felt gameplay pressure on the six needs — see [Gameplay.md](Gameplay.md) §2. This is the only channel by which the hidden layer touches the visible one, keeping cause and effect indirect but real.

## 6. When resolution happens

- **On interaction:** every object interaction resolves the graph with that object's effects.
- **During work:** every 15 worked minutes the DAW loop resolves with `creativeFlow ↑, burnout ↑, obsession ↑`.

## 7. Design rules for extending

- Add nodes/edges as data in `emotionalGraph.ts`; never inline emotional math into components or the store's `tick`.
- Keep the crystal a *pure read* of the graph. Never set the crystal directly.
- New consequences belong in `emotionalNeedDrift`, keeping the hidden→visible boundary single-channel.
