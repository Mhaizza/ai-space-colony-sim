# Vision

## Project Mission

Build a sci-fi space colony simulation where every colonist is a living, autonomous AI agent — not a stat block with a mood bar. The player does not control colonists directly. The player shapes the conditions in which colonists make their own decisions, form relationships, pursue goals, and sometimes die trying.

---

## Player Fantasy

> "I built the life-support system, rationed the oxygen, and promoted the right engineer — but the colony still nearly collapsed because two colonists fell in love and one of them refused to take the night shift."

The player is a **colony architect and crisis manager**, not a puppet master. Their power is environmental and systemic. The drama emerges from the agents, not from authored scripts.

---

## Long-Term Vision

A simulation deep enough that no two playthroughs produce the same colony culture. Colonists develop persistent memories, form factions, fall into routines, and break those routines when conditions push them to. The player looks back at a collapsed colony and can trace exactly why it failed — not because the game told them, but because the logic was always visible.

Milestones:
1. **Alpha** — Single station, ~20 colonists, core needs loop (oxygen, food, power, rest), colonist decision-making visible to player.
2. **Beta** — Relationships, factions, crises, AI Director managing emergent story beats.
3. **1.0** — Multiple stations, intercolony politics, full save/load, mod support for new agent traits and modules.

---

## What Makes This Game Unique

| Feature | How others do it | How we do it |
|---------|-----------------|--------------|
| Colonists | Stat-driven pawns | Autonomous agents with memory, motivation, and social relationships |
| Drama | Authored events | Emergent from agent interactions and resource pressure |
| AI transparency | Black box | Every agent decision is inspectable and explainable |
| Player role | Direct control | Environmental design + crisis response |
| Failure | Game over screen | Traceable collapse — players understand why |

---

## Target Audience

**Primary:** Strategy and management players who have felt that colony sims are "too mechanical" — who wanted Dwarf Fortress's depth but found it opaque, or wanted RimWorld's stories but felt the randomness was too scripted.

**Secondary:** Players interested in AI and emergent systems — people who will open the agent inspector not because they have to, but because they want to.

**Not our audience:** Players seeking fast action loops, power-fantasy progression, or tightly authored narrative.

---

## Success Criteria

### Creative
- A player can describe a specific colonist's personality after 30 minutes of play without reading a tooltip.
- Two playthroughs of the same starting conditions produce meaningfully different colony cultures.
- A colony failure is always explainable in plain language.

### Technical
- Support 20–50 colonists with deterministic simulation updates. Exact tick rate and time scale will be defined in a future ADR.
- Save/load round-trips with zero simulation state loss.
- Any agent decision can be inspected and its reasoning displayed to the player.

### Product
- Players voluntarily share colony stories (screenshots, writeups) without being prompted.
