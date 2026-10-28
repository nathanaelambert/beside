# Beside API

A NestJS API for mobile and web, deployed separately from the website and
playground. PostgreSQL is hosted on Neon. The initial schema follows the current
playground model; it is disposable while product decisions are changing.

## Run locally

From the repository root, use Node 24 and the repository's pnpm version:

```sh
pnpm install
docker compose -f apps/api/compose.yaml up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @beside/api db:migrate
pnpm --filter @beside/api dev
```

An existing PostgreSQL database works too: set `DATABASE_URL` in `apps/api/.env`.
Use a separate local/test database instead of the production Neon connection.
The migration seeds templates and the eight reward items, with no demo accounts.
Register without an invitation code to create an ordinary, inviteable home base.
Pass optional `inviteCode` during registration to join an existing home base instead;
no extra base is created. An invalid code rolls back the account so signup can be retried.
The migrator can be run again safely and uses a transaction and migration lock.

- API: `http://localhost:3001/api/v1`
- Interactive OpenAPI explorer: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/openapi.json`
- OpenAPI YAML: `http://localhost:3001/openapi.yaml`
- Process liveness: `/health`
- Database and migration readiness: `/health/ready`

Docs and liveness work before database configuration. Data routes require a
configured, migrated database. `PORT` defaults to 3001.

## Use the API

The `@beside/api-client` package works with browser, Node, and React Native fetch:

```ts
import { BesideClient } from "@beside/api-client";

const api = new BesideClient("http://localhost:3001");
await api.register({
  name: "Alex",
  email: "alex@example.com",
  password: "a-long-unique-password",
});
const [base] = await api.homebases(); // The base initialized during signup.
const activity = await api.createActivity({
  templateId: "read-book",
  name: "Read together",
  target: 10,
  connectionId: base.id,
});
const milestone = await api.createMilestone({
  activityId: activity.entityId,
  parentId: null,
  name: "Chapter one",
  quantity: 1,
  policy: "open",
  startAt: null,
  endAt: null,
  itemId: "oak-tree",
});
await api.recordLog({
  milestoneId: milestone.entityId,
  isSuccess: true,
  title: "Finished chapter one",
  durationMinutes: 20,
  occurredAt: new Date().toISOString(),
  origin: "manual",
  externalKey: crypto.randomUUID(), // Keep this value when retrying this log.
});
```

Every home base, including the one created during signup, has an invitation code
available immediately from `client.homebases()`. Give a friend that code to pass as
`inviteCode` in `client.register({ name, email, password, inviteCode })`, or to join
later through `joinHomebase`. Joining initializes
participation in existing activities without changing previously saved reward
rosters. To require both people for a reward, have both join before planning it.
Invitation codes grant membership to anyone who has them; members can retrieve
their space's code through `GET /homebases`.

Registration/login returns a 30-day opaque bearer token. Send
`Authorization: Bearer <token>`; `logout()` revokes it. Tokens are stored hashed
in PostgreSQL and passwords use scrypt with random salts. Requests derive the
actor from the session; clients cannot submit `actorId` or `authorUserId`.
Credential endpoints have a database-backed IP rate limit. Email verification,
password recovery, invitation expiry/rotation, and account deletion remain
outside this first pass.

The client retains tokens only in memory. A mobile sign-in flow should persist
the token in secure device storage and restore it with `setToken`. The mobile
app exposes this client as `besideApi` in `app/services/api/beside.ts`, configured
by `EXPO_PUBLIC_BESIDE_API_URL`. For a physical device use the deployed API or
your computer's LAN address instead of localhost.

## Routes and shared model

All data routes are under `/api/v1` and require a bearer session. See the served
OpenAPI document for request fields, response schemas, and HTTP status codes.

- Auth: register, login, current user, logout.
- Home bases: list, create, join with invitation code.
- Read: state, templates, catalog, subjects, activities, milestones, logs,
  rewards, events.
- Write: create subjects/activities/milestones, link subjects, change personal
  targets, record milestone outcomes, and distribute logs to home bases.

`GET /state` is an audience-filtered projection rather than an import/export
format. User profiles omit email, and deliveries are limited to the recipient.
A shared log can refer to a milestone outside the viewer's visible activities.

