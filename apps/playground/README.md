# Beside Playground

App version **v0.2** (`0.2.0`).

A Next.js browser workbench for exploring subjects, activities, logs, ownership, participation, progress, and event delivery. Three selectable demo identities simulate perspective, not authentication.

## Local development

From the monorepo root, with its Node and pnpm versions:

```sh
pnpm install
pnpm dev --filter=playground
```

Open **http://localhost:3002**. Other apps keep their own ports.

```sh
pnpm build --filter=playground
pnpm --filter playground start
pnpm --filter playground check-types
pnpm --filter playground lint
pnpm --filter playground test
```

## Milestones and home-base rewards

This pass implements the 2026-10-20 entity discussion on `docs/entities` (`51fe15b`). See [the implemented model and decisions](../../docs/architecture/playground-model.md), [the original entity draft](../../docs/architecture/entities.md), and [`schema.sql`](schema.sql).

- **Activities:** create an activity in a home base, set personal targets, and inspect its milestones. Creation automatically records milestone zero for every participant; everyone starts active.
- **Milestones** (`#milestones`): plan named achievements, optional same-activity parents, a progress quantity/position, schedule, and optional item reward. Milestone zero is self-parented, logged automatically as the first milestone for every participant, and can later record leaving.
- **Record a log:** every new log references exactly one milestone and records success or failure. Each person can succeed once per milestone. Ordinary successes credit only their own activity; failures and root decisions give no progress.
- **Reward items:** the eight shared pixel-art items remain reusable catalog artwork. A milestone can award one item to its whole home base. All participants joined at planning time must succeed. That roster is fixed and shown before saving. Earned and pending rewards appear above the temporary placement preview.
- **Logbook / Event trail:** inspect outcomes, contributions, participation decisions and reward delivery. Sharing an update later never adds progress to another activity.
- **Lexicon / ERDs:** 17 models, five diagrams, and expandable records now include milestones and shared rewards.

### Try it

1. Open Milestones, select **Dune, together**, and record a success on **Chapter 1** as Mosaab. It advances that activity only, leaves other chapters unchanged, and shows one of two required people complete.
2. Switch to Nathaniel and complete the same chapter. The Mosaab + Nathaniel home base earns one Meadow oak. A second success from either person is refused.
3. Create a shared activity. Every participant already has one automatic successful log on **0 · Automatic activity start / leave**, with no achievement credit. Switch identities to inspect it, or use **Leave activity** to record a later failure on milestone zero.
4. Add a **Paced** milestone with a future start/end. Early and late submissions are refused. **Deadline** allows any submission before its end; **Open** has no schedule. All boundaries are inclusive. Backdating the occurrence cannot reopen a window.
5. Record a failed ordinary attempt, then a success while eligible. Select Voice, MCP or Event to simulate another source, provide a request key, save, and replay it. The original log is reused without duplicate progress or rewards.

### Storage and compatibility

Payload version is now **3**. The existing localStorage key `beside.playground.v1` is retained. Explicit v1 snapshots migrate without losing historical logs, progress, shares, events or ownership. Historical logs retain `milestoneId: null`; new commands require one. Migration adds home bases and root join/leave history, without guessing chapter completion or granting retroactive rewards. Add milestones to continue an existing experiment, or reset the seed for fully populated examples.

Existing `connections` and `memberships` JSON keys represent home bases and their members. All home bases behave alike; membership governs access. Former personal home bases and their activities migrate in place, with their existing history made visible to the base’s members. Cross-tab updates, export/import, recovery export, reset confirmation and memory fallback remain available. Imports validate milestone hierarchy, schedule, completion, reward scope, root decisions, foreign keys and contributions before replacing the current experiment.

The sandbox checks submission time using its browser clock. A hosted adapter must use server time and atomically enforce the unique successful user/milestone pair and final reward grant. This pass does not deploy a backend, create saved world placements, or implement reward sacrifice, recurring generation, or failure cascades. The milestone schedule is explicit rather than hardcoded from an item's art category.

### Window API

