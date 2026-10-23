# Milestones, logs, and shared rewards

Implemented in the playground from Nathaniel and Mosaab's entity discussion on 2026-10-20. Source: [`docs/entities.md` on `docs/entities`, commit `51fe15b`](https://github.com/nathanaelambert/beside/blob/51fe15b/docs/entities.md). The original draft also discusses reward-type logging policies and leaves strict-policy failure behavior unresolved.

A milestone is the smallest loggable achievement in an activity: one chapter, one episode, one workout day. Every **new** log references exactly one milestone and records success or failure. A successful `(milestone, user)` pair is unique. Recording Chapter 5 never silently completes Chapters 1–4. Progress credit belongs only to the milestone's own activity.

## Home bases and items

The existing playground `connections` rows serve as home bases, with `memberships` as the user/home-base map. This keeps existing experiment references stable. Each user also has one personal home base. Shared activities use their `connectionId`; personal activities resolve their owner's personal home base. The ERDs and SQL call these models `homebase` and `homebase_member`.

An item is the reusable `@beside/rewards` catalog definition, including its pixel-art artifact. A reward is a separate record referencing `itemId` and `homebaseId`, plus `obtainedAt` and a saved `requiredUserIds` roster. A milestone optionally references that reward. Its ownership belongs to the whole home base, with no per-user duplicate items or generic currency. Temporary catalog placement remains a preview, independent of earned rewards.

## Milestone zero

Creating an activity first creates exactly one root milestone, whose `parentId` is its own ID and whose `kind` is `join`. A successful milestone-zero log is then recorded automatically for every participant in the same transaction, with origin `automation`. All activity participants start active without manually logging or accepting an invitation. A personal activity initializes its owner; a shared activity initializes all of its home-base members.

Milestone zero is the first milestone and initial log for every participant. Its automatic success initializes participation; logging a later failure leaves the activity. Milestone zero has no schedule or reward and never grants achievement progress. Participation rows retain personal targets and project the latest root decision. A user may successfully join once; after leaving a joined activity they cannot successfully join it again. Historical invited/declined states remain readable for compatibility with older experiments.

Other milestones have a parent in the same activity. The hierarchy must be acyclic and reach milestone zero. Parents organize achievements; logging a child does not complete its parent or siblings. Existing milestones are immutable in this pass.

## Implemented schedule policies

- **Open:** no time restrictions or scheduled dates.
- **Paced:** requires a start and end. Accept submissions within that window, including the exact boundaries.
- **Deadline:** requires an end, with no start restriction. Several milestones can be logged in the same session before that deadline.

All entry points (manual, simulated voice, MCP, automation) use the same command validation. The actual submission time decides schedule eligibility. A reported historical occurrence cannot bypass a closed window, and occurrence times cannot be in the future. Browser clocks are the sandbox clock; a hosted adapter must supply authoritative server time.

An unsuccessful attempt grants no progress or reward. It may be followed by a successful attempt while the schedule remains open. Once successful, that user cannot add further outcomes to that ordinary milestone. A missed or failed milestone does not automatically block later milestones.

The policy is explicit on the milestone rather than inferred from an artwork category: a tree's image alone must not decide whether a log is accepted. The draft's Plant/Decoration/Building combinations, reward sacrifice, automatic recurring milestones, policy cascades, and saved placements are not modeled as hidden behavior.

## Shared reward requirement

Confirmed rule: when a milestone reward is planned, snapshot all currently joined participants. That saved roster must all successfully complete the milestone to obtain one item for the home base. Joining later does not expand the roster; leaving does not reduce it. The form previews the exact people required before creation, and the milestone and rewards screens show completion counts. A personal activity requires its sole participant. Automatically initialized activity participants are included when a cooperative reward is planned.

Obtaining a reward and recording the final successful log are one transaction with one `reward.obtained` event, delivered to home-base members. Replaying a request returns the original log before checking schedule expiry or repeat completion and emits no extra credit, reward, or delivery.

The reward requirement, submission-time schedules, and failed-attempt behavior were confirmed by Mosaab. Milestone zero was clarified to be automatically logged for every participant.

## Existing experiments

Database payloads now use version 2. Storage remains under `beside.playground.v1` so current experiments are found and upgraded. Migration preserves original v1 log IDs, contributions, events, ownership, and timestamps; those historical logs have `milestoneId: null`. It adds personal home bases and root decision logs for existing participation, without guessing achievements or retroactively granting items. Old activity targets and progress remain intact. Add explicit milestones to continue logging in a migrated experiment, or reset the seed for chapter, episode, and workout examples.

Import validation checks foreign keys, home-base membership, same-activity ancestry and cycles, one root per activity, unique successful user/milestone pairs, reward scope and completion, contribution attribution, schedule windows, and root/participation consistency. The browser remains a local sandbox with simulated identities and last-writer-wins storage; the SQL is a reference shape, not a deployed migration.