`packages/domain` is the source of truth for types, validators, templates, and
the command engine. Its build bundles JavaScript for Node/Vercel while browser
and React Native consumers can use the TypeScript sources. The local playground re-exports these modules to preserve
its import paths and saved experiments. API request/response schemas live there
too; OpenAPI uses those validators directly so its contract stays aligned.

Activities require an explicit `connectionId` for a home base the caller belongs
to. Home bases have no personal/shared type or special owner. The v3 migration
converts existing one-person bases in place and backfills their invitation codes;
existing activity logs become visible to anyone who subsequently joins that base.

The API persists normalized relational tables with foreign keys and unique
constraints. Each write loads the model in a transaction, applies the shared
command, then saves only new or changed rows. A PostgreSQL advisory lock
serializes writes across Vercel instances. This intentionally simple approach
keeps the evolving first pass consistent; replace whole-model reads and the
global write lock with scoped queries and row locks when scale warrants it.

Milestone submission uses server time. Log retry keys are scoped to author and
origin. Logs, progress, rewards, events, and recipient deliveries commit together.
Database records are the event trail; push/email delivery workers are not
implemented yet. Non-log creation requests are not idempotent.

## Vercel and Neon

Current production projects:

- API and explorer: https://beside-api.vercel.app/docs
- OpenAPI JSON: https://beside-api.vercel.app/openapi.json
- Playground: https://beside-playground.vercel.app/#api
- Neon resource: `beside-api-db` (free plan), connected to `beside-api`.

The first deployment was made through the authenticated Vercel CLI. The Vercel
account could not connect `nathanaelambert/beside` through its GitHub integration.
A collaborator cannot connect another user’s personal GitHub repository through
Vercel’s native integration. [GitHub Actions](../../.github/README.md) now handles
checks and production deployments with the Vercel CLI, using a repository
`VERCEL_TOKEN` secret.

Create a separate Vercel project with root directory `apps/api`, the NestJS
framework preset, Node 24, and Fluid compute. Deploy the repository root so
workspace dependencies are available. `vercel.json` pins the API to `iad1`;
provision Neon in the corresponding region.

Connect Neon through Vercel Marketplace. Set:

- `DATABASE_URL`: pooled Neon connection for API requests.
- `DATABASE_URL_UNPOOLED`: direct Neon connection for migrations, if provided.
- `CORS_ORIGINS`: comma-separated exact browser origins permitted to call the
  API, including the deployed playground.
- `API_PUBLIC_URL`: canonical HTTPS API origin for OpenAPI's server URL.

The database pool is reused per warm instance, capped at five connections, and
attached to Vercel's lifecycle with `attachDatabasePool`. No durable state lives
in function memory. TLS is verified for Neon connections.

Run migrations against the new database before deploying. Builds do not connect
to the database or run migrations. For an existing Vercel project:

```sh
pnpm dlx vercel link --cwd apps/api --project beside-api --scope YOUR_TEAM
pnpm dlx vercel env pull .env --cwd apps/api --environment production --scope YOUR_TEAM
pnpm --filter @beside/api db:migrate
```

Set `NEXT_PUBLIC_BESIDE_API_URL` on the playground project and redeploy it. Its
Backend API destination includes the explorer/spec links and a live workspace;
the remaining playground sections keep their independent local experiments.

Connect the Vercel project to GitHub for subsequent `main` deployments. Preview
deployments should use a separate Neon branch/database, not production data.

## Checks

```sh
pnpm --filter @beside/api check-types
pnpm --filter @beside/api build
pnpm --filter @beside/api test
pnpm --filter @beside/api-client test
pnpm --filter playground test
```

The API test command always checks the public OpenAPI endpoints and authentication
boundary. Database integration tests run when `TEST_DATABASE_URL` is set. Migrate
a disposable database first, then run:

```sh
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/beside_api_test \
  pnpm --filter @beside/api db:migrate
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/beside_api_test \
  pnpm --filter @beside/api test
```

These tests exercise real PostgreSQL transactions, authorization, persistence,
server-time schedules, late membership, session revocation, and concurrent
cooperative completions and retries. They create test accounts; never point
`TEST_DATABASE_URL` at production.