```js
const db = window.besidePlayground.getDatabase();
const activity = db.activities.find((a) => a.name === "Dune, together");
const milestone = db.milestones.find(
  (m) => m.activityId === activity.id && m.name === "Chapter 1",
);
window.besidePlayground.recordLog({
  milestoneId: milestone.id,
  isSuccess: true,
  title: "Finished the first chapter",
  durationMinutes: 25,
  occurredAt: new Date().toISOString(),
  origin: "mcp",
  externalKey: "chapter-1-request",
});
```

The author is the selected demo identity. Payloads cannot choose progress amounts or additional activities. Retry keys are normalized before deduplication. Subjects, AI draft filling and catalog downloads use their existing boundaries.

## Code and checks

- `src/lib/types.ts`: milestone, home-base reward, log and command contracts.
- `model.ts`: atomic commands, schedule enforcement, once-only completion, root participation, shared rewards and deliveries.
- `validation.ts` / `migrations.ts`: validated imports and v1 compatibility.
- `seed.ts`: chapter, episode, workout-day and other example milestones.
- `schema.ts` / `schema.sql`: model reference and PostgreSQL-friendly shape.
- `packages/rewards`: portable catalog definitions and pixel-art rendering, shared with the mobile app.

```sh
pnpm --filter playground test
pnpm --filter playground check-types
pnpm --filter playground lint
pnpm --filter playground build
```

### Milestone verification (2026-10-21)

All 44 tests, type-check, lint, and production build pass. Domain tests cover once-only success, shared reward issuance and delivery, milestone-zero decisions, invalid inputs and permissions, inclusive paced/deadline boundaries, backdating rejection, request retries, immutable reward requirements, hierarchy and import integrity, and v1 migration. Browser checks covered two demo identities earning one shared item, repeated-success rejection, creating a future-paced milestone, creating a shared activity, inspecting automatic starts for all members, and leaving through its root, all five rendered Mermaid diagrams, and JSON export/reset/import. Milestones, logging, rewards, logbook, activities, and lexicon fit a 390px viewport with no horizontal page overflow or page errors. Checks used a separate browser context; no user experiment was reset.

## Vercel

Use a separate project with **Root Directory `apps/playground`**, **Next.js**, **Node 24.x**, and workspace-root dependency installation. Keep the existing Beside showcase project separate. No deployment is performed by this change.

## Fill using AI

Type a title in the ordinary subject form, then click the sparkle at the right edge of that input. It is grey and disabled while the title is empty, then enables as you type. There is no second lookup form or separate suggestion form. Supported subjects are Book, TV series (one season), Movie, Course, and Recipe. Matching activities use the same suffix on Activity name; type a specific name or select one subject to look up. Other templates stay manual.

Use the existing Author/Edition, Creator/Season, Director/Year, Provider, or recipe Source fields to guide the lookup. Only the title and these identifying details are sent to research. When several works match, AI chooses the most likely single result and fills its sourced facts rather than asking you to choose. Supplied identifying details take priority; without them, it prefers the best-known exact-title match with reliable source evidence. The info popup identifies the chosen work and selection assumptions so you can correct them. Facts from different candidates must not be combined. Unknown editions and uncertain subject facts stay blank; AI must not invent contents. A book with no Edition entered is treated as edition unknown. If no usable match respects the supplied details, the draft stays unchanged.

Clicking the sparkle fills empty fields in the **existing draft**, preserving your title, typed values, and edits made while research runs. Untouched activity target defaults can be replaced; manually edited targets are preserved. Change any filled value directly, or use **Undo**, which also preserves later manual edits. Review the main form and use the ordinary **Create subject/activity** button to save. AI filling never saves, emits events, chooses ownership, changes invitations or links subjects. The loading suffix can be clicked to cancel; changing the lookup identity, template or user prevents stale results from filling the form.

Sources are hidden behind a small **info icon beside the input label** after a lookup. Its popup provides matched-work context, missing/uncertain details and supporting references. No source links appear under individual fields or in the ordinary form. Provenance stays only in component memory and is never passed to commands, stored on the subject/activity, or included in exports. AI does not populate the subject Source field or inject URL-bearing suggestions into fields. A Source value you enter manually remains your own ordinary metadata.

Book Chapters, TV Episodes and course Lessons remain descriptive metadata. A sourced total can be suggested as a position-based activity target; this does **not** create objectives, chapter rows or milestones. Movie/cooking session targets and activity intentions are planning proposals, not researched facts. There is no new milestone module or storage migration. Source provenance is ephemeral in the info popup, not persisted with subjects/activities or included in exports. Existing local experiments, SQL/ERDs, import/export and the Rishik identity migration retain their current model.

