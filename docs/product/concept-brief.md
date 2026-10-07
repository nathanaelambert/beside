# beside — working concept brief

This brief consolidates the decisions from the first guided brainstorming session. The original [app description](app-description.md) remains the source of the initial idea. This is a product concept, not a finished specification; provisional mechanics and open questions are identified below.

## TL;DR / working elevator pitch

**Beside helps friends make shared activities part of their lives, even across distance and different schedules. Read a book together, build an exercise habit, or explore a shared interest—each at your own pace. As you participate, you earn decorations and keepsakes for a shared pixel-art world that reflects your experiences together.**

It is an async-first platform combining flexible activity logging, close-friend interaction, and RPG-inspired progression. Real-time experiences can complement it when people happen to be online together.

## Why it exists

Friends already make plans in places like WhatsApp, but those intentions get buried among everyday conversations. Distance and different schedules also remove the casual experience of bumping into a friend and hearing what they have been doing.

Beside gives shared intentions a lasting home. Friends encounter traces of each other’s participation when they return, even if they are never online at the same time. The priority is doing things with people you already know. Optional discovery and personal updates are secondary.

## Connections and shared spaces

- A connection is a shared context between two or more people. Two-person connections are the primary scenario; groups are also intended.
- Each connection has its own shared space, represented as a pixel-art world.
- A user can belong to multiple separate connections: A–B, A–C, and A–B–D, for example.
- One shared space can contain multiple activity types without dividing them into geographical regions. A group may also choose a narrow focus, such as travelling.
- Progress across the connection’s activities contributes to its shared world and reward pool. Connection progression is central, rather than individual character levelling.
- Personal profiles hold individual activity history; each connection also has its own history and shared space.

## Flexible activities

“Together” can mean sharing a practice, such as reading regularly, or sharing a specific experience, such as reading the same novel. Both belong in beside.

Activities are user-definable. Reading, exercise, cooking, and similar categories are templates rather than a fixed set of supported types.

- Creation requires a name. Description, milestones, and schedules are optional and editable later.
- The creator chooses whether other participants join immediately or receive invitations.
- Either participant can add milestones as needed, including while leaving a note.
- Milestones can be ordered or independent. Ordered milestones can offer a shortcut to mark earlier ones complete, without assuming they were completed.
- Templates suggest what participation means: effort, consistency, milestones, completion, or a combination. Users can adapt those rules.
- Personal targets can differ. Meeting a twice-weekly exercise commitment can count equally to meeting another participant’s four-times-weekly commitment.

## Participation, notes, and presence

Progress is self-reported. Reaching milestones is acknowledged as an individual achievement, even when friends move at different speeds.

Notes and discussion prompts can be attached to milestones. Their contents remain hidden until the recipient reaches that milestone, with an explicit option to reveal early. Revealing a note does not change recorded progress.

In the game-like interface, a red information marker above a friend’s avatar signals an update to a shared activity. A gray marker signals an optional update outside shared participation. The avatar makes an absent friend’s participation visible when someone returns.

## Logging and audience

Recording participation and sharing it are separate choices. A user can share a log with all relevant connections, selected connections, or none for now, and can share later.

One real-life session can contribute to multiple relevant shared activities. Each evaluates the session against its own rules and targets; the session is counted once per applicable activity.

For each selected connection, the user can see the activity receiving progress credit or choose to share the log as an update only. Sharing an update does not automatically earn credit.

## Mutual growth and rewards

Individual participation matters, but mutual participation earns substantially more growth. Slow solo earning is acceptable. Friends do not need to make progress on the same book or activity: contributions across their connection feed its growth.

Partial participation earns credit. Meeting both personal targets earns substantially more. Extra effort is recorded and celebrated, but cannot substitute for the other person’s participation in the target-based calculation.

### Provisional formula for two-person target-based habits

Let `pA` and `pB` be progress against each person’s own target, expressed from 0 to 1 and capped at 1:

`shared credit = 20 × ((pA + pB) / 2) + 80 × min(pA, pB)`

| Person A | Person B | Shared credit |
|---|---|---:|
| 100% | 0% | 10 |
| 50% | 50% | 50 |
| 100% | 75% | 77.5 |
| 100% | 100% | 100 |

The weighting is a working starting point. A decoration costing 100 credits was illustrative, not a settled economy. Group formulas and rules for other activity structures remain open.

Targets can change for future periods without rewriting past results. Credit accumulates in a connection-owned pool. Either participant can buy and place decorations; moving them is free. Purchases appear in shared history, and unused decorations can be returned for a full refund.

Activity streaks are optional and can break according to their configured rules. Previously earned progress and rewards remain available.

## Decorations, keepsakes, and history

Ongoing participation earns decorations. Choosing a tree repeatedly can eventually create a forest. The forest is a visual goal users choose; individual trees do not need a progressive growth mechanic.

Specific experiences can also become commemorative keepsakes:

- Each participant explicitly marks themselves finished; completing every milestone is not mandatory.
- When everyone finishes, a shared keepsake is created by default. The celebration remains available for participants returning later.
- A simple default object can be used initially, with more choices as the pixel-art library expands. The attached history remains meaningful regardless of appearance.
- Either participant can place the keepsake and move it later.
- If someone abandons an activity, existing contributions and history remain. There is no default finished-together keepsake, but users can choose to commemorate the experience with an object. Its history accurately reflects each person’s outcome.

Selecting a keepsake opens the associated activity history. Conventional timelines, lists, and collections provide access to milestones, notes, discussions, and completion dates alongside the visual world.

## Core experience

1. Bring a shared intention or habit into a connection.
2. Participate at your own pace and record meaningful progress.
3. Encounter your friend’s updates and milestone-linked notes.
4. Earn shared credit and decorate your shared space together.
5. Revisit experiences through keepsakes and their attached history.

## Still to explore

- Reward rules for groups, non-target activities, and different activity combinations; avoiding rewards for merely splitting one session into many logs.
- Group membership changes and their effect on completion, permissions, and progression.
- Exact handling of later sharing, audience changes, edits, and credit already awarded.
- Object catalog, prices, keepsake customization, and the details of returns and shared editing.
- How activity-linked games and real-time features enrich the core experience.
- First-use flow, accessibility, notification preferences, and the balance between game-world navigation and conventional UI.
- Initial release scope. This brief describes the intended concept, not an agreed MVP.
