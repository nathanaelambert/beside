# Beside Playground

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

At the top of the subject or new activity form, choose **Fill using AI**, enter a title and disambiguating context, then **Find suggestions**. Supported subject templates are Book, TV series (one season), Movie, Course, and Recipe. Matching activity templates are Read a book together, Watch a season, Movie club, Take a course, and Try a recipe. Other templates remain fully manual.

Use an author and edition/language/ISBN for books (explicitly say if unknown), year/creator and season for shows, director/year for films, provider/version for courses, and the original URL or author for recipes. Ambiguous results request more context without offering fields to fill. Missing details remain blank; AI must not invent an edition's contents. Explicit phrases such as “edition unknown” keep Edition blank even if research finds the work's original publication date.

Review the matched version, missing/uncertain details, and source links. Edit suggested values and check the fields to accept, then **Fill selected fields**. Existing values and uncertain proposals start unchecked. Explicit replacements are allowed, but edits made after research started are preserved and reported. Research, review, filling, cancelling and discarding never save records or emit domain events. Use the ordinary **Create subject/activity** button to save. Ownership, invitations, subject links and personal progress remain manual. Switching template/identity, saving or closing the panel disposes of its suggestions and aborts pending research.

Book Chapters, TV Episodes and course Lessons remain descriptive metadata. A sourced total can be suggested as a position-based activity target; this does **not** create objectives, chapter rows or milestones. Movie/cooking session targets and activity intentions are planning proposals, not researched facts. There is no new milestone module or storage migration. Source provenance is ephemeral in the review panel, not persisted with subjects/activities or included in exports. Existing local experiments, SQL/ERDs, import/export and the Rishik identity migration retain their current model.

### Server setup

Copy `apps/playground/.env.example` to `apps/playground/.env.local`. Privately set a **dedicated** `OPENROUTER_API_KEY` and `AI_FILL_ENABLED=true`; restart the app. Optional `OPENROUTER_MODEL` defaults to `openai/gpt-5.4-mini`, confirmed in OpenRouter's live catalog on 2026-10-14 as supporting tools and structured output. Never paste keys into chat, form fields, browser storage, source control, or `NEXT_PUBLIC_*` variables. For hosting, set the same names in the separate Playground project's server environment. The ordinary run instructions and port 3002 above are unchanged. For another worktree use `pnpm --filter playground exec next dev --port 3003`.

`POST /api/ai-fill` validates bounded input and supports a replaceable `FillProvider`. The OpenRouter adapter uses its REST API directly: one bounded research call with the current `openrouter:web_search` server tool and Exa engine (at most two searches/eight results), then a separate strict JSON-schema extraction call. Both calls use the configured model, at most 4,000 output tokens each, with one 60-second overall deadline. This avoids combining search execution with structured generation. Deprecated `:online`/web-plugin integration is not used. See [OpenRouter web search](https://openrouter.ai/docs/guides/features/server-tools/web-search) and [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs).

The server requires search-returned URL citations and only accepts per-field sources from that list. Runtime validation rejects unknown/duplicate fields, invalid targets, oversized text, unresolved matches with fields, and unsafe/unmatched URLs. Provider failures, partial results, missing sources and timeouts do not fall back to model memory. Source links are references, not proof every claim is correct; inspect the actual source and exact edition/version. Search tools are beta, and account permissions, model support, paywalls and poor source coverage can limit results.

The provider key stays on the server. Only the lookup title/context and template are sent, not the local database, identity, existing descriptions or participation history. No request/provider bodies or credentials are logged. Responses are uncached; cross-origin requests and oversized inputs are rejected. Opt-in AI is disabled without configuration. The demo has no real authentication: its process-local limit (two concurrent requests, 30 starts/hour shared across demo identities) is a sandbox guard, **not** a durable, multi-instance spending control. Use a dedicated capped OpenRouter key and hosting access protection; a public production service needs real authorization and durable rate/budget controls. Search and inference consume OpenRouter credits; no paid resources are created automatically.

### ChatGPT sign-in investigation (2026-10-14)

Subscription inference is now a real, separately authorized capability. OpenAI's [ChatGPT plan usage overview](https://developers.openai.com/siwc/token-sharing-open-source) documents dynamic registration for open-source, locally hosted clients and directs paid or remotely hosted apps to its interest process. A public source repository alone does not establish eligibility for this hosted Next.js app. [Website sign-in](https://developers.openai.com/siwc/website) is a limited trial for selected commercial partners; it requires a registered client and callback. Its identity scopes are not an inference grant.

For eligible clients, [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) documents account-specific model discovery and OAuth-backed Responses requests, with `store:false`, streaming, and terminal completion handling. [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) restrict parameters/tools; web search depends on model and account/workspace policy. This neither exposes ChatGPT conversation history nor guarantees the full API toolset. Beside has no partner approval, registered OAuth client or user consent grant, so OpenRouter is the implemented hosted route. No computer-owned Codex/ChatGPT token was read or reused. Revisit this decision after OpenAI approves the actual hosted application, using new per-user authorization and protected server sessions.

### Verification

`pnpm --filter playground test` runs the original ten domain/migration tests plus AI boundary tests for unsupported/invalid output, citation handling, draft-only filling versus explicit saving, concurrent edits, bounded provider requests, configuration failures, aborts, and API request limits. Type-check, lint and production build also pass.

T3 preview verification on this worktree's port 3003 covered the actual missing-configuration API response and preservation of manual fields. Browser export/import round-tripped the experiment, all four Mermaid modules rendered, and the event trail and Rishik perspective were checked. Browser-only response fixtures then exercised source review, editable suggestions, unchecked existing/uncertain fields, selected filling, explicit subject/activity saving, preservation of edits made during research, cancellation, ambiguity, malformed output, template reset and unsupported templates. Mobile review was inspected at 390px with no page overflow. Fixtures were injected only in the test browser, with no application bypass or fake-provider runtime mode. **Live verification completed after a dedicated key was configured (2026-10-14):** real OpenRouter/Exa research and structured extraction returned The Little Prince with author, source links and a 27-chapter total, followed by a reading-activity suggestion with a sourced target of 27. The chapter total was checked against the [official book site](https://www.lepetitprince.com/en/new-products-from-our-licensees/the-little-prince-polyglot-edition-27-chapters-27-languages/). Live browser review and filling left the database byte-for-byte unchanged; only explicit Create actions saved the subject, personal activity, participation and manually selected subject link. The live check exposed publication history being suggested for an unknown Edition, prompting a runtime guard and regression test; the subsequent live book result left Edition blank and marked it missing. Other template types have boundary/fixture coverage, not live provider verification. Hosted production has not been deployed or configured by this verification.