### Server setup

Copy `apps/playground/.env.example` to `apps/playground/.env.local`. Privately set a **dedicated** `OPENROUTER_API_KEY` and `AI_FILL_ENABLED=true`; restart the app. Optional `OPENROUTER_MODEL` defaults to `openai/gpt-5.6-luna` (GPT-5.6 Luna), confirmed in OpenRouter's live catalog on 2026-10-14 as supporting reasoning, tools and structured output. Both research and extraction use `reasoning: { effort: "high", exclude: true }`: high reasoning is enabled internally and is not returned to the browser. See [OpenAI model capabilities](https://developers.openai.com/api/docs/models/gpt-5.6-luna) and [OpenRouter reasoning configuration](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens). Never paste keys into chat, form fields, browser storage, source control, or `NEXT_PUBLIC_*` variables. For hosting, set the same names in the separate Playground project's server environment. The ordinary run instructions and port 3002 above are unchanged. For another worktree use `pnpm --filter playground exec next dev --port 3003`.

`POST /api/ai-fill` validates bounded input and supports a replaceable `FillProvider`. The OpenRouter adapter uses its REST API directly: one bounded research call with the current `openrouter:web_search` server tool and Exa engine (at most two searches/eight results), then a separate strict JSON-schema extraction call. Both calls use the configured model, at most 12,000 completion tokens each (internal reasoning plus visible output), with one 60-second overall deadline. This avoids combining search execution with structured generation. Deprecated `:online`/web-plugin integration is not used. See [OpenRouter web search](https://openrouter.ai/docs/guides/features/server-tools/web-search) and [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs).

The server requires search-returned URL citations and only accepts per-field sources from that list. Runtime validation rejects unknown/duplicate fields, invalid targets, oversized text, not-found results with fields, and unsafe/unmatched URLs. An ambiguous result represents one selected likely candidate and may provide its supported facts for draft filling. Provider failures, partial results, missing sources and timeouts do not fall back to model memory. Source links are references, not proof every claim is correct; inspect the actual source and exact edition/version. Search tools are beta, and account permissions, model support, paywalls and poor source coverage can limit results.

The provider key stays on the server. Only the lookup title, existing identifying fields (such as Author/Edition or Provider) and template are sent, not the local database, demo identity, activity descriptions or participation history. No request/provider bodies or credentials are logged. Responses are uncached; cross-origin requests and oversized inputs are rejected. Opt-in AI is disabled without configuration. The demo has no real authentication: its process-local limit (two concurrent requests, 30 starts/hour shared across demo identities) is a sandbox guard, **not** a durable, multi-instance spending control. Use a dedicated capped OpenRouter key and hosting access protection; a public production service needs real authorization and durable rate/budget controls. Search and inference consume OpenRouter credits; no paid resources are created automatically.

### ChatGPT sign-in investigation (2026-10-14)

Subscription inference is now a real, separately authorized capability. OpenAI's [ChatGPT plan usage overview](https://developers.openai.com/siwc/token-sharing-open-source) documents dynamic registration for open-source, locally hosted clients and directs paid or remotely hosted apps to its interest process. A public source repository alone does not establish eligibility for this hosted Next.js app. [Website sign-in](https://developers.openai.com/siwc/website) is a limited trial for selected commercial partners; it requires a registered client and callback. Its identity scopes are not an inference grant.

For eligible clients, [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) documents account-specific model discovery and OAuth-backed Responses requests, with `store:false`, streaming, and terminal completion handling. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) restrict parameters/tools; web search depends on model and account/workspace policy. This neither exposes ChatGPT conversation history nor guarantees the full API toolset. Beside has no partner approval, registered OAuth client or user consent grant, so OpenRouter is the implemented hosted route. No computer-owned Codex/ChatGPT token was read or reused. Revisit this decision after OpenAI approves the actual hosted application, using new per-user authorization and protected server sessions.

### Verification

