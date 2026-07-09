# Needs System

**Version:** 0.2.0 (architecture review revisions applied: Safety/Station-Survival boundary clarified, Purpose observability requirement expanded, conceptual Need Interaction section added)
**Phase:** Phase 2 — Design
**Authority:** ADR-01 through ADR-16 (Accepted); design/colonist-agent-model.md v0.2.0 (Approved); design/colony-life.md; ai-studio/constitution/glossary.md
**Scope:** Conceptual definition of the Need System — what needs are, what categories exist, how they express to the player, and where the system's boundary lies.

**This document does not define:** degradation formulas, threshold values, satisfaction rates, decision algorithms, data structures, or TypeScript. Those belong to ADR-17 (Need System Architecture, deferred) and the Phase 2 engineering specification.

---

## Purpose

Needs are the pressure system inside every colonist. They are the reason a colonist gets up, eats, rests, seeks company, and — when conditions fail them — deviates from what the player's shift policy expects.

The Need System exists to do three things:

**1. Generate urgency.**
A need that decays without satisfaction builds pressure. That pressure is what drives a colonist's priority resolution (ADR-01): an unmet need eventually overrides lower-priority goals. Without needs, colonists are rule-followers with nothing at stake. With needs, every colonist is continuously balancing what the colony asks of them against what their own body and mind require.

**2. Make the player's conditions consequential.**
The player never satisfies a need directly. The player builds the food station, sets the shift policy that does or does not allow adequate rest, designs the station whose spaces do or do not permit social contact. Needs are how those conditions land on individual people. A shift policy that looks reasonable on paper and starves colonists of rest will express itself — gradually, visibly — through the Need System.

**3. Produce legible deviation.**
The observation loop (core-loop.md) depends on deviations being readable against the shift baseline. Need-driven deviations are the most common and most teachable deviation type: a colonist at a food station mid-shift is a low-urgency need being satisfied; a colonist abandoning their post at speed is a critical override. The Need System is the primary generator of the signals the player learns to read in their first hour.

Needs are not a survival meter for the player to top up. They are the mechanism by which colonists remain people under the player's conditions.

---

## Design Principles

**P1 — One system, many needs.**
There is a single general Need system that handles every need the same way: a level that decays over time, thresholds that generate urgency, and satisfaction through appropriate conditions. There is no separate hunger logic, sleep logic, or social logic (constitution Principle 4, Systems Over Scripts). Individual needs differ in their parameters and their satisfaction sources — not in their mechanics.

**P2 — Needs generate urgency; they do not select behavior.**
A need crossing a threshold raises the priority of satisfying it (ADR-01 tiers 2 and 4). What the colonist actually does about it — which action, which location, when — is the decision loop's job, not the Need System's. The Need System is an input to decisions, never a decision-maker.

