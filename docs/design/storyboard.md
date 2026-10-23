# beside — storyboard 01: returning to a shared space

This is a proposed interaction storyboard based on the [working concept brief](../product/concept-brief.md). Interface layout, copy, scenery, and navigation below are draft ideas, not additional product decisions. It depicts an established connection rather than onboarding.

## Scenario

**Primary device: phone.** Draft in portrait orientation. The mobile interface proposals below remain exploratory.

You and Nathaniel share a space containing a novel you are reading, separate exercise targets, decorations, and keepsakes from past activities. Nathaniel is offline. He has already logged chapter 4 of the novel and left a note there. You have also read chapter 4 outside the app, but have not recorded it yet.

The visit should communicate: “Something from my friend is waiting here, and the things we do together have a lasting home.”

## Frame 1 — Choose your shared space

**See:** A compact collection of your connections. Each entry shows its participants and a small preview of its world. The entry for you and Nathaniel has an indicator for a shared-activity update.

**Do:** Open your connection with Nathaniel.

**Result:** Enter your shared world.

**Visual proposal:** Previews resemble little windows into distinct places. The content is organized by connections, not separate worlds for reading and exercise. A shortcut to the last visited space could be explored later.

## Frame 2 — Encounter Nathaniel’s presence

**See:** Both avatars in a furnished pixel-art setting. A red information marker appears above Nathaniel. His offline status is explicit; his avatar represents his presence in the connection, not a claim that he is currently playing. Books, exercise-related objects, and past keepsakes occupy the same setting.

**Do:** Select Nathaniel’s marker.

**Result:** A small update panel opens: “Nathaniel reached Chapter 4” and “Left you a note for Chapter 4.”

**Visual proposal:** The world fills most of the view. A small navigation strip provides direct access to Activities, History, and Decorate. Updates also have text labels so their meaning does not depend on marker color alone. Character movement is not required to reach an activity.

## Frame 3 — Find the waiting note

**See:** The novel’s activity panel, with each person’s recorded milestones. Your record currently ends at chapter 3. The chapter 4 note shows its author and milestone, with no excerpt that could reveal its contents.

**Do:** Choose “Log progress.” An alternative, “Reveal early,” is available with a spoiler warning.

**Result:** Open the progress form. Merely viewing or revealing a note does not update your milestones.

**Visual proposal:** A readable bottom sheet overlays the lower part of the world and can expand for reading and discussion. The waiting note feels like something Nathaniel left for you, without an urgency timer or overdue treatment.

## Frame 4 — Record what you actually did

**See:** Chapter 4 selected for completion. A visible audience field identifies the connection with Nathaniel and the shared novel that will receive this contribution. Audience controls allow other relevant connections, selected connections, or personal-only logging; sharing as an update only is a separate option.

**Do:** Save the chapter milestone to the shared novel. Earlier milestones are not silently marked complete.

**Result:** Your shared activity record updates and the chapter 4 note becomes available.

**Visual proposal:** Keep the common action short, with editable audience details readily accessible. The preceding frames represent a short app visit after real-world reading, not reading an entire chapter inside the flow.

## Frame 5 — Continue the conversation asynchronously

**See:** Nathaniel’s note: “Did that change how you saw the narrator?” A reply field sits beneath it, within the chapter 4 discussion context.

**Do:** Read and reply, or leave it for later.

**Result:** Your response waits for Nathaniel’s next visit. No simultaneous presence is required.

**Visual proposal:** The exchange remains attached to its activity and milestone. Do not place the reply text in a world-level preview where it could bypass the milestone context.

## Frame 6 — Add something to your world

**See:** Back in the world, the shared pool has enough credit for a decoration, earned through participation across your activities over time.

**Do:** Open Decorate, choose a tree, see its cost and the shared balance, purchase it, and place it beside trees already there.

**Result:** Another tree joins your growing forest. The purchase appears in shared history for Nathaniel to encounter later. Either participant can rearrange it.

**Visual proposal:** A small selection of complete objects, followed by a placement preview and confirmation. Repeatedly earning and placing trees creates the forest; the individual tree does not grow through stages. This scene does not assume the chapter log alone earns a tree or define an unagreed reading-credit formula.

## Frame 7 — Revisit what an object remembers

**See:** An existing book keepsake nearby, distinct from the newly purchased tree.

**Do:** Select it.

**Result:** Open a previously completed book’s history: its title, each participant’s completion, milestones, and associated notes and discussions.

**Visual proposal:** The object is an entrance to a real shared experience. The tree represents accumulated participation; the book keepsake remembers a particular activity. Both belong in the same space.

## Later — This novel becomes a keepsake too

On a later visit, you explicitly mark the current novel finished. Nathaniel has already done so. A keepsake becomes available to place; finishing every defined milestone is not required. Nathaniel can encounter the completion celebration when he returns. Selecting the placed keepsake opens the history accumulated through visits like this one.

This is a time jump, not an additional step required during the ordinary visit.

## First visual exploration

Three frames are enough to explore the visual direction before drawing every interaction:

1. **Shared world:** two avatars, Nathaniel’s update marker, multiple activity-related objects, and several existing trees.
2. **Activity and note:** the same world with the novel panel open, showing milestones and a waiting note.
3. **Decorating:** the same world in placement mode, adding one tree beside the others.

Keep the same world layout, avatars, and objects across all three drafts. Compare how clearly the world communicates activity and presence, how readable the conventional controls are, and how naturally the two fit together. Camera perspective, palette, and setting are still visual choices to explore.

### Mobile layout proposals

- Portrait canvas with the connection name and space switcher at the top.
- A world that supports panning, with direct taps on avatars and objects; no mandatory character movement.
- Thumb-reachable Activities, History, and Decorate controls at the bottom.
- Activity details open in an expandable bottom sheet. Longer discussions and logging forms can expand to a full-screen view.
- World objects use pixel art; interface text uses a readable conventional typeface.
- Decoration placement uses tap-to-place with a preview and explicit confirmation; dragging can be an additional option.
- Keep touch targets generous, even where sprites are small. Use text and symbols alongside marker colors.