`pnpm --filter playground test` runs 34 tests: ten domain/migration tests, three reward catalog/import tests, and AI boundary and draft-fill tests for unsupported/invalid output, citation handling, selecting and filling the most likely match, draft-only filling versus explicit saving, concurrent edits, bounded provider requests, configuration failures, aborts, and API request limits. Type-check, lint and production build also pass.

Initial, pre-redesign T3 preview verification on this worktree's port 3003 covered the actual missing-configuration API response and preservation of manual fields. Browser export/import round-tripped the experiment, all four Mermaid modules rendered, and the event trail and Rishik perspective were checked. Browser-only response fixtures then exercised source review, editable suggestions, unchecked existing/uncertain fields, selected filling, explicit subject/activity saving, preservation of edits made during research, cancellation, ambiguity, malformed output, template reset and unsupported templates. Mobile review was inspected at 390px with no page overflow. Fixtures were injected only in the test browser, with no application bypass or fake-provider runtime mode. **Initial live verification with GPT-5.4 Mini after a dedicated key was configured (2026-10-14):** real OpenRouter/Exa research and structured extraction returned The Little Prince with author, source links and a 27-chapter total, followed by a reading-activity suggestion with a sourced target of 27. The chapter total was checked against the [official book site](https://www.lepetitprince.com/en/new-products-from-our-licensees/the-little-prince-polyglot-edition-27-chapters-27-languages/). Live browser review and filling left the database byte-for-byte unchanged; only explicit Create actions saved the subject, personal activity, participation and manually selected subject link. The live check exposed publication history being suggested for an unknown Edition, prompting a runtime guard and regression test; the subsequent live book result left Edition blank and marked it missing. Other template types have boundary/fixture coverage, not live provider verification. Hosted production has not been deployed or configured by this verification.

**v0.2 model verification (2026-10-14):** GPT-5.6 Luna with high reasoning completed the live book research and structured extraction flow through the browser, returned source-linked title/author/chapter suggestions, and kept the unknown Edition blank. Reviewing and filling left database records unchanged. Tests assert that both provider calls carry high reasoning with the bounded completion budget. All 22 tests, type-check, lint and production build passed.

**Input-suffix redesign verification (2026-10-14):** a live Luna/high lookup filled the original subject fields directly, left the database unchanged, and showed no source links until the info popup was opened. Browser fixtures covered initially disabled/enabled suffix state, preserving manual fields and edits made during loading, Undo, cancellation, title/context changes, ambiguity, provider errors, activity target protection, explicit saving without persisted references, and resetting the suffix after save. The form and native info popup fit a 390px viewport without overflow. All 29 tests, type-check, lint and production build passed. Fixtures and verification records were removed afterward.

**Multiple-match verification (2026-10-14):** a live Luna/high lookup for the movie title “The Thing” selected John Carpenter's 1982 film and filled Director and Year, with official film sources available only in the info popup. The database remained byte-for-byte unchanged. A separate browser-only `ambiguous` response fixture verified that the chosen candidate fills the main form, preserves an already entered Year, keeps references hidden, and supports Undo without saving. The fixture was removed afterward. Provider-mocked tests cover multiple research candidates followed by extraction and draft filling; they do not measure the model's ranking accuracy. All 31 tests, type-check, lint and production build passed. Most-likely selection remains a reviewable AI judgment, not a guarantee that it chose the user's intended work.

**Reward catalog verification (2026-10-21):** all 34 tests, type-check, lint, and production build passed. Local browser checks covered category filtering, name search, repeated placement, removal of the final item, and a downloaded valid 32 × 32 transparent SVG. Preview placement left the event count unchanged. The catalog fit a 390px viewport without horizontal overflow, and the reward model diagram and eight inspector rows rendered. No deployment was performed.

## Backend API

The **Backend API** destination links to the shared backend's interactive OpenAPI
explorer, JSON spec, and database readiness endpoint. It also provides a live
PostgreSQL workspace for signing in, creating/joining home bases, and planning and
completing activity milestones. Set `NEXT_PUBLIC_BESIDE_API_URL` to the API origin
(defaults to `http://localhost:3001`); see [API setup](../api/README.md).

This destination uses a real account and its own server data. The perspective
selector and all other destinations continue using the local experiment. Domain
types, validators, seed data, templates, and commands now live in
`@beside/domain`, re-exported by the existing `src/lib` modules.