**P3 — Two urgency thresholds: low and critical.**
Per ADR-01, every need has a low threshold (colonist seeks satisfaction at the shift's next available moment, without disrupting the assignment) and a critical threshold (colonist overrides the shift assignment immediately). The threshold values are ADR-17 scope; the two-level structure is settled architecture and this system conforms to it.

**P4 — Every need must be observable.**
A need that affects the simulation but produces no player-visible behavior is an invisible parameter, and invisible parameters violate Legible Complexity. Every need must express through at least one channel the player can read: an ambient behavioral state (ADR-05 Tier 1), a hover summary (Tier 2), or the inspector with history (Tier 3). Needs whose satisfaction is visible (Eating, Resting) express at Tier 1. Needs whose pressure is internal express through the Stressed state and through the inspector.

**P5 — Needs decay against the clock; traits modify the rates.**
Need decay is driven by in-game time (ADR-02) at rates uniform across colonists at baseline. Traits (ADR-10) modify individual rates and thresholds — a resilient colonist's stress-adjacent needs decay more slowly; a social colonist's social need decays faster. Rate values are ADR-17 scope; the structure (clock-driven, trait-modified) is settled.

**P6 — Needs are satisfied by conditions, not by the player.**
No player action directly restores a need level. The player creates the conditions under which a colonist can satisfy their own needs: a functioning food supply, a shift with adequate rest time, a station where social contact is possible. If a need is chronically unmet, the cause is always a condition — and the condition is always traceable (Pillar: Conditions, Not Commands; Principle 6, Explainable AI Decisions).

**P7 — Stress is not a need.**
Stress is an emergent condition that accumulates from unmet needs, hostile relationships, crisis exposure, and overwork (colonist-agent-model.md, Short-Term State). It has no satisfaction action of its own — it dissipates when its sources resolve. Modeling stress as a need (something with a "satisfy stress" action) would flatten it into a meter to be topped up. It stays outside the need taxonomy, downstream of it.

---

## Need Categories

The needs divide into two categories with structurally different escalation paths. This is the central conceptual decision of this document.

### Category A — Biological Needs

Biological needs are the needs of the body. They are the only needs that can reach the critical threshold and trigger an immediate shift override (ADR-01 priority 2 names "critical biological need" explicitly). A body that is starved of food or sleep eventually stops cooperating with the schedule regardless of the colonist's character, relationships, or commitment.

| Need | What it is | Primary satisfaction condition |
|---|---|---|
| **Hunger** | The need for food | Access to a functioning food station with available food supply |
| **Rest** | The need for sleep and physical recovery | Access to a rest area during adequate rest time |

Biological needs have both thresholds active: low (satisfy at next opportunity — the mid-shift food station stop from colony-life.md) and critical (immediate override — the colonist abandoning their post, critical icon visible).

### Category B — Psychological Needs

Psychological needs are the needs of the person. They do not trigger shift overrides. A lonely colonist does not abandon their post to find company; an unsafe-feeling colonist does not flee mid-task. Instead, chronically unmet psychological needs escalate through **stress accumulation**: they are among the primary inputs to the colonist's stress level, and stress is what eventually becomes visible behavior (the Stressed state, ADR-05) and behavioral threshold crossings (story events, ADR-08).

| Need | What it is | Primary satisfaction condition |
|---|---|---|
| **Safety** | Long-term psychological security — the accumulated sense that the environment can be trusted | Station conditions over time: sustained module health, life-support stability, absence of recent crisis exposure |
| **Social** | The need for contact and belonging | Opportunity for interaction with other colonists — free time, shared spaces, non-hostile companions. The vocabulary of satisfying interactions is ADR-18 scope. |
| **Purpose** | The need for one's work and presence to matter | Meaningful assignment: work matching the colonist's skills, visible contribution, not being chronically idle or chronically misassigned |

**Safety is not immediate physical danger.** Immediate danger — depressurization, oxygen failure, active life-support collapse — belongs to Station Survival (ADR-01 priority 1), which overrides all behavior for all colonists with no exceptions. The Safety need is what remains after the danger passes: the long-term psychological security of living in a station that has or has not proven trustworthy. A colonist in a depressurizing module is responding to Station Survival, not to a need. A colonist whose Safety need is low weeks after a crisis, in a station whose modules keep drifting into Warning state, is carrying the accumulated experience of an environment that keeps threatening them. The first is an event; the second is a condition. The Need System models only the second.

**Purpose must be observable through behavior — always.** Purpose is the most abstract need in the taxonomy, and it carries a hard legibility requirement: the player must always be able to observe Purpose indirectly through colonist behavior. Purpose must never become a hidden score whose only existence is a number in the inspector. A colonist whose Purpose is satisfied shows it: engagement in their work, willingness in their movement toward assignments, the small voluntary behaviors of someone whose presence matters — staying slightly past a shift boundary to finish something, gravitating toward their workspace during free time. A colonist whose Purpose is eroding shows that too: hesitation in the walk to work, idling where there should be engagement, the drift of someone going through the motions before the Stressed state ever appears. These expressions must read through the existing ADR-05 behavioral repertoire and its movement/posture textures — no new ambient state is introduced. If an implementation of Purpose cannot produce these observable differences, it has failed this requirement — a Purpose need with no visible behavioral consequences must not ship (see Risk 2).

The two escalation paths are deliberate and produce different player experiences:

- **Biological deprivation is fast and loud.** The player sees the deviation within the same shift or the next. The lesson is immediate: the conditions did not permit this body to function.
- **Psychological deprivation is slow and quiet.** It surfaces days later as a Stressed colonist, declining work quality, a relationship turning tense. The player who traces the stress back through the inspector finds the unmet need underneath. This is the game's harder, deeper teaching: the colony's people-problems have people-causes.

### What is deliberately not in the taxonomy

- **Stress** — emergent condition, not a need (Principle P7).
- **Health / injury** — physical harm is not modeled as a decaying need. If Phase 2+ introduces injury or illness, it enters as its own system, not as a need entry.
- **Oxygen / warmth as personal needs** — life support failure is a station survival condition (ADR-01 priority 1), which overrides everything including critical needs. Modeling breathable air as a personal decaying need would duplicate the survival priority with a slower, wrong mechanism. The station keeps colonists alive; the Need System keeps them functional and human.

This taxonomy — five needs, two categories — is the design-level commitment. ADR-17 may refine parameters, thresholds, and satisfaction mechanics within it; a change to the categories or the escalation-path structure requires revisiting this document.

---

## Need Interaction

Needs do not exist in isolation. This section describes which needs may conceptually influence each other — the directions of influence that ADR-17 may choose to model. No formulas, weights, or magnitudes are defined here; whether each influence is modeled at all, and how strongly, is ADR-17's decision (DQ-N2).

**All needs feed stress asymmetrically.**
The shared escalation path already establishes one interaction: chronically unmet psychological needs accumulate stress. Biological needs contribute too — sustained (not momentary) Rest or Hunger deprivation is a stress source. The asymmetry: psychological needs escalate *only* through stress; biological needs escalate through stress *and* through their own override thresholds.

**Rest deprivation may amplify everything else.**
Exhaustion is the plausible universal amplifier: a colonist short on rest may experience other deprivations more sharply — hunger bites harder, social friction registers as more threatening, the sense of purposelessness weighs more. If ADR-17 models any single cross-need coupling, this is the candidate with the strongest grounding and the clearest player story ("everything got worse when they stopped sleeping").

**Safety erosion may suppress psychological satisfaction.**
A colonist who does not feel secure may gain less from social contact and meaningful work — insecurity crowds out the higher needs. This is a one-directional influence: low Safety dampens Social and Purpose satisfaction; the reverse (low Social eroding Safety) is not proposed.

**Social context may modulate biological satisfaction quality.**
Eating alone versus eating among non-hostile companions is a candidate texture: the same meal may satisfy Hunger equally but contribute differently to Social. This is an interaction of *satisfaction opportunity* (one action touching two needs), not of decay rates — and its action-level detail is ADR-18 scope.

**Purpose and Social are adjacent but must remain distinct.**
Meaningful shared work plausibly touches both needs. The conceptual boundary: Social is about *who is around you*; Purpose is about *whether what you do matters*. A colonist can have rich social contact and no purpose (well-liked, chronically idle) or strong purpose and isolation (the indispensable engineer nobody talks to). Any modeled interaction must preserve the possibility of both configurations — they are two of the most story-productive colonist conditions this system can produce.

**What is excluded conceptually:** no interaction may create a hidden feedback loop the player cannot trace. Every modeled influence must be visible in the inspector's need history as a legible pattern (Principle 6). An interaction that makes need levels move for reasons the inspector cannot show is disqualified regardless of its simulation value.

---

## Observable Player Effects

Every need must be readable. This section maps each need to the visibility channels defined in ADR-05 (colonist) and colony-life.md.

### Tier 1 — Ambient behavior (always visible)

| Signal | Need | What the player reads |
|---|---|---|
| Colonist in **Eating** state during an appropriate moment | Hunger (low) | Normal — the system is managing itself |
| Colonist in **Eating** state at an unexpected time, or moving to food mid-shift | Hunger (low, deferred too long) | Shift policy or food access is not aligned with actual hunger patterns |
| Colonist abandoning a work assignment at speed, moving directly to food or rest | Hunger or Rest (critical) | Critical override — the always-visible critical icon is active |
| Colonist in **Resting** state during rest period | Rest (satisfying) | Normal |
| Colonist visibly not resting during rest period | Rest at risk, or psychological pressure | Free time is not producing recovery — worth inspecting |
| Colonist in **Socializing** state during free time | Social (satisfying) | Normal — and over time, the raw material of relationships |
| Colonist consistently alone during free periods, never Socializing | Social (chronically unmet) | The quiet early signal of isolation (colony-life.md OQ-6) |
| Colonist in **Stressed** state | Psychological needs (escalated), or biological strain | Pressure has crossed the behavioral threshold — the inspector will show which sources |

### Tier 2 — Hover

Hovering a colonist shows a categorical need summary: critical / low / normal for the colonist's most pressing needs (ADR-05). This is the player's quick answer to "is this deviation a need, and how urgent?" The player-facing names for needs in this summary are an open UI question (colony-life.md OQ-1) — the design-level names in this document (Hunger, Rest, Safety, Social, Purpose) are the working vocabulary until the UI design finalizes it.

### Tier 3 — Inspector

The colonist inspector shows all need levels with history (ADR-05). History is what makes causes traceable: a colonist whose Rest level has sawtoothed downward across five shifts tells the player the rest period is too short — a fact no single moment's reading could show. Need-driven decisions appear in the colonist decision log (ADR-14) with the need state at decision time, satisfying Principle 6: "left assignment — Rest critical" is a true, legible answer to "why did they do that?"

### Colony-level composition

At 24 colonists, need signals compose into colony reading. Many colonists eating at unexpected times → food access or shift design problem. Rising count of Stressed colonists with healthy modules → the strain is psychological, not infrastructural. One colonist's needs chronically worse than everyone else's under the same policy → the difference is the person (traits, relationships), not the policy. The Need System is designed so that the same signals that explain one colonist scale into diagnosis of the colony.

---

## System Boundaries

**B1 — The Need System does not select behavior.**
It produces need levels and urgency. Goal generation, task selection, and everything about how a colonist acts on an urgent need belong to the Goal System / Decision Loop design (colonist-agent-model.md DQ-1, DQ-3).

**B2 — The Need System does not define its numbers.**
Degradation rates, threshold values, satisfaction rates, trait modifier magnitudes — all ADR-17 scope. This document commits to the structure: five needs, two categories, two thresholds (biological) or stress-path escalation (psychological), clock-driven decay, trait-modified rates.

**B3 — The Need System does not define social actions.**
The Social need is satisfied through interaction, and the vocabulary of interactions — what colonists actually do together, initiation conditions, proximity rules — is ADR-18 scope (colonist-agent-model.md DQ-5). This document commits only to the fact that a Social need exists and escalates through stress when unmet.

**B4 — The Need System does not own stress.**
Needs are inputs to stress; stress itself (accumulation, dissipation, behavioral thresholds) is colonist short-term state defined in the Colonist Agent Model, with its dynamics to be specified alongside the decision loop. The Need System's responsibility ends at "unmet psychological needs feed stress."

**B5 — The Need System does not handle station survival.**
Depressurization, oxygen failure, and other survival conditions are ADR-01 priority 1 — a world-level override above the Need System entirely. No need models breathable air.

**B6 — Need levels are colonist-owned short-term state.**
Per the approved Colonist Agent Model: need levels live on the colonist, decay against the world clock, and are read by the colonist's own decision process. The Need System defines what those levels mean; it does not relocate them.

---

## Deferred Questions

Numbering continues this document's own sequence; owning documents are named per question.

**DQ-N1 — Degradation rates, thresholds, and satisfaction mechanics** *(deferred to: ADR-17)*
All numeric structure: how fast each need decays, where low and critical sit, how quickly satisfaction restores a level, how trait modifiers scale the rates. ADR-17 is the architectural home for these; the prototype validates them against the ~20-minute in-game day hypothesis (ADR-06).

**DQ-N2 — Cross-need interaction: which influences are modeled, and how strongly** *(deferred to: ADR-17)*
The Need Interaction section above defines the conceptual candidates: which needs may influence each other and in which direction. ADR-17 decides which of those candidate influences are actually modeled, and owns all magnitudes. Cross-need coupling deepens the simulation but multiplies tuning complexity; modeling none of them beyond the shared stress path is a legitimate ADR-17 outcome.

**DQ-N3 — Purpose need inputs** *(deferred to: ADR-17, with Goal System input)*
Purpose is the least concrete need: "meaningful assignment" requires defining what the simulation counts as meaningful (skill-matched work? completed tasks? visible outcomes?). The inputs to Purpose satisfaction depend on the task and goal structures and cannot be fixed before the Goal System design exists.

**DQ-N4 — Safety need inputs** *(deferred to: ADR-17)*
Which station conditions feed the Safety need, at what weights: module health states in the colonist's inhabited spaces, recent crisis exposure (via memory, ADR-16), witnessing other colonists in distress? The candidate inputs are named here; the selection and weighting are ADR-17 scope.

**DQ-N5 — Player-facing need vocabulary** *(deferred to: UI design; carries colony-life.md OQ-1)*
Whether the hover summary and inspector display the design-level names used in this document (Hunger, Rest, Safety, Social, Purpose) or a different player-facing vocabulary is a UI design question. This document's names are the canonical design vocabulary until then.

**DQ-N6 — Social need satisfaction accounting** *(deferred to: ADR-18)*
When colonists interact, what does the Social need actually credit — duration of proximity, type of interaction, quality as modified by relationship state? Requires ADR-18's action vocabulary. Until then, the design-level statement stands: non-hostile interaction opportunity satisfies the Social need; isolation and exclusively hostile contact do not.

---

## Risks

**Risk 1: Psychological needs are invisible until they are expensive**
The stress-path escalation means Safety, Social, and Purpose deprivation produce no dramatic early signal. That is the design intent — but it risks players never learning the connection between a Stressed colonist and the unmet need underneath. If the inspector's need history and the decision log do not make the trace obvious, psychological needs will read as random stress.
*Severity: High. Mitigation: the inspector must show need history in a form where a chronically low psychological need is visually undeniable; the decision log must name need states in stress-related entries. This is a hard requirement to carry into the inspector UI design.*

**Risk 2: The Purpose need becomes a black box**
Purpose is the most abstract need. If its inputs (DQ-N3) are poorly chosen, "Purpose: low" in the inspector will be an unexplainable number — precisely what Principle 6 forbids. A need the player cannot reason about is worse than no need.
*Severity: Medium. Mitigation: DQ-N3 must be resolved with explainability as the first criterion. If no legible input set can be found, cutting Purpose from Phase 2 is preferable to shipping it opaque — that decision point belongs to ADR-17.*

**Risk 3: Biological overrides erode the shift baseline**
If Hunger and Rest reach critical too often under normal policy, colonists constantly abandon assignments and the learnable shift baseline collapses (explicit risk in ADR-01). This is a tuning risk owned by ADR-17, but it is created by this document's structure: only calibration keeps critical overrides rare enough to stay signals.
*Severity: Medium. Mitigation: ADR-17 calibration target — under a reasonable default policy, critical overrides should be exceptional events, not daily texture.*

**Risk 4: Five needs may be the wrong count**
Too few needs and colonists feel mechanical; too many and the player cannot track what anyone requires. Five (two biological, three psychological) is a design judgment, not a validated number. The taxonomy also has known absences — no comfort, no privacy, no autonomy need — each of which some reference games model.
*Severity: Low-Medium. Mitigation: the two-category structure is the load-bearing commitment; adding or removing a need within a category is a bounded change. Prototype feedback drives any adjustment through a revision of this document.*

**Risk 5: The Social need pre-shapes ADR-18**
Committing to a Social need that is "satisfied by interaction opportunity" constrains ADR-18's design space before it is written. The constraint is intentional and minimal — ADR-18 still owns the entire action vocabulary — but any further specification of social satisfaction in downstream documents before ADR-18 exists would be scope creep of exactly the kind the Colonist Agent Model warned against (its Risk 1).
*Severity: Low. Mitigation: B3 boundary — no document other than ADR-18 defines social actions.*

---

## Decision Log

| Decision | Rationale | Alternatives Rejected |
|---|---|---|
| Two need categories with different escalation paths: biological → critical override; psychological → stress accumulation | ADR-01 priority 2 names "critical biological need" specifically; a lonely colonist abandoning their post reads as absurd, while a starving one reads as human. Two paths produce two teaching speeds: fast/loud for body, slow/quiet for person | Single category, all needs can trigger critical override (produces implausible behavior and floods the baseline with overrides); psychological needs with no escalation at all (invisible parameters — violates legibility) |
| Five-need taxonomy: Hunger, Rest, Safety, Social, Purpose | Matches the glossary's canonical examples; two-category structure holds; each need has a nameable satisfaction condition and at least one observable expression | Larger taxonomy with comfort/privacy/autonomy (untrackable at 24 colonists in Phase 2; can be added later within the category structure); minimal hunger+rest only (colonists reduce to biological machines; social texture would have no engine) |
| Stress excluded from the need taxonomy | Stress is emergent from unmet needs and conditions (colonist-agent-model.md); giving it a satisfaction action would flatten it into a meter and break the causal chain the post-mortem depends on | Stress as a sixth need with recovery actions |
| Oxygen/warmth excluded as personal needs | Life-support failure is ADR-01 priority 1 station survival — already the top override. A personal air-need would duplicate it with a slower, wrong mechanism | Oxygen as a fast-decaying personal need (double-models survival; produces colonists "deciding" whether to breathe) |
| Taxonomy committed at design level; all parameters deferred to ADR-17 | Freeze report boundary: design documents describe needs at design level, ADR-17 constrains implementation. Naming the taxonomy here gives ADR-17 and ADR-18 a stable target without deciding their scope | Deferring the taxonomy itself to ADR-17 (leaves every Phase 2 design document unable to reference any need — the shadow-decision risk the Colonist Agent Model flagged would guarantee implicit taxonomies anyway) |
| Health/injury excluded from the taxonomy | Physical harm is not a decaying-need shape; if introduced, it is its own future system | Injury as a need entry |
| Need interactions described conceptually (candidate influences and directions); all modeling decisions left to ADR-17 | Architecture review revision (accepted). Naming the candidates gives ADR-17 a bounded evaluation set; the "no untraceable feedback loop" exclusion protects Principle 6 regardless of which candidates ADR-17 adopts | Deferring interaction entirely with no conceptual guidance (ADR-17 would face an unbounded design space); committing specific couplings here (formula-adjacent decisions outside this document's scope) |

---

## Kanban Update

**Card:** [Phase 2] Design Needs System
**Status:** Accepted with minor revisions applied (architecture review 2026-07-09) — v0.2.0

**Completed:**
- ✅ design/needs-system.md — conceptual Need System within approved scope
- ✅ Architecture review revisions applied: Safety need explicitly distinguished from immediate physical danger (Station Survival, ADR-01 priority 1); Purpose need expanded with a hard behavioral-observability requirement (never a hidden score); conceptual Need Interaction section added (candidate influences only, no formulas — modeling decisions remain with ADR-17 via DQ-N2). Taxonomy unchanged.

**This document does not:**
- Define degradation formulas, threshold values, or satisfaction rates (ADR-17 scope)
- Define social action vocabulary (ADR-18 scope)
- Define decision algorithms or behavior selection (Goal System / Decision Loop scope)
- Introduce data structures, classes, or TypeScript

**Design commitments made:**
- Five-need taxonomy at design level: Hunger, Rest (biological); Safety, Social, Purpose (psychological)
- Two-category escalation structure: biological needs can trigger critical shift override (ADR-01 priority 2); psychological needs escalate through stress accumulation only
- Stress, health, and life-support explicitly excluded from the taxonomy

**Deferred questions raised:**
- DQ-N1: All numeric structure → ADR-17
- DQ-N2: Cross-need interaction → ADR-17
- DQ-N3: Purpose need inputs → ADR-17 (with Goal System input)
- DQ-N4: Safety need inputs → ADR-17
- DQ-N5: Player-facing need vocabulary → UI design (carries colony-life.md OQ-1)
- DQ-N6: Social satisfaction accounting → ADR-18

**This document unblocks:**
- ADR-17 — Need System Architecture (now has a stable design-level taxonomy to constrain)
- ADR-18 — Social Action Space (Social need's design-level role is defined)
- Inspector UI need-display design (pending DQ-N5)

**Follow-up tasks:** None beyond the deferred questions above.
