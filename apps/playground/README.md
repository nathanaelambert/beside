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

## Experiments

1. As Mosaab, save chapter 5 with both reading activities checked. One log advances Dune to position 5 and adds one reading-habit session. Nathaniel and Rishik retain independent progress. Switch identities and compare activities, Logbook, and Event trail's **My inbox**.
2. Save a standalone log with no credit or audience. It stays private. In Logbook, use **Share later / add progress credit** to add an update-only audience, then credit an activity independently.
3. Create a book in Subjects. Create a shared activity using it and invite others. Switch identity to accept the invitation and set a different target. Link a second subject to test many-to-many relationships.
4. Select Voice, MCP, or Event in the composer. These are simulations without external integrations. Submit with a request key, then replay it: the same author/source/key returns the original log without duplicate credit or deliveries. Change the key for a new event.
5. Open Working model for four rendered Mermaid ERDs, zoom, source copy, and all 14 relational tables. Observer mode in Event trail reveals every event and recipient.

## Storage

Normalized relational rows are stored as one versioned JSON document in `localStorage`, key `beside.playground.v1`, seeded on first visit and preserved on reload. Each browser/origin has its own independent experiment. People visiting the same deployed URL do not share a live database; export/import JSON to exchange scenarios.

Imports validate shape, foreign keys, unique joins, ownership, attribution, and contribution amounts before replacing data. Reset requires inline confirmation. Unreadable saved data is preserved while a temporary seed opens, with recovery export available. If storage is unavailable/full, changes continue in memory with a warning.

Same-origin tabs receive storage updates. Writes are last-writer-wins snapshots; avoid simultaneous edits across tabs. A hosted SQL adapter should execute each command and its events in a single transaction.

## Working assumptions

- Subjects stay creator-owned. Descriptions become visible through an accessible activity link or shared log; private participation and logs do not follow them automatically.
- An activity belongs to one user or one connection, never both. Creator attribution is separate from ownership.
- Participation holds individual targets and invitation/completion status. Accept invitations before logging progress. Finishing/leaving preserves contributions. Connection membership is fixed; leaving an activity does not leave its connection.
- Logs belong to their author and only credit that author's participation. Sharing grants visibility independently of credit. Shared credit adds the required audience automatically.
- Categories are matching tags. An activity with subject links accepts those subjects; an unscoped activity accepts any matching subject or none. Non-session rules require exact units; no pages-to-chapters conversion is inferred.
- Position rules take the maximum position; sum rules add quantities; session rules count distinct credited logs. Reaching a target does not automatically mark a participant finished.
- Targets are **sandbox totals**, not weekly goals. Changing them recalculates the experiment. Periods, target versions, rewards, streaks, edits, revocation, and membership changes remain future experiments.
- Distribution is additive: shares/credit can be added later, not retracted. Deduplication handles retries and repeated attachment, not deliberate splitting of one session into multiple logs.
- Observer panels and the window API see the whole local database. UI perspective rules teach relationships, not security. Production needs server authentication and authorization.

## Code and SQL

- `src/lib/types.ts`: relational rows and commands.
- `model.ts`: pure command transactions, visibility, progress projections, event routing.
- `validation.ts`: runtime log payload and database validation.
- `templates.ts` / `seed.ts`: 13 subject templates, 14 activity templates, 17 subjects, 9 activities, three users, four connections.
- `store.ts`: local persistence and export/import.
- `schema.ts`: table descriptions and generated Mermaid modules with PK/FK columns.
- `schema.sql`: reference SQL tables, checks, unique constraints, and indexes. PostgreSQL-friendly `jsonb` and `timestamptz`; not a production migration.

The domain-event envelope's `entityType`/`entityId` is application-validated, not a polymorphic SQL FK. Ordinary relationships use FK IDs and joins. A SQL adapter maps camelCase rows to snake_case columns. Derive progress from contributions rather than maintaining a second source of truth.

All logging origins enter the same `recordLog` command. Future voice parsers, MCP tools, and event handlers should authenticate an actor, produce validated input, and call that boundary with an idempotency key. The browser-only adapter acts as the identity selected in the header:

```js
const db = window.besidePlayground.getDatabase();
window.besidePlayground.recordLog({
  subjectId: null,
  category: "habits",
  title: "Took a mindful pause",
  quantity: 1,
  unit: "sessions",
  durationMinutes: 5,
  occurredAt: new Date().toISOString(),
  origin: "mcp",
  externalKey: "pause-request-1",
  activityIds: [],
  connectionIds: [],
});
```

Mermaid is bundled and loaded when the model view opens, using its [rendering API](https://mermaid.js.org/config/usage.html) and [ER syntax](https://mermaid.js.org/syntax/entityRelationshipDiagram.html). Google Fonts has local fallbacks; data and model logic need no hosted service.

## Vercel

Use a separate project with **Root Directory `apps/playground`**, **Next.js**, **Node 24.x**, and workspace-root dependency installation. Choose `monorepo` as the production branch or leave it as a preview branch. Root Directory is a project setting, not a `vercel.json` key. Keep the existing Beside showcase project separate.

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

`pnpm --filter playground test` runs 31 tests: the original ten domain/migration tests plus AI boundary and draft-fill tests for unsupported/invalid output, citation handling, selecting and filling the most likely match, draft-only filling versus explicit saving, concurrent edits, bounded provider requests, configuration failures, aborts, and API request limits. Type-check, lint and production build also pass.

Initial, pre-redesign T3 preview verification on this worktree's port 3003 covered the actual missing-configuration API response and preservation of manual fields. Browser export/import round-tripped the experiment, all four Mermaid modules rendered, and the event trail and Rishik perspective were checked. Browser-only response fixtures then exercised source review, editable suggestions, unchecked existing/uncertain fields, selected filling, explicit subject/activity saving, preservation of edits made during research, cancellation, ambiguity, malformed output, template reset and unsupported templates. Mobile review was inspected at 390px with no page overflow. Fixtures were injected only in the test browser, with no application bypass or fake-provider runtime mode. **Initial live verification with GPT-5.4 Mini after a dedicated key was configured (2026-10-14):** real OpenRouter/Exa research and structured extraction returned The Little Prince with author, source links and a 27-chapter total, followed by a reading-activity suggestion with a sourced target of 27. The chapter total was checked against the [official book site](https://www.lepetitprince.com/en/new-products-from-our-licensees/the-little-prince-polyglot-edition-27-chapters-27-languages/). Live browser review and filling left the database byte-for-byte unchanged; only explicit Create actions saved the subject, personal activity, participation and manually selected subject link. The live check exposed publication history being suggested for an unknown Edition, prompting a runtime guard and regression test; the subsequent live book result left Edition blank and marked it missing. Other template types have boundary/fixture coverage, not live provider verification. Hosted production has not been deployed or configured by this verification.

**v0.2 model verification (2026-10-14):** GPT-5.6 Luna with high reasoning completed the live book research and structured extraction flow through the browser, returned source-linked title/author/chapter suggestions, and kept the unknown Edition blank. Reviewing and filling left database records unchanged. Tests assert that both provider calls carry high reasoning with the bounded completion budget. All 22 tests, type-check, lint and production build passed.

**Input-suffix redesign verification (2026-10-14):** a live Luna/high lookup filled the original subject fields directly, left the database unchanged, and showed no source links until the info popup was opened. Browser fixtures covered initially disabled/enabled suffix state, preserving manual fields and edits made during loading, Undo, cancellation, title/context changes, ambiguity, provider errors, activity target protection, explicit saving without persisted references, and resetting the suffix after save. The form and native info popup fit a 390px viewport without overflow. All 29 tests, type-check, lint and production build passed. Fixtures and verification records were removed afterward.

**Multiple-match verification (2026-10-14):** a live Luna/high lookup for the movie title “The Thing” selected John Carpenter's 1982 film and filled Director and Year, with official film sources available only in the info popup. The database remained byte-for-byte unchanged. A separate browser-only `ambiguous` response fixture verified that the chosen candidate fills the main form, preserves an already entered Year, keeps references hidden, and supports Undo without saving. The fixture was removed afterward. Provider-mocked tests cover multiple research candidates followed by extraction and draft filling; they do not measure the model's ranking accuracy. All 31 tests, type-check, lint and production build passed. Most-likely selection remains a reviewable AI judgment, not a guarantee that it chose the user's intended work.
