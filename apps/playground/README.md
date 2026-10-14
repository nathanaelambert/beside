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

1. As Mosaab, save chapter 5 with both reading activities checked. One log advances Dune to position 5 and adds one reading-habit session. Nathaniel and Maya retain independent progress. Switch identities and compare activities, Logbook, and Event trail's **My inbox**.
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
